// @ts-check
import { test, expect } from "@playwright/test";

async function waitForCatalog(page) {
	await expect(page.locator("#status-line")).not.toContainText("Loading", { timeout: 30_000 });
}

test.beforeEach(async ({ page }) => {
	await page.goto("/");
	await waitForCatalog(page);
});

test("Copy link writes the current share URL to the clipboard", async ({ page, context }) => {
	await context.grantPermissions(["clipboard-read", "clipboard-write"]);
	await page.locator("#example-words [data-example-word=\"nerivugut\"]").click();
	await expect(page.locator("#status-line")).not.toContainText("Analyzing", { timeout: 30_000 });
	await page.getByRole("button", { name: "Copy link" }).click();
	await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
	const text = await page.evaluate(() => window.navigator.clipboard.readText());
	expect(text).toMatch(/[?&](w=nerivugut|chain=)/);
});

test("Clear canvas empties the workspace back to the empty hint", async ({ page }) => {
	await page.locator("#example-words [data-example-word=\"nerivugut\"]").click();
	await expect(page.locator("#status-line")).not.toContainText("Analyzing", { timeout: 30_000 });
	await page.getByRole("button", { name: "Clear canvas" }).click();
	await expect(page.locator("#status-line")).toContainText(/example|morpheme/i);
});

test("examples sit in the Build section above the Blockly canvas", async ({ page }) => {
	const order = await page.evaluate(() => {
		const build = document.querySelector(".build-section");
		const examples = document.querySelector("#example-words");
		const blockly = document.querySelector("#blockly-div");
		if (!build || !examples || !blockly) return "missing";
		if (!build.contains(examples) || !build.contains(blockly)) return "missing";
		const pos = examples.compareDocumentPosition(blockly);
		return (pos & 4)/* DOCUMENT_POSITION_FOLLOWING */ ? "examples-before-blockly" : "wrong-order";
	});
	expect(order).toBe("examples-before-blockly");
});

test("the results drawer layers above the Blockly canvas", async ({ page }) => {
	const layers = await page.evaluate(() => ({
		blockly: Number.parseInt(window.getComputedStyle(document.querySelector("#blockly-div")).zIndex, 10),
		results: Number.parseInt(window.getComputedStyle(document.querySelector("#results-footer")).zIndex, 10),
		widget: Number.parseInt(window.getComputedStyle(document.querySelector(".blocklyWidgetDiv")).zIndex, 10),
	}));
	expect(layers.results).toBeGreaterThan(layers.blockly);
	expect(layers.widget).toBeGreaterThan(layers.results);
});

test("document title stays BLOQ while typing and updates after deconstruct", async ({ page }) => {
	await expect(page).toHaveTitle("BLOQ");
	await page.fill("#word-input", "qimmeqarpunga");
	await expect(page).toHaveTitle("BLOQ");
	await page.getByRole("button", { name: "Deconstruct" }).click();
	await expect(page).toHaveTitle("qimmeqarpunga - BLOQ", { timeout: 20_000 });
});

test("a multi-word input deconstructs each word onto the canvas", async ({ page }) => {
	await page.fill("#word-input", "qimmeqarpunga aallarpoq");
	await page.getByRole("button", { name: "Deconstruct" }).click();
	await expect(page.locator("#word-input")).toHaveValue("qimmeqarpunga aallarpoq");
	await expect(page.locator("#status-line")).toContainText("qimmeqarpunga", { timeout: 30_000 });
	await expect(page.locator("#status-line")).toContainText("aallarpoq");
	await expect(page).toHaveTitle("qimmeqarpunga aallarpoq - BLOQ");
});

test("desktop Blockly uses a tall canvas, not a short 480px strip", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	const box = await page.locator("#blockly-div").boundingBox();
	expect(box).toBeTruthy();
	expect(box.height).toBeGreaterThan(480);
});

test("Clear canvas clears share state so reload stays empty", async ({ page }) => {
	await page.locator("#example-words [data-example-word=\"nerivugut\"]").click();
	await expect(page.locator("#status-line")).not.toContainText("Analyzing", { timeout: 30_000 });
	await expect(page).toHaveURL(/[?&](w=nerivugut|chain=)/);
	await page.getByRole("button", { name: "Clear canvas" }).click();
	await expect(page.locator("#status-line")).toContainText(/example|morpheme/i);
	await expect(page.locator("#word-input")).toHaveValue("");
	await expect(page).not.toHaveURL(/[?&]w=/);
	await expect(page).not.toHaveURL(/[?&]chain=/);
	await page.reload();
	await waitForCatalog(page);
	await expect(page.locator("#word-input")).toHaveValue("");
	await expect(page).not.toHaveURL(/[?&]w=/);
	await expect(page).not.toHaveURL(/[?&]chain=/);
	await expect(page.locator("#status-line")).toContainText(/Loaded|example|morpheme/i);
});
