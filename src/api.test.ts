import { expect, test } from "bun:test";
import { getConnectionStatus } from "./api";

test("uses 9Router isActive as the account availability source", () => {
  expect(getConnectionStatus({ isActive: false })).toEqual("Inactive");
  expect(getConnectionStatus({ isActive: true })).toEqual("Active");
  expect(getConnectionStatus({})).toEqual("Active");
});
