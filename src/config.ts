import { getPreferenceValues, LocalStorage } from "@raycast/api";
import { randomUUID } from "crypto";
import type { TrackerData } from "./api";

export interface InstanceConfig {
  id: string;
  name: string;
  baseUrl: string;
  password: string;
  providerFilter: string;
}

export interface InstanceCache {
  data: TrackerData | null;
  timestamp: number | null;
  refreshError: string | null;
}

const STORAGE_KEYS = {
  INSTANCES: "config_instances",
  LEGACY_BASE_URL: "config_base_url",
  LEGACY_PASSWORD: "config_password",
  LEGACY_PROVIDER_FILTER: "config_provider_filter",
  LEGACY_CACHE_DATA: "cache_9router_data",
  LEGACY_CACHE_TIME: "cache_9router_timestamp",
};

function cacheKey(instanceId: string): string {
  return `cache_9router_${instanceId}`;
}

function cacheTimeKey(instanceId: string): string {
  return `cache_9router_${instanceId}_timestamp`;
}

function cacheErrorKey(instanceId: string): string {
  return `cache_9router_${instanceId}_refresh_error`;
}

function normalizeInstance(instance: Omit<InstanceConfig, "id"> & { id?: string }): InstanceConfig {
  return {
    id: instance.id || randomUUID(),
    name: instance.name.trim(),
    baseUrl: instance.baseUrl.trim().replace(/\/+$/, ""),
    password: instance.password,
    providerFilter: instance.providerFilter.trim().toLowerCase() || "all",
  };
}

function legacyInstanceName(baseUrl: string): string {
  try {
    return new URL(baseUrl).hostname || baseUrl;
  } catch {
    return baseUrl;
  }
}

export async function getInstances(): Promise<InstanceConfig[]> {
  const rawInstances = await LocalStorage.getItem<string>(STORAGE_KEYS.INSTANCES);
  if (rawInstances !== undefined) {
    try {
      const instances = JSON.parse(rawInstances) as InstanceConfig[];
      return Array.isArray(instances) ? instances.map(normalizeInstance) : [];
    } catch {
      return [];
    }
  }

  const preferences = getPreferenceValues<{ baseUrl?: string; password?: string; providerFilter?: string }>();
  const [storedBaseUrl, storedPassword, storedProviderFilter, legacyData, legacyTimestamp] = await Promise.all([
    LocalStorage.getItem<string>(STORAGE_KEYS.LEGACY_BASE_URL),
    LocalStorage.getItem<string>(STORAGE_KEYS.LEGACY_PASSWORD),
    LocalStorage.getItem<string>(STORAGE_KEYS.LEGACY_PROVIDER_FILTER),
    LocalStorage.getItem<string>(STORAGE_KEYS.LEGACY_CACHE_DATA),
    LocalStorage.getItem<number>(STORAGE_KEYS.LEGACY_CACHE_TIME),
  ]);
  const baseUrl = (storedBaseUrl ?? preferences.baseUrl ?? "").trim().replace(/\/+$/, "");
  const password = storedPassword ?? preferences.password ?? "";
  const providerFilter = storedProviderFilter ?? preferences.providerFilter ?? "all";
  const instances = baseUrl && password
    ? [normalizeInstance({ name: legacyInstanceName(baseUrl), baseUrl, password, providerFilter })]
    : [];

  await LocalStorage.setItem(STORAGE_KEYS.INSTANCES, JSON.stringify(instances));
  if (instances.length === 1 && legacyData) {
    await Promise.all([
      LocalStorage.setItem(cacheKey(instances[0].id), legacyData),
      legacyTimestamp === undefined ? Promise.resolve() : LocalStorage.setItem(cacheTimeKey(instances[0].id), legacyTimestamp),
    ]);
  }
  await Promise.all([
    LocalStorage.removeItem(STORAGE_KEYS.LEGACY_BASE_URL),
    LocalStorage.removeItem(STORAGE_KEYS.LEGACY_PASSWORD),
    LocalStorage.removeItem(STORAGE_KEYS.LEGACY_PROVIDER_FILTER),
    LocalStorage.removeItem(STORAGE_KEYS.LEGACY_CACHE_DATA),
    LocalStorage.removeItem(STORAGE_KEYS.LEGACY_CACHE_TIME),
  ]);
  return instances;
}

export async function saveInstance(instance: Omit<InstanceConfig, "id"> & { id?: string }): Promise<InstanceConfig> {
  const next = normalizeInstance(instance);
  const instances = await getInstances();
  const existing = instances.find((item) => item.id === next.id);
  if (existing && (existing.baseUrl !== next.baseUrl || existing.password !== next.password || existing.providerFilter !== next.providerFilter)) {
    await removeInstanceCache(next.id);
  }

  await LocalStorage.setItem(
    STORAGE_KEYS.INSTANCES,
    JSON.stringify(existing ? instances.map((item) => item.id === next.id ? next : item) : [...instances, next]),
  );
  return next;
}

export async function deleteInstance(instanceId: string): Promise<void> {
  const instances = await getInstances();
  await LocalStorage.setItem(STORAGE_KEYS.INSTANCES, JSON.stringify(instances.filter((instance) => instance.id !== instanceId)));
  await removeInstanceCache(instanceId);
}

export async function getCachedData(instanceId: string): Promise<InstanceCache> {
  const [rawData, timestamp, refreshError] = await Promise.all([
    LocalStorage.getItem<string>(cacheKey(instanceId)),
    LocalStorage.getItem<number>(cacheTimeKey(instanceId)),
    LocalStorage.getItem<string>(cacheErrorKey(instanceId)),
  ]);
  if (!rawData) return { data: null, timestamp: null, refreshError: refreshError ?? null };
  try {
    return { data: JSON.parse(rawData) as TrackerData, timestamp: timestamp ?? null, refreshError: refreshError ?? null };
  } catch {
    return { data: null, timestamp: null, refreshError: refreshError ?? null };
  }
}

export async function setCachedData(instanceId: string, data: TrackerData): Promise<number> {
  const timestamp = Date.now();
  await Promise.all([
    LocalStorage.setItem(cacheKey(instanceId), JSON.stringify(data)),
    LocalStorage.setItem(cacheTimeKey(instanceId), timestamp),
    LocalStorage.removeItem(cacheErrorKey(instanceId)),
  ]);
  return timestamp;
}

export async function setRefreshError(instanceId: string, error: string | null): Promise<void> {
  if (error) await LocalStorage.setItem(cacheErrorKey(instanceId), error);
  else await LocalStorage.removeItem(cacheErrorKey(instanceId));
}

export async function removeInstanceCache(instanceId: string): Promise<void> {
  await Promise.all([
    LocalStorage.removeItem(cacheKey(instanceId)),
    LocalStorage.removeItem(cacheTimeKey(instanceId)),
    LocalStorage.removeItem(cacheErrorKey(instanceId)),
  ]);
}
