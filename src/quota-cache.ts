import type { Config } from "./config";
import { fetch9RouterData } from "./api";
import type { TrackerData } from "./api";

type FetchData = (baseUrl: string, password: string, providerFilter: string) => Promise<TrackerData>;
type CacheData = (data: TrackerData) => Promise<number>;

export async function refreshQuotaCache(
  config: Config,
  cacheData: CacheData,
  fetchData: FetchData = fetch9RouterData,
): Promise<void> {
  if (!config.baseUrl || !config.password) return;

  await cacheData(await fetchData(config.baseUrl, config.password, config.providerFilter));
}
