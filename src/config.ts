import { getPreferenceValues, LocalStorage } from "@raycast/api";

export interface Config {
  baseUrl: string;
  password: string;
  providerFilter: string;
}

const STORAGE_KEYS = {
  BASE_URL: "config_base_url",
  PASSWORD: "config_password",
  PROVIDER_FILTER: "config_provider_filter",
  CACHE_DATA: "cache_9router_data",
  CACHE_TIME: "cache_9router_timestamp",
};

export async function getConfig(): Promise<Config> {
  const prefs = getPreferenceValues<{ baseUrl?: string; password?: string; providerFilter?: string }>();

  const storedBaseUrl = await LocalStorage.getItem<string>(STORAGE_KEYS.BASE_URL);
  const storedPassword = await LocalStorage.getItem<string>(STORAGE_KEYS.PASSWORD);
  const storedProviderFilter = await LocalStorage.getItem<string>(STORAGE_KEYS.PROVIDER_FILTER);

  return {
    baseUrl: (storedBaseUrl !== undefined && storedBaseUrl !== "" ? storedBaseUrl : prefs.baseUrl || "").trim().replace(/\/+$/, ""),
    password: storedPassword !== undefined && storedPassword !== "" ? storedPassword : prefs.password || "",
    providerFilter: (storedProviderFilter !== undefined && storedProviderFilter !== "" ? storedProviderFilter : prefs.providerFilter || "all").trim().toLowerCase(),
  };
}

export async function saveConfig(config: Partial<Config>): Promise<void> {
  if (config.baseUrl !== undefined) {
    await LocalStorage.setItem(STORAGE_KEYS.BASE_URL, config.baseUrl.trim().replace(/\/+$/, ""));
  }
  if (config.password !== undefined) {
    await LocalStorage.setItem(STORAGE_KEYS.PASSWORD, config.password);
  }
  if (config.providerFilter !== undefined) {
    await LocalStorage.setItem(STORAGE_KEYS.PROVIDER_FILTER, config.providerFilter.trim().toLowerCase());
  }
}

export async function getCachedData<T>(): Promise<{ data: T | null; timestamp: number | null }> {
  const rawData = await LocalStorage.getItem<string>(STORAGE_KEYS.CACHE_DATA);
  const rawTime = await LocalStorage.getItem<number>(STORAGE_KEYS.CACHE_TIME);
  if (!rawData) return { data: null, timestamp: null };
  try {
    return { data: JSON.parse(rawData) as T, timestamp: rawTime || null };
  } catch {
    return { data: null, timestamp: null };
  }
}

export async function setCachedData<T>(data: T): Promise<number> {
  const now = Date.now();
  await LocalStorage.setItem(STORAGE_KEYS.CACHE_DATA, JSON.stringify(data));
  await LocalStorage.setItem(STORAGE_KEYS.CACHE_TIME, now);
  return now;
}
