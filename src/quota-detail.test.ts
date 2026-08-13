import { expect, test } from "bun:test";
import { renderQuotaDetails } from "./quota-detail";

test("renders quota details without a duplicate account heading or availability columns", () => {
  const detail = renderQuotaDetails({
    quotas: [{ shortLabel: "Claude Opus", used: "0", total: "1000", remaining: "1000", reset: "in 6d", extra: "", remainingPercent: 100 }],
  });

  expect(detail).toContain("| Quota | Usage | Reset |");
  expect(detail).toContain("| **Claude Opus** | 0 / 1000 | in 6d |");
  expect(detail).not.toContain("# account@example.com");
  expect(detail).not.toContain("| Status |");
  expect(detail).not.toContain("| Remaining |");
});
