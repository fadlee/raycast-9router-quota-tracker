import React, { useEffect, useState } from "react";
import { Action, ActionPanel, Alert, confirmAlert, Icon, List, showToast, Toast } from "@raycast/api";
import { deleteInstance, getInstances } from "./config";
import type { InstanceConfig } from "./config";
import { ConfigForm } from "./ConfigForm";

interface InstanceManagerProps {
  onChanged: () => Promise<void>;
}

export function InstanceManager({ onChanged }: InstanceManagerProps) {
  const [instances, setInstances] = useState<InstanceConfig[]>([]);
  const [loading, setLoading] = useState(true);

  async function reload() {
    setInstances(await getInstances());
    setLoading(false);
  }

  useEffect(() => {
    void reload();
  }, []);

  async function remove(instance: InstanceConfig) {
    const confirmed = await confirmAlert({
      title: `Delete ${instance.name}?`,
      message: "This permanently removes the instance, its password, and cached quota data.",
      primaryAction: { title: "Delete Instance", style: Alert.ActionStyle.Destructive },
    });
    if (!confirmed) return;

    await deleteInstance(instance.id);
    await Promise.all([reload(), onChanged()]);
    await showToast({ style: Toast.Style.Success, title: "Instance Deleted", message: instance.name });
  }

  return (
    <List
      isLoading={loading}
      navigationTitle="Manage 9Router Instances"
      actions={
        <ActionPanel>
          <Action.Push title="Add Instance" icon={Icon.Plus} target={<ConfigForm onSaved={async () => { await Promise.all([reload(), onChanged()]); }} />} />
        </ActionPanel>
      }
    >
      {instances.length === 0 && !loading ? (
        <List.EmptyView
          icon={Icon.Gear}
          title="No 9Router Instances"
          description="Add an instance to start tracking quotas."
          actions={<ActionPanel><Action.Push title="Add Instance" target={<ConfigForm onSaved={async () => { await Promise.all([reload(), onChanged()]); }} />} /></ActionPanel>}
        />
      ) : instances.map((instance) => (
        <List.Item
          key={instance.id}
          icon={Icon.Network}
          title={instance.name}
          subtitle={instance.baseUrl}
          accessories={[{ text: instance.providerFilter === "all" ? "All Providers" : instance.providerFilter.toUpperCase() }]}
          actions={
            <ActionPanel>
              <Action.Push title="Edit Instance" icon={Icon.Pencil} target={<ConfigForm instance={instance} onSaved={async () => { await Promise.all([reload(), onChanged()]); }} />} />
              <Action title="Delete Instance" icon={Icon.Trash} style={Action.Style.Destructive} onAction={() => remove(instance)} />
              <Action.Push title="Add Instance" icon={Icon.Plus} target={<ConfigForm onSaved={async () => { await Promise.all([reload(), onChanged()]); }} />} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
