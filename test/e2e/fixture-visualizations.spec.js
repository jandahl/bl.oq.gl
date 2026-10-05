import { test, expect } from "@playwright/test";
import { bootFixtureApp } from "./fixture-boot.js";

test.beforeEach(async ({ page }) => { await bootFixtureApp(page); });

for (const [view, selector] of [["tree", '.derivation-node[data-node^="m-"]'], ["stepper", "[data-stage]"]]) {
	test(`${view} label modes retain zero nodes and engine result displays`, async ({ page }) => {
		await page.goto("/?chain=qimmeq%2CN_ABS_SG");
		await page.locator(`#visualization-view [data-value="${view}"]`).click();
		if (view === "stepper") await page.locator('[data-stage="0"]').click();
		await page.locator("#display-toggle").click();
		await page.locator('#opt-spelling [data-value="gloss-only"]').click();
		await expect(page.locator(selector)).toHaveCount(2);
		await expect(page.locator(`${selector} .viz-form`)).toHaveCount(0);
		await expect(page.locator(`${selector} .viz-gloss`)).toHaveCount(2);
		await page.locator('#opt-spelling [data-value="spelling-only"]').click();
		await expect(page.locator(`${selector} .viz-gloss`)).toHaveCount(0);
		await expect(page.locator(`${selector} .viz-form`).last()).toHaveText("Ø");
		if (view === "stepper") {
			await expect(page.locator('[data-stage="0"]')).toHaveAttribute("aria-pressed", "true");
			await expect(page.locator(".step-surface")).toHaveText("qimmeq");
		} else await expect(page.locator(".tree-surface span").last()).toHaveText("Ø");
		await page.locator('#opt-spelling [data-value="both"]').click();
		await expect(page.locator(`${selector} .viz-form`)).toHaveCount(2);
		await expect(page.locator(`${selector} .viz-gloss`)).toHaveCount(2);
		await page.setViewportSize({ width: 360, height: 800 });
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
	});
}

test("editing a sentence clears its assembly and preserves held words and other sentences", async ({ page }) => {
	await page.evaluate(async () => {
		const { renderSentencePlan } = await import("/blocks.js");
		const catalog = await (await import("/catalog.js")).loadCatalog();
		// Synthetic fixture labels, not attested sentence examples.
		renderSentencePlan(globalThis.Blockly.getMainWorkspace(), [
			{ source: "fixture source", assembly: "fixture assembly", words: [{ canvasIds: ["qimmeq", "N_ABS_SG"] }, { surface: "Piita", heldLabel: "heldName" }, { canvasIds: ["neri", "V_IND_INTR_3SG"] }] },
			{ source: "other fixture", assembly: "other assembly", words: [{ canvasIds: ["illu", "N_ABS_SG"] }] },
		], new Map(catalog.presets.map((p) => [p.id, p])), {});
	});
	await page.locator("#opt-layout [data-value=horizontal]").click();
	const preserved = await page.evaluate(async () => (await import("/blocks.js")).planFromCanvas(globalThis.Blockly.getMainWorkspace()));
	expect(preserved[0].assembly).toBe("fixture assembly");
	expect(preserved[1].assembly).toBe("other assembly");
	await page.locator('#visualization-view [data-value="cards"]').click();
	await page.locator(".slot-card").last().getByRole("button", { name: "Remove", exact: true }).click();
	const state = await page.evaluate(async () => {
		const blocks = await import("/blocks.js"); const ws = globalThis.Blockly.getMainWorkspace();
		return { plan: blocks.planFromCanvas(ws), translations: blocks.canvasTree(ws).sentences.map((s) => s.block.getFieldValue("TRANSLATION")) };
	});
	expect(state.plan[0].assembly).toBeUndefined();
	expect(state.plan[0].words).toMatchObject([{ canvasIds: ["qimmeq"] }, { surface: "Piita", heldLabel: "heldName" }, { canvasIds: ["neri", "V_IND_INTR_3SG"] }]);
	expect(state.plan[1].assembly).toBe("other assembly");
	expect(state.translations[0]).not.toBe("fixture assembly");
	expect(state.translations[1]).toBe("other assembly");
});

for (const removed of ["morpheme", "held word"]) {
	test(`layout changes cannot revive assembly after removing a ${removed}`, async ({ page }) => {
		await page.evaluate(async (removed) => {
			const { renderSentencePlan } = await import("/blocks.js");
			const catalog = await (await import("/catalog.js")).loadCatalog();
			renderSentencePlan(globalThis.Blockly.getMainWorkspace(), [{ source: "fixture source", assembly: "fixture assembly", words: [{ canvasIds: ["qimmeq", "N_ABS_SG"] }, { surface: "Piita", heldLabel: "heldName" }] }], new Map(catalog.presets.map((p) => [p.id, p])), {});
			globalThis.Blockly.getMainWorkspace().getAllBlocks(false).find((b) => removed === "morpheme" ? b.data === "N_ABS_SG" : b.bloqHeld === "heldName").dispose(false);
		}, removed);
		await page.locator("#opt-layout [data-value=horizontal]").click();
		const state = await page.evaluate(async () => {
			const blocks = await import("/blocks.js"); const ws = globalThis.Blockly.getMainWorkspace();
			return { plan: blocks.planFromCanvas(ws), translation: blocks.canvasTree(ws).sentences[0].block.getFieldValue("TRANSLATION") };
		});
		expect(state.plan[0].assembly).toBeUndefined();
		expect(state.translation).not.toBe("fixture assembly");
	});
}

test("stepper retains zero stages and supports keyboard navigation", async ({ page }) => {
	await page.goto("/?chain=qimmeq%2CN_ABS_SG");
	await page.locator('#visualization-view [data-value="stepper"]').click();
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
	await page.locator('#visualization-view [data-value="ports"]').click();
	await expect(page.locator(".port-node")).toHaveCount(3);
	await page.locator("[data-select-node]").last().click();
	await expect(page.locator(".port-detail")).toContainText("V_IND_INTR_1SG");
	await page.locator(".port-node").last().getByRole("button", { name: "Remove", exact: true }).click();
	await expect(page.locator(".port-node")).toHaveCount(2);
	await page.locator('#visualization-view [data-value="cards"]').click();
	await expect(page.locator(".slot-card")).toHaveCount(2);
	await page.setViewportSize({ width: 360, height: 800 });
	await page.locator('#visualization-view [data-value="ports"]').click();
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("tree uses engine connections and aligns selected expression coverage", async ({ page }) => {
	await page.goto("/?chain=qimmeq%2CN_qaq_Vb%2CV_IND_INTR_1SG");
	await page.locator('#visualization-view [data-value="tree"]').click();
	await expect(page.locator(".derivation-node")).toHaveCount(5);
	await expect(page.locator(".derivation-board path")).toHaveCount(4);
	await page.locator('.derivation-node[data-node="d-1"]').click();
	await expect(page.locator(".tree-surface .is-selected")).toHaveCount(2);
	await page.locator(".semantic-evidence summary").click();
	await expect(page.locator(".semantic-evidence")).toContainText("not certified");
	await page.setViewportSize({ width: 360, height: 800 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("tree combining steps show engine-built words and only they fill gloss blanks", async ({ page }) => {
	await page.addInitScript(() => { globalThis.__BLOQ_TEST_GLOSS_TEMPLATES__ = true; });
	await page.goto("/?chain=qimmeq%2CN_qaq_Vb%2CV_IND_INTR_1SG&view=tree");
	const expected = await page.evaluate(async () => {
		const catalog = await (await import("/catalog.js")).loadCatalog();
		const { buildWord } = await import("/oq-api.js");
		return ["qimmeq", "N_qaq_Vb", "V_IND_INTR_1SG"].map((id, index, ids) => buildWord(ids.slice(0, index + 1).flatMap((part) => catalog.presets.find((preset) => preset.id === part).seq)).word);
	});
	await expect(page.locator('.derivation-node[data-node="d-1"] .viz-form')).toHaveText(expected[1]);
	await expect(page.locator('.derivation-node[data-node="d-2"] .viz-form')).toHaveText(expected[2]);
	await expect(page.locator('.derivation-node[data-node="d-1"] .viz-gloss')).toHaveText("N_qaq_Vb");
	await expect(page.locator('.derivation-node[data-node="m-1"] .viz-gloss')).toHaveText("N_qaq_Vb template");
	await page.locator("#display-toggle").click();
	await page.locator("#opt-fill-blanks").check();
	await expect(page.locator('.derivation-node[data-node="d-1"] .viz-gloss')).toHaveText("N_qaq_Vb");
	await expect(page.locator('.derivation-node[data-node="m-1"] .viz-gloss')).toHaveText("N_qaq_Vb");
});

test("all visualizations remain usable in a narrow touch viewport", async ({ browser }) => {
	const context = await browser.newContext({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true });
	const mobile = await context.newPage();
	try {
		await mobile.addInitScript(() => { globalThis.__BLOQ_TEST_GLOSS_TEMPLATES__ = true; });
		await mobile.route("**/fixtures/engine-stub.js", async (route) => {
			const response = await route.fetch();
			const body = (await response.text()).replace(
				"return { matches: [], evalCount: 0 };",
				' return { matches: [{ band: "gold", seq: [{ id: "neri", text: "neri" }, { id: "V_IND_INTR_3SG", text: "voq" }] }], evalCount: 1 };',
			);
			await route.fulfill({ response, body });
		});
		await bootFixtureApp(mobile);
		await mobile.goto("/?chain=qimmeq%2CN_qaq_Vb%2CV_IND_INTR_1SG");
		for (const view of ["cards", "interlinear", "tree", "ports", "stepper", "ribbon", "contrast"]) {
			await mobile.locator(`#visualization-view [data-value="${view}"]`).click();
			await expect(mobile.locator(`#visualization-view [data-value="${view}"]`)).toHaveAttribute("aria-checked", "true");
			const layout = await mobile.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth }));
			expect(layout.document, `${view} should not widen the page`).toBeLessThanOrEqual(layout.viewport);
			const shortControls = await mobile.locator("#visualizations button:visible, #visualizations select:visible, #visualizations input[type=search]:visible").evaluateAll((nodes) => nodes.filter((node) => node.getBoundingClientRect().height < 44).map((node) => node.outerHTML));
			expect(shortControls, `${view} touch controls should be at least 44px high`).toEqual([]);
		}
		await mobile.locator('#visualization-view [data-value="inflection"]').click();
		await mobile.locator(".inflection-stem-picker input[type=search]").fill("neri");
		await mobile.locator(".inflection-stem-results button").first().click();
		const gridContainment = await mobile.locator(".inflection-grid-scroll").evaluate((node) => ({
			overflowX: window.getComputedStyle(node).overflowX,
			clientWidth: node.clientWidth,
			viewportWidth: window.innerWidth,
		}));
		expect(gridContainment.overflowX).toBe("auto");
		expect(gridContainment.clientWidth).toBeLessThanOrEqual(gridContainment.viewportWidth);
		await mobile.goto("/?w=fixtureword&view=lanes");
		await expect(mobile.locator(".analysis-lane")).toHaveCount(1);
		const layout = await mobile.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth }));
		expect(layout.document).toBeLessThanOrEqual(layout.viewport);
	} finally {
		await context.close();
	}
});

test("zero-surface endings remain a column with no invented span", async ({ page }) => {
	await page.goto("/?chain=qimmeq%2CN_ABS_SG");
	await page.locator('#visualization-view [data-value="interlinear"]').click();
	await expect(page.locator(".interlinear-table button").last()).toHaveText("Ø");
	await expect(page.locator(".interlinear-table tbody tr").nth(1).locator("td").last()).toContainText("no written span");
});

test("interlinear selection highlights aligned tiers and supports narrow layouts", async ({ page }) => {
	await page.goto("/?chain=qimmeq%2CN_qaq_Vb%2CV_IND_INTR_1SG");
	await page.locator('#visualization-view [data-value="interlinear"]').click();
	await expect(page.locator(".interlinear-table tbody tr")).toHaveCount(4);
	await page.locator(".interlinear-table button").nth(1).click();
	await expect(page.locator(".interlinear-table td.is-selected")).toHaveCount(4);
	await expect(page.locator(".card-palette")).toBeHidden();
	await page.setViewportSize({ width: 360, height: 800 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

for (const [view, selector] of [
	["interlinear", ".interlinear-table td.api-morpheme-colours"],
	["tree", '.derivation-node[data-node="m-0"].api-morpheme-colours'],
	["stepper", '[data-stage="0"].api-morpheme-colours'],
]) {
	test(`${view} morphemes use the API palette while selected`, async ({ page }) => {
		await page.goto("/?chain=qimmeq%2CN_qaq_Vb%2CV_IND_INTR_1SG");
		await page.locator(`#visualization-view [data-value="${view}"]`).click();
		const target = page.locator(selector).first();
		await expect(target).toHaveClass(/api-morpheme-colours/);
		if (view === "interlinear") await page.locator(".interlinear-table button").first().click();
		if (view === "tree") await page.locator('.derivation-node[data-node="m-0"]').click();
		if (view === "stepper") await page.locator('[data-stage="0"]').click();
		const actual = await target.evaluate((node) => ({
			fill: node.style.getPropertyValue("--morpheme-light-fill"),
			border: node.style.getPropertyValue("--morpheme-light-border"),
			text: node.style.getPropertyValue("--morpheme-light-text"),
			background: window.getComputedStyle(node).backgroundColor,
		}));
		const expected = await page.evaluate(async () => {
			const { paletteColours } = await import("/theme.js");
			const catalog = await (await import("/catalog.js")).loadCatalog();
			return paletteColours(catalog.presets.find((preset) => preset.id === "qimmeq"), "light");
		});
		expect(actual.fill).toBe(expected.fill);
		expect(actual.border).toBe(expected.border);
		expect(actual.text).toBe(expected.text);
		expect(actual.background).not.toBe("rgba(0, 0, 0, 0)");
		await expect(page.locator(".visualization-hint")).toBeVisible();
	});
}
test("slot palette builds, removes and shares the same chain as Blockly", async ({ page }) => {
	await page.locator('#visualization-view [data-value="cards"]').click();
	await expect(page.locator("#blockly-div")).toBeHidden();
	await page.locator("#card-palette-filter").fill("qimmeq");
	await page.locator(".palette-entries button").first().click();
	await expect(page.locator(".slot-card")).toHaveCount(1);
	await expect(page).toHaveURL(/chain=qimmeq/);
	await page.locator('#visualization-view [data-value="blockly"]').click();
	await expect(page.locator("#blockly-div")).toBeVisible();
	await page.locator('#visualization-view [data-value="cards"]').click();
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
	await page.locator('#visualization-view [data-value="cards"]').click();
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
	await page.locator('#visualization-view [data-value="cards"]').click();
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
		await page.locator(`#visualization-view [data-value="${view}"]`).click();
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
	await page.locator('#visualization-view [data-value="cards"]').click();
	await page.locator("#display-toggle").click();
	await page.locator('#opt-ui-lang [data-value="da"]').click();
	await expect(page.locator('[data-i18n="visualization"]')).toHaveText("Visualisering");
	await expect(page.locator("#visualization-view [data-value=cards] span")).toHaveText("Morfemkort");
	await expect(page.locator(".card-palette summary")).toHaveText("Morfempalette");
	await expect(page.locator(".slot-card").first().getByRole("button", { name: "Fjern", exact: true })).toBeVisible();
	await expect(page.locator("#card-insert-at option").last()).toHaveText("Slutningen af kæden");
	await page.locator("#display-close").click();
	await page.locator('#visualization-view [data-value="stepper"]').click();
	await page.locator('[data-stage="0"]').click();
	await page.locator("#display-toggle").click();
	await page.locator('#opt-ui-lang [data-value="en"]').click();
	await page.locator("#display-close").click();
	await expect(page.getByRole("button", { name: "Next stage", exact: true })).toBeVisible();
	await expect(page.locator('[data-stage="0"]')).toHaveAttribute("aria-pressed", "true");
});

test("zero card forms and word names hide IDs unless explicitly enabled", async ({ page }) => {
	await page.goto("/?chain=qimmeq%2CN_ABS_SG");
	await page.locator('#visualization-view [data-value="cards"]').click();
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
	await page.locator('#visualization-view [data-value="cards"]').click();
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
	await page.locator('#visualization-view [data-value="cards"]').click();
	await page.locator(".slot-card").getByRole("button", { name: "Remove", exact: true }).click();
	await expect(page.locator("#visualization-word option")).toHaveCount(1);
	await expect(page.locator("#visualization-word")).toContainText("Piita");
	const words = await page.evaluate(async () => (await import("/blocks.js")).planFromCanvas(globalThis.Blockly.getMainWorkspace())[0].words);
	expect(words).toEqual([{ surface: "Piita", heldLabel: "heldName" }]);
});

test("history replacement discards drafts even when the canvas IDs are unchanged", async ({ page }) => {
	await rejectedDraft(page);
	await page.evaluate(() => { history.pushState({}, "", "?chain=qimmeq%2CN_qaq_Vb%2CV_IND_INTR_1SG&view=cards"); globalThis.dispatchEvent(new globalThis.PopStateEvent("popstate")); });
	await expect(page.locator(".slot-card .viz-form").first()).toHaveText("qimmeq");
	await expect(page.locator(".visualization-status")).not.toHaveClass(/is-error/);
});

test("Blockly edits invalidate a draft while display options preserve it", async ({ page }) => {
	await rejectedDraft(page);
	await page.locator('#opt-lang [data-value="da"]').click();
	await expect(page.locator(".visualization-status.is-error")).toBeVisible();
	await expect(page.locator("#status-line")).toContainText("invalid sequence");
	await page.locator('#visualization-view [data-value="blockly"]').click();
	await page.evaluate(() => globalThis.Blockly.getMainWorkspace().clear());
	await page.locator('#visualization-view [data-value="cards"]').click();
	await expect(page.locator(".slot-card")).toHaveCount(0);
	await expect(page.locator(".palette-entries button").first()).toBeEnabled();
});

test("card and port labels honor display modes without dropping zero forms", async ({ page }) => {
	await page.goto("/?chain=qimmeq%2CN_ABS_SG");
	for (const [view, selector] of [["cards", ".slot-card"], ["ports", "[data-select-node]"]]) {
		await page.locator(`#visualization-view [data-value="${view}"]`).click();
		await page.locator("#display-toggle").click();
		await page.locator('#opt-spelling [data-value="gloss-only"]').click();
		await expect(page.locator(`${selector} .viz-form`)).toHaveCount(0);
		await expect(page.locator(`${selector} .viz-gloss`)).toHaveCount(2);
		await page.locator('#opt-spelling [data-value="spelling-only"]').click();
		await expect(page.locator(`${selector} .viz-form`).last()).toHaveText("Ø");
		await expect(page.locator(`${selector} .viz-gloss`)).toHaveCount(0);
		await page.locator('#opt-spelling [data-value="both"]').click();
		await expect(page.locator(`${selector} .viz-form`)).toHaveCount(2);
		await expect(page.locator(`${selector} .viz-gloss`)).toHaveCount(2);
		await page.locator("#display-close").click();
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

test("thumbnail view selector supports keyboard selection and narrow screens", async ({ page }) => {
	await page.goto("/?chain=qimmeq%2CN_qaq_Vb%2CV_IND_INTR_1SG");
	const chooser = page.getByRole("radiogroup", { name: "Visualization", exact: true });
	await expect(chooser.getByRole("radio")).toHaveCount(10);
	await expect(chooser.locator("svg[aria-hidden=true]")).toHaveCount(10);
	const blockly = chooser.getByRole("radio", { name: "Blockly", exact: true });
	await blockly.focus(); await blockly.press("ArrowRight");
	await expect(chooser.getByRole("radio", { name: "Slot cards", exact: true })).toBeFocused();
	await expect(page.locator(".slot-card")).toHaveCount(3);
	await page.keyboard.press("End");
	await expect(chooser.getByRole("radio", { name: "Analysis lanes", exact: true })).toHaveAttribute("aria-checked", "true");
	expect(await chooser.evaluate((root) => window.getComputedStyle(root.querySelector('[aria-checked="true"]')).backgroundColor !== window.getComputedStyle(root.querySelector('[aria-checked="false"]')).backgroundColor)).toBe(true);
	await page.setViewportSize({ width: 360, height: 800 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("analysis lanes preserve API order, localize, and select a reading on the canvas", async ({ page }) => {
	await page.route("**/fixtures/engine-stub.js", async (route) => {
		const response = await route.fetch();
		const body = (await response.text()).replace(
			"return { matches: [], evalCount: 0 };",
			`return { matches: [
				{ band: "gold", seq: [{ id: "neri", text: "neri" }, { id: "V_IND_INTR_3SG", text: "voq" }] },
				{ band: "soft_exact", seq: [{ id: "illu", text: "illu" }] },
			], evalCount: 2 };`,
		);
		await route.fulfill({ response, body });
	});
	await page.goto("/?w=fixtureword&view=lanes");
	await expect(page.locator(".analysis-lane")).toHaveCount(2);
	await expect(page.locator(".analysis-lane-heading").nth(0)).toContainText("gold");
	await expect(page.locator(".analysis-lane-heading").nth(1)).toContainText("soft");
	await expect(page.locator(".analysis-lane").first()).toHaveAttribute("aria-checked", "true");
	await page.locator(".analysis-lane").first().focus();
	await page.keyboard.press("ArrowDown");
	await expect(page.locator(".analysis-lane").nth(1)).toHaveAttribute("aria-checked", "true");
	await page.locator("#display-toggle").click();
	await page.locator("#opt-ui-lang [data-value=da]").click();
	await expect(page.locator("#visualization-view [data-value=lanes] span").last()).toHaveText("Analyserækker");
	await expect(page.locator(".analysis-lanes-instruction")).toHaveText("Vælg en komplet, præcis række for at placere den på lærredet. Rækker kun til inspektion vises stadig til sammenligning.");
	await page.locator(".analysis-lane").nth(1).click();
	await expect(page.locator(".analysis-lane").nth(1)).toHaveAttribute("aria-checked", "true");
	await page.locator('#visualization-view [data-value="cards"]').click();
	await expect(page.locator(".slot-card .viz-form")).toHaveText(["illu"]);
	await expect(page).toHaveURL(/w=fixtureword/);
	await page.setViewportSize({ width: 360, height: 800 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("node selection filters the palette and inserts after the selected slot", async ({ page }) => {
	// Reject this synthetic two-root proposal so it stays in the draft editor;
	// the concatenating fixture engine otherwise accepts every nonempty chain.
	await page.route("**/fixtures/engine-stub.js", async (route) => {
		const response = await route.fetch();
		const body = (await response.text()).replace('item.id === "BAD"', 'item.id === "BAD" || (item.id === "illu" && seq.some((part) => part.id === "qimmeq"))');
		await route.fulfill({ response, body });
	});
	await page.goto("/?chain=qimmeq%2CN_qaq_Vb%2CV_IND_INTR_1SG");
	await page.locator('#visualization-view [data-value="ports"]').click();
	await page.locator("[data-select-node]").first().click();
	await expect(page.locator("#card-palette-category")).toHaveValue("stem");
	await expect(page.locator("#card-insert-at")).toHaveValue("1");
	await expect(page.locator('[data-preset-id="N_qaq_Vb"]')).toHaveCount(0);
	await page.locator('[data-preset-id="illu"]').click();
	await expect(page.locator(".port-node .viz-form")).toHaveText(["qimmeq", "illu", "-qaq", "-vunga"]);
	await expect(page.locator("[data-select-node]").nth(1)).toHaveAttribute("aria-pressed", "true");
	await expect(page.locator("#card-insert-at")).toHaveValue("2");
	await expect(page.locator(".port-out").first()).toHaveCSS("text-align", "right");
	await expect(page.locator(".port-in").first()).toHaveCSS("text-align", "left");
	await page.locator("[data-select-node]").nth(2).click();
	await expect(page.locator("#card-palette-category")).toHaveValue("derivational_affix");
	await expect(page.locator("#card-insert-at")).toHaveValue("3");
});

test("visualization URLs restore on reload and browser history without losing the chain", async ({ page }) => {
	await page.goto("/?chain=qimmeq%2CN_qaq_Vb%2CV_IND_INTR_1SG&view=ports");
	await expect(page.locator('#visualization-view [data-value="ports"]')).toHaveAttribute("aria-checked", "true");
	await expect(page.locator(".port-node")).toHaveCount(3);
	await page.locator('#visualization-view [data-value="stepper"]').click();
	await expect(page).toHaveURL(/view=stepper$/);
	await page.reload();
	await expect(page.locator("[data-stage]")).toHaveCount(3);
	await page.goBack();
	await expect(page.locator(".port-node")).toHaveCount(3);
	await page.goForward();
	await expect(page.locator("[data-stage]")).toHaveCount(3);
	await page.locator('#visualization-view [data-value="blockly"]').click();
	await expect(page).not.toHaveURL(/view=/);
	await expect(page).toHaveURL(/chain=qimmeq%2CN_qaq_Vb%2CV_IND_INTR_1SG$/);
});

test("view-only and invalid visualization links use safe empty-canvas defaults", async ({ page }) => {
	await page.goto("/?view=cards");
	await expect(page.locator('#visualization-view [data-value="cards"]')).toHaveAttribute("aria-checked", "true");
	await expect(page.locator(".visualization-status")).toContainText("Drag a morpheme");
	await page.locator('#visualization-view [data-value="ports"]').click();
	await expect(page).toHaveURL(/\?view=ports$/);
	await page.locator("#clear-canvas-btn").click();
	await expect(page).toHaveURL(/\?view=ports$/);
	await page.goto("/?view=unknown");
	await expect(page.locator('#visualization-view [data-value="blockly"]')).toHaveAttribute("aria-checked", "true");
	await expect(page.locator("#blockly-div")).toBeVisible();
});


test("surface ribbon follows engine spans, selects morphemes, and localizes controls", async ({ page }) => {
	await page.goto("/?chain=qimmeq%2CN_qaq_Vb%2CV_IND_INTR_1SG&view=ribbon");
	await expect(page.locator(".surface-ribbon .ribbon-morpheme > .ribbon-surface")).toHaveText(["qimmeq", "qaq", "vunga"]);
	await expect(page.locator(".ribbon-comparison")).toContainText("Citation form: qimmeq");
	await expect(page.locator(".ribbon-comparison")).toContainText("Surface: qimmeq");
	await expect(page.locator(".ribbon-change-inspector")).toContainText("Boundary change inspector");
	await expect(page.locator(".ribbon-comparison")).toContainText("Surface offsets: 0–6");
	await expect(page.locator(".ribbon-comparison")).toContainText("The API reports no changed citation range.");
	await page.locator(".ribbon-morpheme").nth(1).click();
	await expect(page.locator(".ribbon-detail")).toContainText("N_qaq_Vb");
	await page.locator("#display-toggle").click();
	await page.locator('#opt-ui-lang [data-value="da"]').click();
	await expect(page.locator("#visualization-view [data-value=ribbon] span")).toHaveText("Overfladebånd");
	await expect(page.locator(".ribbon-comparison")).toContainText("Grundform:");
	await expect(page.locator(".ribbon-change-inspector")).toContainText("Inspektør for grænseændringer");
	await page.setViewportSize({ width: 360, height: 800 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
	expect(await page.locator(".ribbon-change-inspector").evaluate((node) => window.getComputedStyle(node).gridTemplateColumns.split(" ").length)).toBe(1);
});

test("chain contrast builds a searched comparison and shares its API IDs", async ({ page }) => {
	await page.goto("/?chain=qimmeq%2CN_qaq_Vb&view=contrast");
	await expect(page.locator(".contrast-lane")).toHaveCount(2);
	await expect(page.locator(".contrast-lane .contrast-status").first()).toContainText("Complete word");
	await page.locator(".contrast-controls input[type=search]").fill("qimmeq");
	await page.locator(".contrast-search-results button").first().click();
	await expect(page).toHaveURL(/view=contrast&compare=qimmeq$/);
	await expect(page.locator(".contrast-shared")).toHaveCount(2);
	await expect(page.locator(".contrast-lane").nth(1)).toContainText("Same API ID and order");
	await page.locator("#display-toggle").click();
	await page.locator('#opt-ui-lang [data-value="da"]').click();
	await expect(page.locator('#visualization-view [data-value="contrast"] span')).toHaveText("Kædesammenligning");
	await expect(page.locator(".contrast-controls")).toContainText("Søg i morfemkataloget");
	await page.reload();
	await expect(page.locator(".contrast-morphemes").nth(1)).toContainText("qimmeq");
	await page.setViewportSize({ width: 360, height: 800 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("inflection grid builds forms only at structured engine feature coordinates", async ({ page }) => {
	await page.goto("/?view=inflection");
	await page.locator(".inflection-stem-picker input[type=search]").fill("neri");
	await page.locator(".inflection-stem-results button").first().click();
	await expect(page).toHaveURL(/view=inflection&stem=neri$/);
	await expect(page.locator(".inflection-grid")).toBeVisible();
	await expect(page.locator(".inflection-grid")).toContainText("IND");
	const forms = await page.locator(".inflection-form").allTextContents();
	expect(forms.some((form) => form.includes("nerivunga"))).toBe(true);
	expect(forms.some((form) => form.includes("nerivoq"))).toBe(true);
	await page.goto("/?view=inflection&stem=qimmeq");
	await expect(page.locator(".inflection-status")).toContainText("no structured inflection coordinates");
	await page.setViewportSize({ width: 360, height: 800 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("the tree root is larger and remains contained on a narrow screen", async ({ page }) => {
	await page.goto("/?chain=qimmeq,N_qaq_Vb,V_IND_INTR_1SG&view=tree");
	const root = page.locator(".derivation-root");
	await expect(root).toHaveCount(1);
	const size = await root.boundingBox();
	const child = await page.locator('.derivation-node:not(.derivation-root)').first().boundingBox();
	expect(size.width).toBeGreaterThan(child.width);
	expect(size.height).toBeGreaterThan(child.height);
	await expect(root.locator(".viz-form")).toHaveCSS("font-size", "21.6px");
	await page.setViewportSize({ width: 360, height: 800 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
	await page.goto("/?chain=qimmeq&view=tree");
	const bounds = await page.locator(".derivation-root").evaluate((node) => ({ left: node.offsetLeft, right: node.offsetLeft + node.offsetWidth, board: node.parentElement.offsetWidth }));
	expect(bounds.left).toBeGreaterThanOrEqual(0);
	expect(bounds.right).toBeLessThanOrEqual(bounds.board);
});

test("multi-sentence focus navigation groups words by sentence", async ({ page }) => {
	await page.evaluate(async () => {
		const { renderSentencePlan } = await import("/blocks.js");
		const catalog = await (await import("/catalog.js")).loadCatalog();
		renderSentencePlan(globalThis.Blockly.getMainWorkspace(), [
			{ source: "First sentence", words: [{ canvasIds: ["qimmeq"] }, { canvasIds: ["illu"] }] },
			{ source: "Second sentence", words: [{ canvasIds: ["neri", "V_IND_INTR_3SG"] }] },
		], new Map(catalog.presets.map((p) => [p.id, p])), {});
	});
	await page.locator('#visualization-view [data-value="cards"]').click();
	await expect(page.locator("#visualization-word optgroup")).toHaveCount(2);
	await expect(page.locator("#visualization-word optgroup").first()).toHaveAttribute("label", "Sentence 1");
	await expect(page.locator("#visualization-word optgroup").last()).toHaveAttribute("label", "Sentence 2");
	await expect(page.locator("#visualization-word").locator("xpath=.." )).toContainText("Focus");
});

test("inflection grid has a one-click example and explains how to read the table", async ({ page }) => {
	await page.goto("/?view=inflection");
	await expect(page.locator("#visualization-word")).toBeHidden();
	await expect(page.locator(".inflection-stem-picker")).toContainText("who acts");
	await page.locator('[data-inflection-example="neri"]').click();
	await expect(page).toHaveURL(/stem=neri/);
	await expect(page.locator(".inflection-grid")).toContainText("nerivunga");
	await expect(page.locator(".inflection-grid")).toContainText("nerivoq");
	await page.locator(".inflection-group > summary").first().click();
	await expect(page.locator(".inflection-grid").first()).toBeHidden();
	await page.locator(".inflection-group > summary").first().click();
	await expect(page.locator(".inflection-grid").first()).toBeVisible();
});

test("chain contrast suggests a verified change without editing the current chain", async ({ page }) => {
	await page.goto("/?chain=neri,V_IND_INTR_1SG&view=contrast");
	await expect(page.locator(".contrast-controls")).toContainText("What changes in a word");
	await page.locator('[data-contrast-suggestion="contrastChangeSubject"]').first().click();
	await expect(page.locator(".contrast-lane .contrast-status").first()).toContainText("nerivunga");
	await expect(page.locator(".contrast-lane .contrast-status").last()).toContainText("nerivoq");
	await expect(page).toHaveURL(/compare=neri%2CV_IND_INTR_3SG/);
});

test("approximate lanes with missing IDs explain inspection-only status before selection", async ({ page }) => {
	await page.route("**/fixtures/engine-stub.js", async (route) => {
		const response = await route.fetch();
		const body = (await response.text()).replace("return { matches: [], evalCount: 0 };", `return { matches: [
			{ band: "hard_exact", seq: [{ id: "neri", text: "neri" }, { id: "V_IND_INTR_1SG", text: "vunga" }] },
			{ band: "approximate", seq: [{ id: "neri", text: "neri" }, { id: "V_EXCL_INTR_3SG", text: "vunga" }] },
		], evalCount: 2 };`);
		await route.fulfill({ response, body });
	});
	await page.goto("/?w=fixtureword&view=lanes");
	const lane = page.locator(".analysis-lane").nth(1);
	await expect(lane).toHaveAttribute("aria-disabled", "true");
	await expect(lane).toContainText("Inspection only");
	await expect(lane).toContainText("V_EXCL_INTR_3SG");
	await lane.dispatchEvent("click");
	await expect(page.locator(".analysis-lanes-error")).toHaveCount(0);
	await expect(page.locator(".analysis-lane").first()).toHaveAttribute("aria-checked", "true");
	await expect(page.locator("#status-line")).toHaveText("nerivunga");
});
