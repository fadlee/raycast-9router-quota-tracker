import { expect, test } from "bun:test";
import { groupConnectionsByProvider } from "./instance-groups";

const connections = [
  { id: "one", provider: "openai" },
  { id: "two", provider: "anthropic" },
  { id: "three", provider: "openai" },
] as never[];

test("groups an instance's connections into sorted provider sections", () => {
  const groups = groupConnectionsByProvider(connections);

  expect(groups.map((group) => group.provider)).toEqual(["ANTHROPIC", "OPENAI"]);
  expect(groups.map((group) => group.connections.map((connection) => connection.id))).toEqual([["two"], ["one", "three"]]);
});
