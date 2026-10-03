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
	await expect(page.locator(".palette-entries button").first()).toBeEnabled();
	await expect(page.locator("#card-palette-filter")).toBeFocused();
	await page.locator(".palette-entries button").first().click();
	await expect(page.locator(".slot-card")).toHaveCount(1);
	await expect(page).toHaveURL(/chain=qimmeq/);
	await page.locator(".card-palette summary").click();
	await page.locator(".slot-card").getByRole("button", { name: "Remove", exact: true }).click();
	await expect(page.locator(".card-palette summary")).toBeFocused();
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

test("failed Deconstruct clears cards without replacing the analysis error", async ({ page }) => {
	await page.goto("/?chain=qimmeq%2CN_ABS_SG");
	await page.locator("#visualization-view").selectOption("cards");
	await page.locator("#word-input").fill("unknownword");
	await page.locator("#word-input").press("Enter");
	await expect(page.locator("#status-line")).toContainText("No verified breakdown");
	await expect(page.locator(".slot-card")).toHaveCount(0);
	await expect(page.locator(".visualization-status")).not.toContainText("Complete word");
	await expect(page.locator(".palette-entries button").first()).toBeEnabled();
	await page.locator("#card-palette-filter").fill("neri");
	await page.locator(".palette-entries button").first().click();
	await expect(page).toHaveURL(/chain=neri/);
});

for (const [view, selector] of [["cards", ".slot-card"], ["ports", ".port-node"]]) {
	test(`${view} edits preserve keyboard focus through moves and removal`, async ({ page }) => {
		await page.goto("/?chain=qimmeq%2CN_qaq_Vb%2CV_IND_INTR_1SG");
		await page.locator("#visualization-view").selectOption(view);
		await page.locator(selector).nth(1).getByRole("button", { name: "Move right", exact: true }).focus();
		await page.keyboard.press("Enter");
		await expect(page.locator(selector).last().getByRole("button", { name: "Move left", exact: true })).toBeFocused();
		await page.keyboard.press("Enter");
		await expect(page.locator(selector).nth(1).getByRole("button", { name: "Move left", exact: true })).toBeFocused();
		await page.locator(selector).last().getByRole("button", { name: "Remove", exact: true }).focus();
		await page.keyboard.press("Enter");
		await expect(page.locator(selector).last().getByRole("button", { name: "Remove", exact: true })).toBeFocused();
		await page.keyboard.press("Enter");
		await expect(page.locator(selector)).toHaveCount(1);
	});
}

test("UI language refreshes static controls, actions, palette and stage labels", async ({ page }) => {
	await page.goto("/?chain=qimmeq%2CN_ABS_SG");
	await page.locator("#visualization-view").selectOption("cards");
	await page.locator("#display-toggle").click();
	await page.locator('#opt-ui-lang [data-value="da"]').click();
	await expect(page.locator('[data-i18n="visualization"]')).toHaveText("Visualisering");
	await expect(page.locator("#visualization-view option[value=cards]")).toHaveText("Morfemkort");
	await expect(page.locator(".card-palette summary")).toHaveText("Morfempalette");
	await expect(page.locator(".slot-card").first().getByRole("button", { name: "Fjern", exact: true })).toBeVisible();
	await expect(page.locator("#card-insert-at option").last()).toHaveText("Slutningen af kæden");
	await page.locator("#visualization-view").selectOption("stepper");
	await page.locator('[data-stage="0"]').click();
	await page.locator('#opt-ui-lang [data-value="en"]').click();
	await expect(page.getByRole("button", { name: "Next stage", exact: true })).toBeVisible();
	await expect(page.locator('[data-stage="0"]')).toHaveAttribute("aria-pressed", "true");
});

test("zero card forms and word names hide IDs unless explicitly enabled", async ({ page }) => {
	await page.goto("/?chain=qimmeq%2CN_ABS_SG");
	await page.locator("#visualization-view").selectOption("cards");
	await expect(page.locator(".slot-card .viz-form").last()).toHaveText("Ø");
	await expect(page.locator("#visualization-word")).toHaveText("1 · qimmeq");
	await expect(page.locator(".slot-card code")).toHaveCount(0);
	await page.locator("#display-toggle").click();
	await page.locator("#opt-show-ids").check();
	await expect(page.locator(".slot-card code").last()).toHaveText("N_ABS_SG");
	await expect(page.locator("#visualization-word")).toContainText("N_ABS_SG");
	await page.locator("#opt-show-ids").uncheck();
	await expect(page.locator("#visualization-word")).not.toContainText("N_ABS_SG");
});

// Force a rejected edit in the fixture engine, rather than model linguistic
// joins in an offline test. The live suite exercises the real rejection.
async function rejectedDraft(page, chain = "qimmeq%2CN_qaq_Vb%2CV_IND_INTR_1SG") {
	await page.route("**/fixtures/engine-stub.js", async (route) => {
		const response = await route.fetch();
		const body = (await response.text())
			.replace("const bad = seq.findIndex(", 'const bad = seq[0]?.id === "N_qaq_Vb" ? 0 : seq.findIndex(')
			.replace("globalThis.setTimeout(resolve, slow);", "if (globalThis.__BLOQ_HOLD_ANALYZE__) globalThis.__BLOQ_RELEASE_ANALYZE__ = resolve; else globalThis.setTimeout(resolve, slow);");
		await route.fulfill({ response, body });
	});
	await page.goto(`/?chain=${chain}`);
	await page.locator("#visualization-view").selectOption("cards");
	await page.locator(".slot-card").first().getByRole("button", { name: "Move right", exact: true }).click();
	await expect(page.locator(".visualization-status.is-error")).toBeVisible();
}

test("failed analysis discards a rejected draft and leaves the palette usable", async ({ page }) => {
	await rejectedDraft(page);
	await page.locator("#word-input").fill("unknownword");
	await page.locator("#word-input").press("Enter");
	await expect(page.locator(".slot-card")).toHaveCount(0);
	await expect(page.locator("#status-line")).toContainText("No verified breakdown");
	await expect(page.locator(".palette-entries button").first()).toBeEnabled();
});

test("an invalid edit cancels an analysis already in flight", async ({ page }) => {
	await rejectedDraft(page);
	await page.evaluate(() => { globalThis.__BLOQ_SLOW_ANALYZE__ = 1; globalThis.__BLOQ_HOLD_ANALYZE__ = true; });
	await page.locator("#word-input").fill("nerivoq");
	await page.locator("#word-input").press("Enter");
	// Starting analysis drops the old draft and immediately shows the canvas.
	await expect(page.locator(".slot-card .viz-form").first()).toHaveText("qimmeq");
	await page.waitForFunction(() => typeof globalThis.__BLOQ_RELEASE_ANALYZE__ === "function");
	await page.locator(".slot-card").first().getByRole("button", { name: "Move right", exact: true }).click();
	await page.evaluate(async () => { globalThis.__BLOQ_RELEASE_ANALYZE__(); await new Promise(globalThis.requestAnimationFrame); });
	await expect(page.locator(".slot-card")).toHaveCount(3);
	await expect(page.locator(".visualization-status.is-error")).toBeVisible();
	await expect(page).not.toHaveURL(/w=nerivoq/);
});

test("removing the last editable word preserves a held sentence word", async ({ page }) => {
	await page.evaluate(async () => {
		const { renderSentencePlan } = await import("/blocks.js");
		const { loadCatalog } = await import("/catalog.js");
		const catalog = await loadCatalog();
		renderSentencePlan(globalThis.Blockly.getMainWorkspace(), [{ source: "source", words: [{ canvasIds: ["qimmeq"] }, { surface: "Piita", heldLabel: "heldName" }] }], new Map(catalog.presets.map((p) => [p.id, p])), {});
	});
	await page.locator("#visualization-view").selectOption("cards");
	await page.locator(".slot-card").getByRole("button", { name: "Remove", exact: true }).click();
	await expect(page.locator("#visualization-word option")).toHaveCount(1);
	await expect(page.locator("#visualization-word")).toContainText("Piita");
	const words = await page.evaluate(async () => (await import("/blocks.js")).planFromCanvas(globalThis.Blockly.getMainWorkspace())[0].words);
	expect(words).toEqual([{ surface: "Piita", heldLabel: "heldName" }]);
});

test("history replacement discards drafts even when the canvas IDs are unchanged", async ({ page }) => {
	await rejectedDraft(page);
	await page.evaluate(() => { history.pushState({}, "", "?chain=qimmeq%2CN_qaq_Vb%2CV_IND_INTR_1SG"); globalThis.dispatchEvent(new globalThis.PopStateEvent("popstate")); });
	await expect(page.locator(".slot-card .viz-form").first()).toHaveText("qimmeq");
	await expect(page.locator(".visualization-status")).not.toHaveClass(/is-error/);
});

test("Blockly edits invalidate a draft while display options preserve it", async ({ page }) => {
	await rejectedDraft(page);
	await page.locator('#opt-lang [data-value="da"]').click();
	await expect(page.locator(".visualization-status.is-error")).toBeVisible();
	await expect(page.locator("#status-line")).toContainText("invalid sequence");
	await page.locator("#visualization-view").selectOption("blockly");
	await page.evaluate(() => globalThis.Blockly.getMainWorkspace().clear());
	await page.locator("#visualization-view").selectOption("cards");
	await expect(page.locator(".slot-card")).toHaveCount(0);
	await expect(page.locator(".palette-entries button").first()).toBeEnabled();
});

test("card and port labels honor display modes without dropping zero forms", async ({ page }) => {
	await page.goto("/?chain=qimmeq%2CN_ABS_SG");
	await page.locator("#display-toggle").click();
	for (const [view, selector] of [["cards", ".slot-card"], ["ports", "[data-select-node]"]]) {
		await page.locator("#visualization-view").selectOption(view);
		await page.locator('#opt-spelling [data-value="gloss-only"]').click();
		await expect(page.locator(`${selector} .viz-form`)).toHaveCount(0);
		await expect(page.locator(`${selector} .viz-gloss`)).toHaveCount(2);
		await page.locator('#opt-spelling [data-value="spelling-only"]').click();
		await expect(page.locator(`${selector} .viz-form`).last()).toHaveText("Ø");
		await expect(page.locator(`${selector} .viz-gloss`)).toHaveCount(0);
		await page.locator('#opt-spelling [data-value="both"]').click();
		await expect(page.locator(`${selector} .viz-form`)).toHaveCount(2);
		await expect(page.locator(`${selector} .viz-gloss`)).toHaveCount(2);
	}
});

test("a rejected sentence draft keeps its error when another word is selected", async ({ page }) => {
	await rejectedDraft(page, "qimmeq%2CN_qaq_Vb%2CV_IND_INTR_1SG%3Bneri%2CV_IND_INTR_3SG");
	await page.locator("#visualization-word").selectOption("1");
	await page.locator('#opt-lang [data-value="da"]').click();
	await expect(page.locator("#status-line")).toContainText("invalid sequence");
	await page.locator("#visualization-word").selectOption("0");
	await page.locator(".slot-card").first().getByRole("button", { name: "Move right", exact: true }).click();
	await expect(page.locator("#status-line")).not.toContainText("invalid sequence");
	await expect(page.locator(".visualization-status")).not.toHaveClass(/is-error/);
});
