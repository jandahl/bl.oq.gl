import { test, expect } from "@playwright/test";
import { bootFixtureApp } from "./fixture-boot.js";

test.beforeEach(async ({ page }) => { await bootFixtureApp(page); });

test("stepper retains zero stages and supports keyboard navigation", async ({ page }) => {
	await page.goto("/?chain=qimmeq%2CN_ABS_SG");
	await page.locator("#visualization-view").selectOption("stepper");
	await expect(page.locator("[data-stage]")).toHaveCount(2);
	await expect(page.locator("[data-stage]").last()).toContainText("Ø");
	await page.getByRole("button", { name: "Previous stage", exact: true }).focus();
	await page.keyboard.press("Enter");
	await expect(page.locator("[data-stage]").first()).toHaveAttribute("aria-pressed", "true");
	await expect(page.getByRole("button", { name: "Previous stage", exact: true })).toBeDisabled();
	await page.getByRole("button", { name: "Next stage", exact: true }).click();
	await expect(page.locator("[data-stage]").last()).toHaveAttribute("aria-pressed", "true");
	await page.setViewportSize({ width: 360, height: 800 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("node graph edits and selection share the card/Blockly chain", async ({ page }) => {
	await page.goto("/?chain=qimmeq%2CN_qaq_Vb%2CV_IND_INTR_1SG");
	await page.locator("#visualization-view").selectOption("ports");
	await expect(page.locator(".port-node")).toHaveCount(3);
	await page.locator("[data-select-node]").last().click();
	await expect(page.locator(".port-detail")).toContainText("V_IND_INTR_1SG");
	await page.locator(".port-node").last().getByRole("button", { name: "Remove", exact: true }).click();
	await expect(page.locator(".port-node")).toHaveCount(2);
	await page.locator("#visualization-view").selectOption("cards");
	await expect(page.locator(".slot-card")).toHaveCount(2);
	await page.setViewportSize({ width: 360, height: 800 });
	await page.locator("#visualization-view").selectOption("ports");
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("tree uses engine connections and aligns selected expression coverage", async ({ page }) => {
	await page.goto("/?chain=qimmeq%2CN_qaq_Vb%2CV_IND_INTR_1SG");
	await page.locator("#visualization-view").selectOption("tree");
	await expect(page.locator(".derivation-node")).toHaveCount(5);
	await expect(page.locator(".derivation-board path")).toHaveCount(4);
	await page.locator('.derivation-node[data-node="d-1"]').click();
	await expect(page.locator(".tree-surface .is-selected")).toHaveCount(2);
	await page.locator(".semantic-evidence summary").click();
	await expect(page.locator(".semantic-evidence")).toContainText("not certified");
	await page.setViewportSize({ width: 360, height: 800 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("zero-surface endings remain a column with no invented span", async ({ page }) => {
	await page.goto("/?chain=qimmeq%2CN_ABS_SG");
	await page.locator("#visualization-view").selectOption("interlinear");
	await expect(page.locator(".interlinear-table button").last()).toHaveText("Ø");
	await expect(page.locator(".interlinear-table tbody tr").nth(1).locator("td").last()).toContainText("no written span");
});

test("interlinear selection highlights aligned tiers and supports narrow layouts", async ({ page }) => {
	await page.goto("/?chain=qimmeq%2CN_qaq_Vb%2CV_IND_INTR_1SG");
	await page.locator("#visualization-view").selectOption("interlinear");
	await expect(page.locator(".interlinear-table tbody tr")).toHaveCount(4);
	await page.locator(".interlinear-table button").nth(1).click();
	await expect(page.locator(".interlinear-table td.is-selected")).toHaveCount(4);
	await expect(page.locator(".card-palette")).toBeHidden();
	await page.setViewportSize({ width: 360, height: 800 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
test("slot palette builds, removes and shares the same chain as Blockly", async ({ page }) => {
	await page.locator("#visualization-view").selectOption("cards");
	await expect(page.locator("#blockly-div")).toBeHidden();
	await page.locator("#card-palette-filter").fill("qimmeq");
	await page.locator(".palette-entries button").first().click();
	await expect(page.locator(".slot-card")).toHaveCount(1);
	await expect(page).toHaveURL(/chain=qimmeq/);
	await page.locator("#visualization-view").selectOption("blockly");
	await expect(page.locator("#blockly-div")).toBeVisible();
	await page.locator("#visualization-view").selectOption("cards");
	await page.locator(".slot-card").getByRole("button", { name: "Remove", exact: true }).click();
	await expect(page.locator(".slot-card")).toHaveCount(0);
});

test("card insertion position and movement preserve order on a narrow screen", async ({ page }) => {
	await page.setViewportSize({ width: 360, height: 800 });
	await page.locator("#visualization-view").selectOption("cards");
	await page.locator("#card-palette-filter").fill("qimmeq");
	await page.locator(".palette-entries button").first().click();
	await page.locator("#card-palette-filter").fill("N_qaq_Vb");
	await page.locator(".palette-entries button").first().click();
	await page.locator("#card-palette-filter").fill("V_ngngit_Vb");
	await page.locator("#card-insert-at").selectOption("1");
	await page.locator(".palette-entries button").first().click();
	await expect(page.locator(".slot-card strong").nth(1)).toHaveText("nngit");
	await page.locator(".slot-card").nth(1).getByRole("button", { name: "Move right", exact: true }).click();
	await expect(page.locator(".slot-card strong").nth(1)).toHaveText("qaq");
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
