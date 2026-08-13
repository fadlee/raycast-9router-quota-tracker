import { expect, test } from "bun:test";
import { refreshQuotaCache } from "./quota-cache";

const config = {
  baseUrl: "https://router.example",
  password: "secret",
  providerFilter: "all",
};

test("fetches quota data and updates the shared cache", async () => {
  const data = { connections: [], providers: [] };
  const fetchedWith: unknown[][] = [];
  const cached: unknown[] = [];

  await refreshQuotaCache(config, async (value) => {
    cached.push(value);
    return Date.now();
  }, async (...args) => {
    fetchedWith.push(args);
    return data;
  });

  expect(fetchedWith).toEqual([[config.baseUrl, config.password, config.providerFilter]]);
  expect(cached).toEqual([data]);
});

test("does not request or overwrite cache without a complete configuration", async () => {
  const called: string[] = [];

  await refreshQuotaCache({ ...config, password: "" }, async () => {
    called.push("cache");
    return Date.now();
  }, async () => {
    called.push("fetch");
    return { connections: [], providers: [] };
  });

  expect(called).toEqual([]);
});
