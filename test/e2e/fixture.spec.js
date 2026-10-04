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

test("hiding the palette keeps the show-label across layout and locale", async ({ page }) => {
	const toggle = page.locator("#palette-toggle");
	await expect(toggle).toHaveAttribute("aria-expanded", "true");
	await toggle.click();
	await expect(toggle).toHaveAttribute("aria-expanded", "false");
	await expect(toggle).toHaveText("Show palette");
	await page.locator('#opt-layout [data-value="horizontal"]').click();
	await expect(toggle).toHaveAttribute("aria-expanded", "false");
	await expect(toggle).toHaveText("Show palette");
	await page.locator("#display-toggle").click();
	await page.locator('#opt-ui-lang [data-value="da"]').click();
	await expect(toggle).toHaveAttribute("aria-expanded", "false");
	await expect(toggle).toHaveText("Vis palette");
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

test("a failed word Deconstruct clears the previous canvas", async ({ page }) => {
	await page.evaluate(() => {
		const workspace = Blockly.getMainWorkspace();
		const block = workspace.newBlock("morpheme_block__stem_n");
		block.initSvg();
		block.render();
	});
	expect(await canvasBlockCount(page)).toBeGreaterThan(0);
	await page.locator("#word-input").fill("notaword");
	await page.locator("#analyze-btn").click();
	await expect(page.locator("#status-line")).toContainText(/No verified breakdown found for "notaword"/);
	await expect(page.locator("#status-line")).not.toContainText(/Drag a morpheme/);
	await expect(page.locator("#reading-line")).toBeHidden();
	expect(await canvasBlockCount(page)).toBe(0);
	await expect(page).toHaveURL(/[?&]w=notaword/);
});

test("back to an empty URL clears the workshop", async ({ page }) => {
	await page.locator("#word-input").fill("notaword");
	await page.locator("#analyze-btn").click();
	await expect(page).toHaveURL(/[?&]w=notaword/);
	await expect(page).toHaveTitle("notaword - BLOQ");
	const historyLength = await page.evaluate(() => history.length);
	await page.locator("#analyze-btn").click();
	expect(await page.evaluate(() => history.length)).toBe(historyLength);
	await page.goBack();
	await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:8000\/?$/);
	await expect(page.locator("#word-input")).toHaveValue("");
	await expect(page).toHaveTitle("BLOQ");
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

async function canvasIds(page) {
	return page.evaluate(async () => (await import("/blocks.js")).topLevelSentences(Blockly.getMainWorkspace()));
}

for (const layout of ["stack", "horizontal", "wrap"]) {
	test(`missing shared morphemes remain visible in ${layout} layout`, async ({ page }) => {
		await page.addInitScript((value) => localStorage.setItem("bloq:view-layout", value), layout);
		await page.goto("/?chain=neri,UNKNOWN,V_IND_INTR_3SG");
		await expect(page.locator("#status-line")).toContainText("Unknown morpheme");
		expect(await canvasIds(page)).toEqual([[["neri", "UNKNOWN", "V_IND_INTR_3SG"]]]);
		await expect(page).toHaveURL(/UNKNOWN/);
		await page.locator("#blockly-div").getByText("Unknown morpheme in stack. UNKNOWN", { exact: true }).first().waitFor();
		// Changing layout must not repair an unknown slot by deleting it.
		await page.locator(`#opt-layout [data-value="${layout === "stack" ? "wrap" : "stack"}"]`).click();
		expect(await canvasIds(page)).toEqual([[["neri", "UNKNOWN", "V_IND_INTR_3SG"]]]);
		await expect(page.locator("#status")).toHaveClass("error");
	});
}

test("canvas edits cancel an in-flight Deconstruct", async ({ page }) => {
	await bootSlowAnalyze(page);
	await page.goto("/?chain=qimmeq,N_ABS_SG");
	await expect(page.locator("#status-line")).toHaveText("qimmeq");
	await page.locator("#word-input").fill("nerivoq");
	await page.locator("#analyze-btn").click();
	await expect(page.locator("#status-line")).toContainText("Analyzing");
	await page.evaluate(() => Blockly.getMainWorkspace().getAllBlocks(false).find((block) => block.data === "N_ABS_SG").dispose(false));
	await expect(page).toHaveURL(/chain=qimmeq$/);
	await page.waitForTimeout(900);
	expect(await canvasIds(page)).toEqual([[["qimmeq"]]]);
	await expect(page).toHaveURL(/chain=qimmeq$/);
});

test("history restoration cancels an in-flight Deconstruct", async ({ page }) => {
	await bootSlowAnalyze(page);
	await page.goto("/?chain=qimmeq,N_ABS_SG");
	await expect(page.locator("#status-line")).toHaveText("qimmeq");
	await page.evaluate(() => {
		history.pushState(null, "", "?chain=illu,N_ABS_SG");
		window.dispatchEvent(new window.PopStateEvent("popstate"));
	});
	await expect(page.locator("#status-line")).toHaveText("illu");
	await page.locator("#word-input").fill("nerivoq");
	await page.locator("#analyze-btn").click();
	await expect(page.locator("#status-line")).toContainText("Analyzing");
	await page.goBack();
	await expect(page.locator("#status-line")).toHaveText("qimmeq");
	await page.waitForTimeout(900);
	expect(await canvasIds(page)).toEqual([[["qimmeq", "N_ABS_SG"]]]);
	await expect(page).not.toHaveURL(/[?&]w=/);
});

test("failed analyses tolerate display-option repainting", async ({ page }) => {
	await page.locator("#word-input").fill("notaword");
	await page.locator("#analyze-btn").click();
	await expect(page.locator("#status-line")).toContainText('No verified breakdown found for "notaword"');
	await page.locator("#display-toggle").click();
	await page.locator("#opt-show-ids").check();
	await expect(page.locator("#breakdown .breakdown-note")).toHaveText('No verified breakdown found for "notaword".');
	await page.locator("#opt-fill-blanks").check();
	await page.locator('#opt-ui-lang [data-value="da"]').click();
	await expect(page.locator("#breakdown .breakdown-note")).toHaveText('Ingen verificeret opdeling fundet for "notaword".');
});

test("analysis lane selection updates the primary breakdown and alternatives", async ({ page }) => {
	await page.route("**/fixtures/engine-stub.js", async (route) => {
		const response = await route.fetch();
		const source = await response.text();
		const body = source.replace("export async function analyzeWordAsync() {", `export async function analyzeWordAsync() {
			return { matches: [
				{ seq: [{ id: "neri", text: "neri" }, { id: "V_IND_INTR_3SG", text: "voq" }] },
				{ seq: [{ id: "neri", text: "neri" }, { id: "V_IND_INTR_1SG", text: "vunga" }] },
			], evalCount: 2 };
		`);
		await route.fulfill({ response, body });
	});
	await page.reload();
	await expect(page.locator("#status-line")).toContainText("Loaded");
	await page.locator("#word-input").fill("fixture");
	await page.locator("#analyze-btn").click();
	await expect(page.locator("#primary-breakdown .breakdown-word")).toHaveText("nerivoq");
	await page.locator('#visualization-view [data-value="lanes"]').click();
	await page.locator('[data-analysis-lane="1"]').click();
	await expect(page.locator("#status-line")).toHaveText("nerivunga");
	await expect(page.locator("#primary-breakdown .breakdown-word")).toHaveText("nerivunga");
	await expect(page.locator(".alternative-breakdown .breakdown-word")).toHaveText("nerivoq");
	await page.locator("#display-toggle").click();
	await page.locator("#opt-fill-blanks").check();
	await expect(page.locator("#primary-breakdown .breakdown-word")).toHaveText("nerivunga");
	await page.locator('[data-analysis-lane="0"]').click();
	await expect(page.locator("#primary-breakdown .breakdown-word")).toHaveText("nerivoq");
	await expect(page.locator(".alternative-breakdown .breakdown-word")).toHaveText("nerivunga");
});
