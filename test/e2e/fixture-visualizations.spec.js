import { test, expect } from "@playwright/test";
import { bootFixtureApp } from "./fixture-boot.js";

test.beforeEach(async ({ page }) => { await bootFixtureApp(page); });

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
