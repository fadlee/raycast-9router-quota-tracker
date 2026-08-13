
export interface QuotaItem {
  label: string;
  shortLabel: string;
  used: string;
  total: string;
  remaining: string;
  reset: string;
  extra: string;
  remainingPercent: number | null;
}

export interface Connection {
  id: string;
  name?: string;
  displayName?: string;
  accountLabel?: string;
  email?: string;
  provider: string;
  isActive: boolean;
  quotas: QuotaItem[];
  errorMessage?: string;
  minPercent: number | null;
  nearestReset?: string;
}

export interface TrackerData {
  connections: Connection[];
  providers: string[];
}

const DEFAULT_LABEL_REPLACEMENTS: Record<string, string> = {
  five_minute: "5min",
  requests_per_day: "RPD",
  requests_per_minute: "RPM",
  tokens_per_minute: "TPM",
  tokens_per_day: "TPD",
  tokens_per_month: "TPMonth",
  concurrent_requests: "Concurrent",
  balance: "Balance",
};

const GENERIC_LABEL_PRIORITY: Record<string, number> = {
  "5min": 1,
  RPD: 2,
  RPM: 3,
  TPM: 4,
  TPD: 5,
  Balance: 6,
};

function formatNumber(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return String(value);
  if (typeof value === "number") {
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(2).replace(/\.?0+$/, "");
  }
  return String(value);
}
function formatReset(value: unknown): string {
  if (!value) return "-";
  let targetMs: number | null = null;

  if (typeof value === "number") {
    targetMs = value > 1e11 ? value : value * 1000;
  } else {
    const strVal = String(value).trim();
    if (/^\d+$/.test(strVal)) {
      const num = Number(strVal);
      targetMs = num > 1e11 ? num : num * 1000;
    } else {
      const parsed = Date.parse(strVal);
      if (!isNaN(parsed)) targetMs = parsed;
    }
  }

  if (!targetMs) return String(value);

  const diffMs = targetMs - Date.now();
  if (diffMs <= 0) return "now";

  const totalSec = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}m`);
  if (parts.length === 0) parts.push(`${secs}s`);

  return `in ${parts.join(" ")}`;
}

function safeFloat(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
}

function remainingPercent(remaining: unknown, total: unknown): number | null {
  const rem = safeFloat(remaining);
  const tot = safeFloat(total);
  if (rem === null || tot === null || tot <= 0) return null;
  return Math.max(0, Math.min(100, (rem / tot) * 100));
}

function shortLabel(label: string): string {
  return DEFAULT_LABEL_REPLACEMENTS[label] || label;
}

export function getStatusIcon(percent: number | null): string {
  if (percent === null) return "⚪";
  if (percent <= 10) return "🔴";
  if (percent <= 35) return "🟡";
  return "🟢";
}

export function getProgressBar(percent: number | null, width = 10): string {
  if (percent === null) return "░".repeat(width);
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

export function getAccountName(conn: Record<string, unknown>): string {
  return (
    (conn.displayName as string) ||
    (conn.accountLabel as string) ||
    (conn.email as string) ||
    (conn.name as string) ||
    (conn.id as string) ||
    "unknown-account"
  );
}

export function getConnectionStatus(connection: { isActive?: unknown }): "Active" | "Inactive" {
  return connection.isActive === false ? "Inactive" : "Active";
}

export async function fetch9RouterData(baseUrl: string, password: string, providerFilter = "all"): Promise<TrackerData> {
  if (!baseUrl) throw new Error("Base URL is not configured");
  if (!password) throw new Error("Password is not configured");

  // 1. Login
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });

  if (!loginRes.ok) {
    throw new Error(`Login HTTP error! status: ${loginRes.status}`);
  }

  const cookieHeader = loginRes.headers.get("set-cookie") || "";

  const loginJson = (await loginRes.json()) as { success?: boolean; error?: string };
  if (!loginJson.success) {
    throw new Error(loginJson.error || "Login failed: Invalid password");
  }

  // 2. Fetch connections
  const params = new URLSearchParams({
    page: "1",
    pageSize: "100",
    accountStatus: "all",
    sort: "priority",
  });

  if (providerFilter && providerFilter !== "all") {
    params.set("provider", providerFilter);
  }

  const clientRes = await fetch(`${baseUrl}/api/providers/client?${params.toString()}`, {
    headers: { Cookie: cookieHeader },
  });

  if (!clientRes.ok) {
    throw new Error(`Fetch clients HTTP error! status: ${clientRes.status}`);
  }

  const clientPayload = (await clientRes.json()) as { connections?: Record<string, unknown>[] };
  const rawConnections = clientPayload.connections || [];

  const providersSet = new Set<string>();
  const connections: Connection[] = [];

  for (const conn of rawConnections) {
    const id = String(conn.id || "");
    const provider = String(conn.provider || "unknown");
    providersSet.add(provider);

    let usageData: Record<string, unknown> = {};
    let errorMessage: string | undefined = undefined;

    try {
      const usageRes = await fetch(`${baseUrl}/api/usage/${id}`, {
        headers: { Cookie: cookieHeader },
      });
      if (usageRes.ok) {
        usageData = (await usageRes.json()) as Record<string, unknown>;
      } else {
        errorMessage = `HTTP ${usageRes.status}`;
      }
    } catch (err: unknown) {
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    const quotasRaw = (usageData.quotas || {}) as Record<string, Record<string, unknown>>;
    const quotas: QuotaItem[] = [];
    let minPercent: number | null = null;

    for (const [quotaName, qVal] of Object.entries(quotasRaw)) {
      if (typeof qVal !== "object" || !qVal) continue;
      const label = String(qVal.displayName || qVal.label || quotaName);
      let remaining = qVal.remaining;
      if ((remaining === null || remaining === undefined || remaining === "") && qVal.total !== undefined && qVal.used !== undefined) {
        const tot = safeFloat(qVal.total);
        const usd = safeFloat(qVal.used);
        if (tot !== null && usd !== null) remaining = tot - usd;
      }

      let extra = "";
      if (qVal.remainingPercentage !== undefined && qVal.remainingPercentage !== "") {
        extra = ` (${formatNumber(qVal.remainingPercentage)}%)`;
      } else if (qVal.unit) {
        extra = ` ${qVal.unit}`;
      }

      const remPct = remainingPercent(remaining, qVal.total);
      if (remPct !== null) {
        if (minPercent === null || remPct < minPercent) minPercent = remPct;
      }

      quotas.push({
        label,
        shortLabel: shortLabel(label),
        used: formatNumber(qVal.used),
        total: qVal.unlimited ? "unlimited" : formatNumber(qVal.total),
        remaining: formatNumber(remaining),
        reset: formatReset(qVal.resetAt),
        extra,
        remainingPercent: remPct,
      });
    }

    // Sort quotas by priority
    quotas.sort((a, b) => {
      const prioA = GENERIC_LABEL_PRIORITY[a.shortLabel] ?? 999;
      const prioB = GENERIC_LABEL_PRIORITY[b.shortLabel] ?? 999;
      if (prioA !== prioB) return prioA - prioB;
      return a.shortLabel.localeCompare(b.shortLabel);
    });
    const resetQuotas = quotas.filter((q) => q.reset && q.reset !== "-");
    const nearestReset = resetQuotas.length > 0 ? resetQuotas[0].reset : undefined;

    connections.push({
      id,
      name: conn.name as string,
      displayName: conn.displayName as string,
      accountLabel: conn.accountLabel as string,
      email: conn.email as string,
      provider,
      isActive: conn.isActive !== false,
      quotas,
      errorMessage,
      minPercent,
      nearestReset,
    });
  }

  return {
    connections,
    providers: Array.from(providersSet).sort(),
  };
}
