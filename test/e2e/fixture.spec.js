// @ts-check
import { test, expect } from "@playwright/test";
import { bootFixtureApp } from "./fixture-boot.js";

test.beforeEach(async ({ page }) => {
	page.on("pageerror", (err) => {
		throw new Error(`Unexpected uncaught page error: ${err.message}`);
	});
	await bootFixtureApp(page);
});

test("fixture catalog loads without hitting live hosts", async ({ page }) => {
	const text = await page.locator("#status-line").textContent();
	expect(text).toMatch(/Loaded \d+ morphemes/);
	const count = Number(/Loaded (\d+)/.exec(text)?.[1] || 0);
	expect(count).toBeGreaterThanOrEqual(5);
	expect(count).toBeLessThan(100);
});

test("fixture boot: examples frame and empty canvas hint render", async ({ page }) => {
	await expect(page.locator("#example-words [data-examples-open]")).toBeVisible();
	await expect(page.locator('#example-words [data-examples-tab="words"]')).toBeVisible();
	await expect(page.locator("#status-line")).toContainText("Loaded");
	await page.locator("#clear-canvas-btn").click();
	await expect(page.locator("#status-line")).toContainText(/Drag a morpheme|Træk et morfem/i);
});

test("fixture boot: palette hide/show does not throw", async ({ page }) => {
	const toggle = page.locator("#palette-toggle");
	await toggle.click();
	await expect(toggle).toBeVisible();
	await toggle.click();
	await expect(toggle).toBeVisible();
});

test("fixture boot: filter and clear-canvas controls are present", async ({ page }) => {
	await expect(page.locator("#morpheme-filter")).toBeVisible();
	await expect(page.locator("#blockly-div")).toBeVisible();
	await expect(page.locator("#copy-link-btn")).toBeVisible();
});

test("fixture boot: examples browse modal lists surface+gloss and filters", async ({ page }) => {
	await page.locator('#example-words [data-examples-tab="words"]').click();
	const modal = page.locator("#worked-examples-modal");
	await expect(modal).toBeVisible();
	await expect(modal.locator(".examples-item-surface").first()).toBeVisible();
	await expect(modal.locator("#worked-examples-list button")).toHaveCount(2);
	await modal.locator("#worked-examples-filter").fill("neri");
	await expect(modal.locator("#worked-examples-list button")).toHaveCount(1);
	await expect(modal.locator("#worked-examples-list button")).toContainText("nerivoq");
	await modal.locator("#worked-examples-close").click();
	await expect(modal).toBeHidden();
});
