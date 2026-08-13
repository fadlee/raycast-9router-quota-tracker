import { getConfig, setCachedData } from "./config";
import { refreshQuotaCache } from "./quota-cache";

export default async function BackgroundRefreshCommand(): Promise<void> {
  await refreshQuotaCache(await getConfig(), setCachedData);
}
