import { fetch9RouterData } from "./api";
import type { TrackerData } from "./api";
import type { InstanceConfig } from "./config";

type RefreshDependencies = {
  fetchData: (baseUrl: string, password: string, providerFilter: string) => Promise<TrackerData>;
  setCachedData: (instanceId: string, data: TrackerData) => Promise<number>;
  setRefreshError: (instanceId: string, error: string | null) => Promise<void>;
};

export async function refreshInstances(instances: InstanceConfig[], dependencies: RefreshDependencies): Promise<void> {
  await Promise.all(instances.map(async (instance) => {
    try {
      const data = await dependencies.fetchData(instance.baseUrl, instance.password, instance.providerFilter);
      await Promise.all([
        dependencies.setCachedData(instance.id, data),
        dependencies.setRefreshError(instance.id, null),
      ]);
    } catch (error) {
      await dependencies.setRefreshError(instance.id, error instanceof Error ? error.message : String(error));
    }
  }));
}

export async function refreshInstance(instance: InstanceConfig, dependencies: Omit<RefreshDependencies, "setRefreshError"> & Partial<Pick<RefreshDependencies, "setRefreshError">>): Promise<boolean> {
  try {
    const data = await dependencies.fetchData(instance.baseUrl, instance.password, instance.providerFilter);
    await dependencies.setCachedData(instance.id, data);
    if (dependencies.setRefreshError) await dependencies.setRefreshError(instance.id, null);
    return true;
  } catch (error) {
    if (dependencies.setRefreshError) await dependencies.setRefreshError(instance.id, error instanceof Error ? error.message : String(error));
    return false;
  }
}

