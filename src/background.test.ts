import { expect, test } from "bun:test";
import { refreshInstance } from "./instance-refresh";

const instance = { id: "personal", name: "Personal", baseUrl: "https://router.example", password: "secret", providerFilter: "all" };

test("clears a previous refresh error when an instance refresh succeeds", async () => {
  const errors: Array<[string, string | null]> = [];

  const succeeded = await refreshInstance(instance, {
    fetchData: async () => ({ connections: [], providers: [] }),
    setCachedData: async () => Date.now(),
    setRefreshError: async (instanceId, error) => errors.push([instanceId, error]),
  });

  expect(succeeded).toBeTrue();
  expect(errors).toEqual([["personal", null]]);
});

test("records an error without overwriting a stale cache when refreshing fails", async () => {
  const writes: string[] = [];
  const errors: Array<[string, string | null]> = [];

  const succeeded = await refreshInstance(instance, {
    fetchData: async () => { throw new Error("Unauthorized"); },
    setCachedData: async () => {
      writes.push("cache");
      return Date.now();
    },
    setRefreshError: async (instanceId, error) => errors.push([instanceId, error]),
  });

  expect(succeeded).toBeFalse();
  expect(writes).toEqual([]);
  expect(errors).toEqual([["personal", "Unauthorized"]]);
});
