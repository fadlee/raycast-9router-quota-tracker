import React, { useState, useEffect } from "react";
import { Form, ActionPanel, Action, useNavigation, showToast, Toast } from "@raycast/api";
import { Config, saveConfig } from "./config";

interface ConfigFormProps {
  currentConfig: Config;
  availableProviders?: string[];
  onConfigSaved: () => void;
}

export function ConfigForm({ currentConfig, availableProviders = [], onConfigSaved }: ConfigFormProps) {
  const { pop } = useNavigation();
  const [baseUrl, setBaseUrl] = useState(currentConfig.baseUrl);
  const [password, setPassword] = useState(currentConfig.password);
  const [providerFilter, setProviderFilter] = useState(currentConfig.providerFilter || "all");

  const providerOptions = Array.from(new Set(["all", ...availableProviders]));
  if (!providerOptions.includes(providerFilter)) {
    providerOptions.push(providerFilter);
  }

  async function handleSubmit() {
    if (!baseUrl.trim()) {
      await showToast({ style: Toast.Style.Failure, title: "Base URL is required" });
      return;
    }
    if (!password) {
      await showToast({ style: Toast.Style.Failure, title: "Password is required" });
      return;
    }

    try {
      await saveConfig({
        baseUrl,
        password,
        providerFilter,
      });
      await showToast({ style: Toast.Style.Success, title: "Configuration Saved" });
      onConfigSaved();
      pop();
    } catch (err: unknown) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to save config",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Configuration" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="baseUrl"
        title="9Router Base URL"
        placeholder="http://localhost:3000"
        value={baseUrl}
        onChange={setBaseUrl}
        info="The base URL of your 9Router server instance"
      />
      <Form.PasswordField
        id="password"
        title="Password"
        placeholder="9Router Password"
        value={password}
        onChange={setPassword}
        info="Password to log in to 9Router API"
      />
      <Form.Dropdown
        id="providerFilter"
        title="Provider Filter"
        value={providerFilter}
        onChange={setProviderFilter}
        info="Filter quota list by provider"
      >
        {providerOptions.map((prov) => (
          <Form.Dropdown.Item key={prov} value={prov} title={prov === "all" ? "All Providers" : prov.toUpperCase()} />
        ))}
      </Form.Dropdown>
    </Form>
  );
}
