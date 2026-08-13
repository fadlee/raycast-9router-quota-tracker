import React, { useState, useEffect, useCallback } from "react";
import { List, ActionPanel, Action, Icon, Color, open, showToast, Toast } from "@raycast/api";
import { getConfig, getCachedData, setCachedData, Config } from "./config";
import { fetch9RouterData, Connection, TrackerData, getStatusIcon, getProgressBar, getAccountName } from "./api";
import { ConfigForm } from "./ConfigForm";

function formatLastUpdated(timestamp: number | null): string {
  if (!timestamp) return "";
  const sec = Math.floor((Date.now() - timestamp) / 1000);
  if (sec < 60) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

export default function Command() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [providers, setProviders] = useState<string[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>("all");
  const [isShowingDetail, setIsShowingDetail] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  // Core fetch function
  const refreshData = useCallback(async (showFeedback = false) => {
    if (showFeedback) setLoading(true);
    try {
      const cfg = await getConfig();
      setConfig(cfg);
      if (!cfg.baseUrl || !cfg.password) {
        setConnections([]);
        setLoading(false);
        return;
      }
      const data = await fetch9RouterData(cfg.baseUrl, cfg.password, cfg.providerFilter);
      const ts = await setCachedData<TrackerData>(data);
      setConnections(data.connections);
      setProviders(data.providers);
      setLastUpdated(ts);

      if (showFeedback) {
        await showToast({ style: Toast.Style.Success, title: "Quotas Updated" });
      }
    } catch (err: unknown) {
      if (showFeedback) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to refresh 9Router Quotas",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load: display cached immediately then fetch in background
  useEffect(() => {
    let isMounted = true;
    async function init() {
      const cfg = await getConfig();
      if (!isMounted) return;
      setConfig(cfg);

      // 1. Load cache first for instant display
      const cache = await getCachedData<TrackerData>();
      if (cache.data && isMounted) {
        setConnections(cache.data.connections || []);
        setProviders(cache.data.providers || []);
        setLastUpdated(cache.timestamp);
        setLoading(false);
      }

      // 2. Fetch fresh data in background
      await refreshData(false);
    }
    init();

    return () => {
      isMounted = false;
    };
  }, [refreshData]);

  // Group connections by Provider
  const groupedByProvider: Record<string, Connection[]> = {};
  for (const conn of connections) {
    const prov = conn.provider.toUpperCase();
    if (!groupedByProvider[prov]) groupedByProvider[prov] = [];
    groupedByProvider[prov].push(conn);
  }

  const providerKeys = Object.keys(groupedByProvider).sort();
  const filteredProviders = selectedProvider === "all"
    ? providerKeys
    : providerKeys.filter((p) => p.toLowerCase() === selectedProvider.toLowerCase());

  const lastUpdatedText = formatLastUpdated(lastUpdated);

  if (!config?.baseUrl || !config?.password) {
    return (
      <List
        actions={
          <ActionPanel>
            <Action.Push
              title="Configure 9Router Settings"
              target={
                <ConfigForm
                  currentConfig={config || { baseUrl: "", password: "", providerFilter: "all" }}
                  availableProviders={providers}
                  onConfigSaved={() => refreshData(true)}
                />
              }
            />
          </ActionPanel>
        }
      >
        <List.EmptyView
          icon={Icon.Gear}
          title="9Router Not Configured"
          description="Press Enter to configure Base URL and Password"
          actions={
            <ActionPanel>
              <Action.Push
                title="Configure 9Router Settings"
                target={
                  <ConfigForm
                    currentConfig={config || { baseUrl: "", password: "", providerFilter: "all" }}
                    availableProviders={providers}
                    onConfigSaved={() => refreshData(true)}
                  />
                }
              />
            </ActionPanel>
          }
        />
      </List>
    );
  }

  return (
    <List
      isLoading={loading}
      isShowingDetail={isShowingDetail && connections.length > 0}
      searchBarAccessory={
        <List.Dropdown
          tooltip="Filter by Provider"
          value={selectedProvider}
          onChange={setSelectedProvider}
        >
          <List.Dropdown.Item title="All Providers" value="all" />
          {providers.map((p) => (
            <List.Dropdown.Item key={p} title={p.toUpperCase()} value={p} />
          ))}
        </List.Dropdown>
      }
    >
      {filteredProviders.length === 0 && !loading ? (
        <List.EmptyView
          icon={Icon.Info}
          title="No Provider Accounts Found"
          description="Check your filter settings or 9Router configuration."
          actions={
            <ActionPanel>
              <Action title="Refresh Now" onAction={() => refreshData(true)} icon={Icon.ArrowClockwise} />
              <Action.Push
                title="Configure Settings"
                icon={Icon.Gear}
                target={
                  <ConfigForm
                    currentConfig={config}
                    availableProviders={providers}
                    onConfigSaved={() => refreshData(true)}
                  />
                }
              />
            </ActionPanel>
          }
        />
      ) : (
        filteredProviders.map((provName) => {
          const providerConnections = groupedByProvider[provName];
          return (
            <List.Section
              key={provName}
              title={provName}
              subtitle={`${providerConnections.length} account${providerConnections.length > 1 ? "s" : ""}${lastUpdatedText ? `  •  Updated ${lastUpdatedText}` : ""}`}
            >
              {providerConnections.map((conn) => {
                const title = getAccountName(conn as unknown as Record<string, unknown>);
                const statusIcon = getStatusIcon(conn.minPercent);
                const displayStatus = conn.disabled ? "Disabled" : conn.errorStatus ? "Error" : conn.status || "Active";
                const statusColor =
                  conn.disabled || conn.errorStatus
                    ? Color.Red
                    : displayStatus.toLowerCase() === "active"
                    ? Color.Green
                    : Color.Yellow;

                const quotaSummaries = conn.quotas
                  .slice(0, 2)
                  .map((q) => `${q.shortLabel}: ${q.remaining}/${q.total}`)
                  .join("  •  ");

                const subtitle = quotaSummaries || displayStatus;
                return (
                  <List.Item
                    key={conn.id}
                    icon={{ source: statusIcon }}
                    title={title}
                    subtitle={!isShowingDetail ? subtitle : undefined}
                    accessories={
                      !isShowingDetail
                        ? [
                            {
                              tag: {
                                value: conn.minPercent !== null ? `${Math.round(conn.minPercent)}%` : "-",
                                color:
                                  conn.minPercent === null
                                    ? Color.SecondaryText
                                    : conn.minPercent <= 10
                                    ? Color.Red
                                    : conn.minPercent <= 35
                                    ? Color.Yellow
                                    : Color.Green,
                              },
                            },
                            {
                              tag: {
                                value: displayStatus,
                                color: statusColor,
                              },
                            },
                            ...(conn.nearestReset ? [{ icon: Icon.Clock, text: conn.nearestReset, tooltip: "Reset Time" }] : []),
                          ]
                        : undefined
                    }
                    detail={
                      <List.Item.Detail
                        markdown={`# ${title} (${conn.provider.toUpperCase()})\n\n` +
                          (conn.errorMessage
                            ? `> ⚠️ **Error:** ${conn.errorMessage}\n\n`
                            : conn.quotas.length === 0
                            ? "*No quota data available*"
                            : `| Quota | Status | Used / Total | Remaining | Reset |\n| --- | --- | --- | --- | --- |\n` +
                              conn.quotas
                                .map(
                                  (q) =>
                                    `| **${q.shortLabel}** | ${getStatusIcon(q.remainingPercent)} ${q.remainingPercent === null ? "-" : `${Math.round(q.remainingPercent)}%`} | ${q.used} / ${q.total} | ${q.remaining}${q.extra} | ${q.reset} |`
                                )
                                .join("\n")
                          )}
                        metadata={
                          <List.Item.Detail.Metadata>
                            <List.Item.Detail.Metadata.Label title="Account ID" text={conn.id} />
                            <List.Item.Detail.Metadata.Label title="Provider" text={conn.provider.toUpperCase()} />
                            <List.Item.Detail.Metadata.TagList title="Status">
                              <List.Item.Detail.Metadata.TagList.Item
                                text={conn.disabled ? "Disabled" : conn.errorStatus ? "Error" : "Active"}
                                color={conn.disabled || conn.errorStatus ? Color.Red : Color.Green}
                              />
                            </List.Item.Detail.Metadata.TagList>
                            {conn.nearestReset && (
                              <List.Item.Detail.Metadata.Label title="Next Reset" text={conn.nearestReset} icon={Icon.Clock} />
                            )}
                            {lastUpdatedText && (
                              <List.Item.Detail.Metadata.Label title="Last Updated" text={lastUpdatedText} />
                            )}
                          </List.Item.Detail.Metadata>
                        }
                      />
                    }
                    actions={
                      <ActionPanel>
                        <Action
                          title={isShowingDetail ? "Hide Deep Dive Details" : "Show Deep Dive Details"}
                          icon={Icon.Sidebar}
                          onAction={() => setIsShowingDetail(!isShowingDetail)}
                        />
                        <Action
                          title="Refresh Quotas (Manual)"
                          icon={Icon.ArrowClockwise}
                          shortcut={{ modifiers: ["cmd"], key: "r" }}
                          onAction={() => refreshData(true)}
                        />
                        <Action
                          title="Open 9Router Dashboard"
                          icon={Icon.Globe}
                          shortcut={{ modifiers: ["cmd"], key: "o" }}
                          onAction={() => open(config.baseUrl)}
                        />
                        <Action.Push
                          title="Configure Settings"
                          icon={Icon.Gear}
                          shortcut={{ modifiers: ["cmd", "shift"], key: "," }}
                          target={
                            <ConfigForm
                              currentConfig={config}
                              availableProviders={providers}
                              onConfigSaved={() => refreshData(true)}
                            />
                          }
                        />
                      </ActionPanel>
                    }
                  />
                );
              })}
            </List.Section>
          );
        })
      )}
    </List>
  );
}
