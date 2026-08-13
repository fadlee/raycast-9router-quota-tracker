import { expect, test } from "bun:test";
import { filterProviderGroups, groupConnectionsByProvider } from "./instance-groups";

const connections = [
  { id: "one", provider: "openai", email: "one@example.com" },
  { id: "two", provider: "antigravity", email: "two@example.com" },
  { id: "three", provider: "openai", email: "three@example.com" },
] as never[];

test("groups an instance's connections into sorted provider sections", () => {
  const groups = groupConnectionsByProvider(connections);

  expect(groups.map((group) => group.provider)).toEqual(["ANTIGRAVITY", "OPENAI"]);
  expect(groups.map((group) => group.connections.map((connection) => connection.id))).toEqual([["two"], ["one", "three"]]);
});

test("shows every account under a provider when the query matches that provider", () => {
  const groups = filterProviderGroups(groupConnectionsByProvider(connections), "openai");

  expect(groups.map((group) => group.provider)).toEqual(["OPENAI"]);
  expect(groups[0].connections.map((connection) => connection.id)).toEqual(["one", "three"]);
});

test("filters account matches without showing unrelated accounts in the provider", () => {
  const groups = filterProviderGroups(groupConnectionsByProvider(connections), "three@example.com");

  expect(groups.map((group) => group.provider)).toEqual(["OPENAI"]);
  expect(groups[0].connections.map((connection) => connection.id)).toEqual(["three"]);
});

test("shows every provider group when the instance name matches", () => {
  const groups = filterProviderGroups(groupConnectionsByProvider(connections), "work", "Work Router");

  expect(groups.map((group) => group.provider)).toEqual(["ANTIGRAVITY", "OPENAI"]);
  expect(groups.flatMap((group) => group.connections.map((connection) => connection.id))).toEqual(["two", "one", "three"]);
});

test("matches compound instance and provider terms", () => {
  const groups = filterProviderGroups(groupConnectionsByProvider(connections), "work openai", "Work Router");

  expect(groups.map((group) => group.provider)).toEqual(["OPENAI"]);
  expect(groups[0].connections.map((connection) => connection.id)).toEqual(["one", "three"]);
});
