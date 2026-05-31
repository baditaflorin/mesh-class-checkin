import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

test("check-in on A appears in 'in class' list on B", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await a.getByRole("button", { name: "✓ check in", exact: true }).click();

    await expect(b.locator(".cls-section").first()).toContainText("alice");
    await expect(b.locator(".cls-status")).toContainText("1/");
  } finally {
    await cleanup();
  }
});

test("capacity 1: second check-in lands on waitlist", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByRole("button", { name: /untitled class/ }).click();
    await a.getByPlaceholder("capacity").fill("1");
    await a.locator(".cls-edit").getByRole("button", { name: "save", exact: true }).click();

    await a.getByPlaceholder("your name").fill("alice");
    await a.getByRole("button", { name: "✓ check in", exact: true }).click();

    await expect(b.locator(".cls-meta-display")).toContainText("capacity 1");

    await b.getByPlaceholder("your name").fill("bob");
    await b.getByRole("button", { name: "✓ check in", exact: true }).click();

    // B's own banner shows it landed on the waitlist (same-peer confirmation).
    await expect(b.locator(".cls-confirmed.cls-waitlist")).toContainText("waitlist #1");

    // Load-bearing cross-peer assertion: bob's over-capacity check-in must
    // propagate to A as a real waitlist roster row (the list the instructor
    // exports), not just bump A's "N waiting" counter. A is the opposite peer
    // from the one that performed the action.
    const aWaitSection = a.locator('section[aria-label="waitlist"]');
    await expect(aWaitSection).toContainText("bob");
    await expect(aWaitSection.locator(".cls-entry.cls-wait")).toHaveCount(1);
    await expect(a.locator(".cls-status")).toContainText("1 waiting");
    // alice (in class) stays the single checked-in attendee on B's view too.
    await expect(b.locator(".cls-status")).toContainText("1/1 in class");
  } finally {
    await cleanup();
  }
});
