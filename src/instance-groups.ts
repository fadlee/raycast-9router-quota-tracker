import type { Connection } from "./api";

export function groupConnectionsByProvider(connections: Connection[]): Array<{ provider: string; connections: Connection[] }> {
  const groups = new Map<string, Connection[]>();
  for (const connection of connections) {
    const provider = connection.provider.toUpperCase();
    const group = groups.get(provider);
    if (group) group.push(connection);
    else groups.set(provider, [connection]);
  }
  return Array.from(groups, ([provider, groupedConnections]) => ({ provider, connections: groupedConnections })).sort((left, right) => left.provider.localeCompare(right.provider));
}
