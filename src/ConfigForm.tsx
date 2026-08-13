import React from "react";
import { Action, ActionPanel, Form, showToast, Toast, useNavigation } from "@raycast/api";
import { FormValidation, useForm } from "@raycast/utils";
import { saveInstance } from "./config";
import type { InstanceConfig } from "./config";

interface ConfigFormProps {
  instance?: InstanceConfig;
  onSaved: () => Promise<void>;
}

type InstanceFormValues = Omit<InstanceConfig, "id">;

export function ConfigForm({ instance, onSaved }: ConfigFormProps) {
  const { pop } = useNavigation();
  const { handleSubmit, itemProps } = useForm<InstanceFormValues>({
    initialValues: instance ?? { name: "", baseUrl: "", password: "", providerFilter: "all" },
    validation: {
      name: FormValidation.Required,
      baseUrl: FormValidation.Required,
      password: FormValidation.Required,
    },
    async onSubmit(values) {
      try {
        await saveInstance({ ...values, id: instance?.id });
        await onSaved();
        await showToast({ style: Toast.Style.Success, title: instance ? "Instance Updated" : "Instance Added" });
        pop();
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to save instance",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
  });

  return (
    <Form
      navigationTitle={instance ? "Edit 9Router Instance" : "Add 9Router Instance"}
      actions={<ActionPanel><Action.SubmitForm title={instance ? "Save Instance" : "Add Instance"} onSubmit={handleSubmit} /></ActionPanel>}
    >
      <Form.TextField title="Instance Name" placeholder="Personal" info="A label shown above this instance's quotas" {...itemProps.name} />
      <Form.TextField title="9Router Base URL" placeholder="http://localhost:3000" {...itemProps.baseUrl} />
      <Form.PasswordField title="Password" {...itemProps.password} />
      <Form.TextField title="Provider Filter" placeholder="all" info="Optional provider name, or all" {...itemProps.providerFilter} />
    </Form>
  );
}
