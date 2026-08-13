import { getInstances, setCachedData, setRefreshError } from "./config";
import { fetch9RouterData } from "./api";
import { refreshInstances } from "./instance-refresh";

export default async function BackgroundRefreshCommand(): Promise<void> {
  await refreshInstances(await getInstances(), { fetchData: fetch9RouterData, setCachedData, setRefreshError });
}
