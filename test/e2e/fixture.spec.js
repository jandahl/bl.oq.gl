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

test("fixture boot: sentences tab tolerates empty standard-examples list", async ({ page }) => {
	await page.locator('#example-words [data-examples-tab="sentences"]').click();
	const modal = page.locator("#worked-examples-modal");
	await expect(modal).toBeVisible();
	await expect(modal.locator("#worked-examples-list button")).toHaveCount(0);
	await expect(modal.locator("#worked-examples-status")).toContainText(/No examples|Ingen eksempler/i);
	await modal.locator("#worked-examples-close").click();
	await expect(modal).toBeHidden();
});

async function bootSlowAnalyze(page) {
	await page.addInitScript(() => {
		globalThis.__BLOQ_SLOW_ANALYZE__ = 600;
	});
	await page.reload();
	await page.waitForFunction(
		() => document.querySelector("#status-line")?.textContent?.includes("Loaded"),
		undefined,
		{ timeout: 15_000 },
	);
}

function canvasBlockCount(page) {
	return page.evaluate(() => Blockly.getMainWorkspace().getAllBlocks(false).length);
}

test("clear canvas cancels an in-flight Deconstruct", async ({ page }) => {
	await bootSlowAnalyze(page);
	await page.locator("#word-input").fill("nerivoq");
	await page.locator("#analyze-btn").click();
	await expect(page.locator("#status-line")).toContainText(/Analyzing|Analyserer/);
	await page.locator("#clear-canvas-btn").click();
	await expect(page.locator("#status-line")).toContainText(/Drag a morpheme|Træk et morfem/i);
	await page.waitForTimeout(900);
	await expect(page.locator("#status-line")).toContainText(/Drag a morpheme|Træk et morfem/i);
	await expect(page).not.toHaveURL(/[?&]w=/);
	expect(await canvasBlockCount(page)).toBe(0);
});

test("empty Deconstruct submit cancels an in-flight analysis", async ({ page }) => {
	await bootSlowAnalyze(page);
	await page.locator("#word-input").fill("nerivoq");
	await page.locator("#analyze-btn").click();
	await expect(page.locator("#status-line")).toContainText(/Analyzing|Analyserer/);
	await page.locator("#word-input").fill("");
	await page.locator("#analyze-btn").click();
	await expect(page.locator("#status-line")).toContainText(/Drag a morpheme|Træk et morfem/i);
	await page.waitForTimeout(900);
	await expect(page.locator("#status-line")).toContainText(/Drag a morpheme|Træk et morfem/i);
	await expect(page).not.toHaveURL(/[?&]w=/);
	expect(await canvasBlockCount(page)).toBe(0);
});
