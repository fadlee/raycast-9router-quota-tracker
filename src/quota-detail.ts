import type { QuotaItem } from "./api";

interface QuotaDetailInput {
  quotas: QuotaItem[];
  errorMessage?: string;
}

export function renderQuotaDetails({ quotas, errorMessage }: QuotaDetailInput): string {
  if (errorMessage) return `> ⚠️ **Error:** ${errorMessage}`;
  if (quotas.length === 0) return "*No quota data available*";

  return `| Quota | Usage | Reset |\n| --- | --- | --- |\n${quotas.map((quota) => `| **${quota.shortLabel}** | ${quota.used} / ${quota.total} | ${quota.reset} |`).join("\n")}`;
}
