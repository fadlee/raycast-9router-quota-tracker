import { expect, test } from "bun:test";
import { refreshInstances } from "./instance-refresh";

const instances = [
  { id: "personal", name: "Personal", baseUrl: "https://personal.example", password: "one", providerFilter: "all" },
  { id: "work", name: "Work", baseUrl: "https://work.example", password: "two", providerFilter: "openai" },
];

test("refreshes every instance and records each successful result", async () => {
  const cached: string[] = [];
  const errors: string[] = [];

  await refreshInstances(instances, {
    fetchData: async (baseUrl) => ({ connections: [], providers: [baseUrl] }),
    setCachedData: async (instanceId) => {
      cached.push(instanceId);
      return Date.now();
    },
    setRefreshError: async (instanceId) => errors.push(instanceId),
  });
  expect(cached.sort()).toEqual(["personal", "work"]);
  expect(errors.sort()).toEqual(["personal", "work"]);
});

test("keeps other instance caches usable when one refresh fails", async () => {
  const cached: string[] = [];
  const errors: Array<[string, string]> = [];

  await refreshInstances(instances, {
    fetchData: async (baseUrl) => {
      if (baseUrl.includes("work")) throw new Error("Unauthorized");
      return { connections: [], providers: [] };
    },
    setCachedData: async (instanceId) => {
      cached.push(instanceId);
      return Date.now();
    },
    setRefreshError: async (instanceId, error) => errors.push([instanceId, error]),
  });

  expect(cached).toEqual(["personal"]);
  expect(errors).toEqual([["personal", null], ["work", "Unauthorized"]]);
});
