import { expect, test } from "bun:test";
import { getConnectionStatus, parseResetMs } from "./api";

test("uses 9Router isActive as the account availability source", () => {
  expect(getConnectionStatus({ isActive: false })).toEqual("Inactive");
  expect(getConnectionStatus({ isActive: true })).toEqual("Active");
  expect(getConnectionStatus({})).toEqual("Active");
});

test("parseResetMs normalizes epoch seconds, epoch ms, and ISO strings to ms", () => {
  const epochSec = 1755600000;
  expect(parseResetMs(epochSec)).toEqual(epochSec * 1000);
  expect(parseResetMs(String(epochSec))).toEqual(epochSec * 1000);
  expect(parseResetMs(epochSec * 1000)).toEqual(epochSec * 1000);
  expect(parseResetMs(new Date(epochSec * 1000).toISOString())).toEqual(epochSec * 1000);
  expect(parseResetMs("garbage")).toBeNull();
  expect(parseResetMs(null)).toBeNull();
});
