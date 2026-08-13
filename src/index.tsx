import React, { useCallback, useEffect, useState } from "react";
import { Action, ActionPanel, Color, Icon, List, open, showToast, Toast } from "@raycast/api";
import { fetch9RouterData, getAccountName, getConnectionStatus, getStatusIcon } from "./api";
import type { Connection, TrackerData } from "./api";
import { getCachedData, getInstances, setCachedData, setRefreshError } from "./config";
import type { InstanceConfig } from "./config";
import { InstanceManager } from "./InstanceManager";
import { refreshInstance, refreshInstances } from "./instance-refresh";
import { filterProviderGroups, groupConnectionsByProvider } from "./instance-groups";
import { renderQuotaDetails } from "./quota-detail";

interface InstanceQuotaState {
  instance: InstanceConfig;
  connections: Connection[];
  timestamp: number | null;
  refreshError: string | null;
}

function formatLastUpdated(timestamp: number | null): string {
  if (!timestamp) return "No cached data";
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "Updated just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Updated ${minutes}m ago`;
  return `Updated ${Math.floor(minutes / 60)}h ago`;
}

function sectionSubtitle(state: InstanceQuotaState): string {
  const accountCount = `${state.connections.length} account${state.connections.length === 1 ? "" : "s"}`;
  return state.refreshError
    ? `${accountCount} • ${formatLastUpdated(state.timestamp)} • Refresh failed: ${state.refreshError}`
    : `${accountCount} • ${formatLastUpdated(state.timestamp)}`;
}

export default function Command() {
  const [quotaStates, setQuotaStates] = useState<InstanceQuotaState[]>([]);
  const [loading, setLoading] = useState(true);
  const [isShowingDetail, setIsShowingDetail] = useState(false);
  const [searchText, setSearchText] = useState("");

  const loadCachedStates = useCallback(async (instances?: InstanceConfig[]) => {
    const configuredInstances = instances ?? await getInstances();
    const caches = await Promise.all(configuredInstances.map((instance) => getCachedData(instance.id)));
    setQuotaStates(configuredInstances.map((instance, index) => ({
      instance,
      connections: caches[index].data?.connections ?? [],
      timestamp: caches[index].timestamp,
      refreshError: caches[index].refreshError,
    })));
  }, []);

  const refreshAll = useCallback(async (showFeedback = false) => {
    if (showFeedback) setLoading(true);
    const instances = await getInstances();
    await refreshInstances(instances, { fetchData: fetch9RouterData, setCachedData, setRefreshError });
    await loadCachedStates(instances);
    setLoading(false);
    if (showFeedback) await showToast({ style: Toast.Style.Success, title: "Quotas Refreshed" });
  }, [loadCachedStates]);

  const refreshOne = useCallback(async (instance: InstanceConfig) => {
    setLoading(true);
    const succeeded = await refreshInstance(instance, { fetchData: fetch9RouterData, setCachedData, setRefreshError });
    await loadCachedStates();
    setLoading(false);
    await showToast({
      style: succeeded ? Toast.Style.Success : Toast.Style.Failure,
      title: succeeded ? "Instance Refreshed" : "Failed to Refresh Instance",
      message: instance.name,
    });
  }, [loadCachedStates]);

  useEffect(() => {
    let mounted = true;
    async function initialize() {
      const instances = await getInstances();
      if (!mounted) return;
      await loadCachedStates(instances);
      if (!mounted) return;
      setLoading(false);
      await refreshAll();
    }
    void initialize();
    return () => { mounted = false; };
  }, [loadCachedStates, refreshAll]);

  const refreshAfterConfiguration = useCallback(async () => {
    await refreshAll();
  }, [refreshAll]);

  if (quotaStates.length === 0 && !loading) {
    return (
      <List
        actions={<ActionPanel><Action.Push title="Manage Instances" icon={Icon.Gear} target={<InstanceManager onChanged={refreshAfterConfiguration} />} /></ActionPanel>}
      >
        <List.EmptyView
          icon={Icon.Gear}
          title="No 9Router Instances"
          description="Add an instance to start tracking quotas."
          actions={<ActionPanel><Action.Push title="Manage Instances" target={<InstanceManager onChanged={refreshAfterConfiguration} />} /></ActionPanel>}
        />
      </List>
    );
  }

  return (
    <List isLoading={loading} isShowingDetail={isShowingDetail && quotaStates.some((state) => state.connections.length > 0)} filtering={false} onSearchTextChange={setSearchText}>
      {quotaStates.flatMap((state) => {
        if (state.connections.length === 0) {
          return (
            <List.Section key={state.instance.id} title={state.instance.name} subtitle={sectionSubtitle(state)}>
              <List.Item
                icon={state.refreshError ? Icon.ExclamationMark : Icon.Info}
                title={state.refreshError ? "Unable to load quota data" : "No provider accounts found"}
                subtitle={state.refreshError ?? "Check this instance's provider filter."}
                actions={<ActionPanel><Action title="Refresh This Instance" icon={Icon.ArrowClockwise} onAction={() => refreshOne(state.instance)} /><Action title="Refresh All Instances" icon={Icon.ArrowClockwise} shortcut={{ modifiers: ["cmd"], key: "r" }} onAction={() => refreshAll(true)} /><Action.Push title="Manage Instances" icon={Icon.Gear} target={<InstanceManager onChanged={refreshAfterConfiguration} />} /></ActionPanel>}
              />
            </List.Section>
          );
        }

        return filterProviderGroups(groupConnectionsByProvider(state.connections), searchText, state.instance.name).map((group) => (
          <List.Section key={`${state.instance.id}:${group.provider}`} title={`${state.instance.name} / ${group.provider}`} subtitle={`${group.connections.length} account${group.connections.length === 1 ? "" : "s"} • ${sectionSubtitle(state)}`}>
            {group.connections.map((connection) => {
              const title = getAccountName(connection as unknown as Record<string, unknown>);
              const status = getConnectionStatus(connection);
              const quotaSummary = connection.quotas.slice(0, 2).map((quota) => `${quota.shortLabel}: ${quota.remaining}/${quota.total}`).join(" • ") || status;
              return (
                <List.Item
                  key={`${state.instance.id}:${connection.id}`}
                  icon={connection.isActive ? { source: getStatusIcon(connection.minPercent) } : { source: Icon.Circle, tintColor: Color.SecondaryText }}
                  title={title}
                  subtitle={isShowingDetail ? undefined : quotaSummary}
                  accessories={isShowingDetail ? undefined : [
                    { tag: { value: connection.minPercent === null ? "-" : `${Math.round(connection.minPercent)}%`, color: !connection.isActive || connection.minPercent === null ? Color.SecondaryText : connection.minPercent <= 10 ? Color.Red : connection.minPercent <= 35 ? Color.Yellow : Color.Green } },
                    { tag: { value: status, color: connection.isActive ? Color.Green : Color.SecondaryText } },
                    ...(connection.nearestReset ? [{ icon: Icon.Clock, text: connection.nearestReset, tooltip: "Reset Time" }] : []),
                  ]}
                  detail={<List.Item.Detail markdown={renderQuotaDetails({ quotas: connection.quotas, errorMessage: connection.errorMessage })} metadata={<List.Item.Detail.Metadata><List.Item.Detail.Metadata.Label title="Instance" text={state.instance.name} /><List.Item.Detail.Metadata.Label title="Account ID" text={connection.id} /><List.Item.Detail.Metadata.Label title="Provider" text={connection.provider.toUpperCase()} /><List.Item.Detail.Metadata.Label title="Last Updated" text={formatLastUpdated(state.timestamp)} /></List.Item.Detail.Metadata>} />}
                  actions={<ActionPanel><Action title={isShowingDetail ? "Hide Details" : "Show Details"} icon={Icon.Sidebar} onAction={() => setIsShowingDetail((value) => !value)} /><Action title="Refresh This Instance" icon={Icon.ArrowClockwise} onAction={() => refreshOne(state.instance)} /><Action title="Refresh All Instances" icon={Icon.ArrowClockwise} shortcut={{ modifiers: ["cmd"], key: "r" }} onAction={() => refreshAll(true)} /><Action title="Open 9Router Dashboard" icon={Icon.Globe} shortcut={{ modifiers: ["cmd"], key: "o" }} onAction={() => open(state.instance.baseUrl)} /><Action.Push title="Manage Instances" icon={Icon.Gear} shortcut={{ modifiers: ["cmd", "shift"], key: "," }} target={<InstanceManager onChanged={refreshAfterConfiguration} />} /></ActionPanel>}
                />
              );
            })}
          </List.Section>
        ));
      })}
    </List>
  );
}
