import { getAccountName } from "./api";
import type { Connection } from "./api";

export interface ProviderGroup {
  provider: string;
  connections: Connection[];
}

export function groupConnectionsByProvider(connections: Connection[]): ProviderGroup[] {
  const groups = new Map<string, Connection[]>();
  for (const connection of connections) {
    const provider = connection.provider.toUpperCase();
    const group = groups.get(provider);
    if (group) group.push(connection);
    else groups.set(provider, [connection]);
  }
  return Array.from(groups, ([provider, groupedConnections]) => ({ provider, connections: groupedConnections })).sort((left, right) => left.provider.localeCompare(right.provider));
}

export function filterProviderGroups(groups: ProviderGroup[], searchText: string, instanceName = ""): ProviderGroup[] {
  const terms = searchText.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return groups;

  const normalizedInstanceName = instanceName.toLowerCase();
  return groups.flatMap((group) => {
    const connectionTerms = terms.filter((term) => !normalizedInstanceName.includes(term) && !group.provider.toLowerCase().includes(term));
    if (connectionTerms.length === 0) return [group];

    const connections = group.connections.filter((connection) => connectionTerms.every((term) => [
      getAccountName(connection as unknown as Record<string, unknown>),
      connection.email,
      connection.name,
      connection.displayName,
      connection.accountLabel,
      connection.id,
    ].some((value) => value?.toLowerCase().includes(term))));
    return connections.length > 0 ? [{ ...group, connections }] : [];
  });
}
