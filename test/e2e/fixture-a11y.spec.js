// @ts-check
import { test, expect } from "@playwright/test";
import { bootFixtureApp } from "./fixture-boot.js";

test.beforeEach(async ({ page }) => {
	await bootFixtureApp(page);
});

test("canvas region and morpheme filter are labelled", async ({ page }) => {
	const canvas = page.locator("#blockly-div");
	await expect(canvas).toHaveAttribute("role", "region");
	await expect(canvas).toHaveAttribute("aria-label", /.+/);
	const filter = page.locator("#morpheme-filter");
	const label = page.locator("label[for='morpheme-filter']");
	await expect(label).toHaveCount(1);
	await expect(filter).toBeVisible();
});

test("palette toggle exposes expanded state", async ({ page }) => {
	const toggle = page.locator("#palette-toggle");
	await expect(toggle).toHaveAttribute("aria-expanded", "true");
	await toggle.click();
	await expect(toggle).toHaveAttribute("aria-expanded", "false");
	await toggle.click();
	await expect(toggle).toHaveAttribute("aria-expanded", "true");
});

test("results and breakdown summaries use i18n labels", async ({ page }) => {
	await expect(page.locator("#results-footer")).toHaveAttribute("aria-label", /Results|Resultater/);
	await expect(page.locator("#results-summary .disclosure-label")).toHaveText(/Results|Resultater/);
});
