import { test, expect } from "@playwright/test";
import { bootFixtureApp } from "./fixture-boot.js";

test.beforeEach(async ({ page }) => { await bootFixtureApp(page); });
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
