import { test, expect } from "@playwright/test";

test("tree and stepper labels honor display modes with live engine glosses", async ({ page }) => {
	await page.goto("/?chain=qimmeq%2CN_qaq_Vb%2CV_IND_INTR_1SG");
	await page.locator("#display-toggle").click();
	for (const [view, selector] of [["tree", '.derivation-node[data-node="m-0"]'], ["stepper", '[data-stage="0"]']]) {
		await page.locator(`#visualization-view [data-value="${view}"]`).click();
		await page.locator('#opt-spelling [data-value="gloss-only"]').click();
		await expect(page.locator(`${selector} .viz-form`)).toHaveCount(0);
		await expect(page.locator(`${selector} .viz-gloss`)).toContainText("dog");
		await page.locator('#opt-spelling [data-value="spelling-only"]').click();
		await expect(page.locator(`${selector} .viz-form`)).toHaveText("qimmeq");
		await expect(page.locator(`${selector} .viz-gloss`)).toHaveCount(0);
		await page.locator('#opt-spelling [data-value="both"]').click();
		await expect(page.locator(`${selector} .viz-form`)).toHaveText("qimmeq");
		await expect(page.locator(`${selector} .viz-gloss`)).toContainText("dog");
	}
	await expect(page.locator(".step-surface")).toHaveText("qimmeqarpunga");
});

test("a new analysis replaces an invalid draft and subsequent edits use the new word", async ({ page }) => {
	await page.goto("/?chain=qimmeq%2CN_qaq_Vb%2CV_IND_INTR_1SG");
	await page.locator('#visualization-view [data-value="cards"]').click();
	await page.locator(".slot-card").first().getByRole("button", { name: "Move right", exact: true }).click();
	await expect(page.locator(".visualization-status.is-error")).toBeVisible();
	await page.locator("#word-input").fill("nerivunga");
	await page.locator("#word-input").press("Enter");
	await expect(page.locator(".slot-card")).toHaveCount(2);
	await expect(page.locator(".visualization-status")).toContainText("nerivunga");
	await expect(page.locator("#visualization-word")).toHaveText("1 · nerivunga");
	await page.locator(".slot-card").last().getByRole("button", { name: "Remove", exact: true }).click();
	await expect(page).toHaveURL(/chain=neri&view=cards$/);
	await expect(page.locator(".slot-card .viz-form")).toHaveText("neri");
});

test("cards and ports honor form/gloss modes using real engine labels", async ({ page }) => {
	await page.goto("/?chain=qimmeq%2CN_qaq_Vb%2CV_IND_INTR_1SG");
	await page.locator('#visualization-view [data-value="cards"]').click();
	await page.locator("#display-toggle").click();
	for (const [view, selector] of [["cards", ".slot-card"], ["ports", "[data-select-node]"]]) {
		await page.locator(`#visualization-view [data-value="${view}"]`).click();
		await page.locator('#opt-spelling [data-value="gloss-only"]').click();
		await expect(page.locator(selector).first()).toContainText("dog");
		await expect(page.locator(`${selector} .viz-form`)).toHaveCount(0);
		await page.locator('#opt-spelling [data-value="spelling-only"]').click();
		await expect(page.locator(`${selector} .viz-form`).first()).toHaveText("qimmeq");
		await expect(page.locator(`${selector} .viz-gloss`)).toHaveCount(0);
		await page.locator('#opt-spelling [data-value="both"]').click();
		await expect(page.locator(selector).first()).toContainText("qimmeq");
		await expect(page.locator(selector).first()).toContainText("dog");
	}
});

test("stepper displays engine-built prefixes and preserves the stage across languages", async ({ page }) => {
	await page.goto("/?chain=qimmeq%2CN_qaq_Vb%2CV_IND_INTR_1SG");
	await page.locator('#visualization-view [data-value="stepper"]').click();
	await expect(page.locator(".step-surface")).toHaveText("qimmeqarpunga");
	await page.locator('[data-stage="0"]').click();
	await expect(page.locator(".step-surface")).toHaveText("qimmeq");
	await page.locator('[data-stage="1"]').click();
	const expected = await page.evaluate(async () => {
		const { buildWord } = await import("/oq-api.js");
		const catalog = await (await import("/catalog.js")).loadCatalog();
		return buildWord(["qimmeq", "N_qaq_Vb"].flatMap((id) => catalog.presets.find((p) => p.id === id).seq));
	});
	await expect(page.locator(".step-surface")).toHaveText(expected.word);
	await expect(page.locator(".step-status")).toHaveText(expected.closed ? "Complete word" : "Open chain");
	await page.locator('#opt-lang [data-value="da"]').click();
	await expect(page.locator('[data-stage="1"]')).toHaveAttribute("aria-pressed", "true");
	await expect(page.locator(".step-meaning")).toContainText("hund");
	await page.locator("#display-toggle").click();
	await page.locator("#opt-fill-blanks").check();
	await expect(page.locator(".step-meaning")).toContainText("hund");
	await page.locator("#opt-fill-blanks").uncheck();
	await expect(page.locator(".step-meaning")).toContainText("hund");
	await expect(page.locator('[data-stage="1"] .viz-gloss')).toContainText("hund");
	await expect(page.locator('[data-stage="1"]')).toHaveAttribute("aria-pressed", "true");
});

test("invalid graph proposals retain every morpheme and Clear discards the draft", async ({ page }) => {
	await page.goto("/?chain=qimmeq%2CN_qaq_Vb%2CV_IND_INTR_1SG");
	await page.locator('#visualization-view [data-value="ports"]').click();
	await page.locator(".port-node").first().getByRole("button", { name: "Move right", exact: true }).click();
	await expect(page.locator(".port-node")).toHaveCount(3);
	await expect(page.locator(".visualization-status.is-error")).toBeVisible();
	await page.locator("#clear-canvas-btn").click();
	await expect(page.locator(".port-node")).toHaveCount(0);
	await expect(page.locator(".visualization-status")).not.toHaveClass(/is-error/);
});

test("live port graph shows engine class shifts and ending features", async ({ page }) => {
	await page.goto("/?chain=qimmeq%2CN_qaq_Vb%2CV_IND_INTR_1SG");
	await page.locator('#visualization-view [data-value="ports"]').click();
	await expect(page.locator(".port-node").nth(1)).toContainText("In: Noun");
	await expect(page.locator(".port-node").nth(1)).toContainText("Out: Verb");
	await page.locator("[data-select-node]").last().click();
	await expect(page.locator(".port-detail")).toContainText("indicative");
	await expect(page.locator(".port-detail")).toContainText("Person: 1");
});

test("live tree retains ordered derivation and unverified semantic evidence", async ({ page }) => {
	await page.goto("/?chain=qimmeq%2CN_qaq_Vb%2CV_IND_INTR_1SG");
	await page.locator('#visualization-view [data-value="tree"]').click();
	await expect(page.locator(".derivation-node")).toHaveCount(5);
	await expect(page.locator(".tree-surface span")).toHaveText(["qimme", "qar", "punga"]);
	await page.locator('.derivation-node[data-node="d-1"]').click();
	await expect(page.locator(".tree-surface .is-selected")).toHaveText(["qimme", "qar"]);
	await page.locator(".semantic-evidence summary").click();
	await expect(page.locator(".semantic-evidence")).toContainText("not certified");
});

test("interlinear tiers use engine surface spans and citation forms", async ({ page }) => {
	await page.goto("/?chain=qimmeq%2CN_qaq_Vb%2CV_IND_INTR_1SG");
	await page.locator('#visualization-view [data-value="interlinear"]').click();
	const rows = page.locator(".interlinear-table tbody tr");
	await expect(rows.nth(1).locator("td")).toHaveText(["qimme", "qar", "punga"]);
	await expect(rows.nth(0).locator("td").last()).toContainText("vunga");
	await expect(rows.nth(3).locator("td").last()).toContainText("punga");
});

test("engine-backed slot cards use actual surface and bilingual labels", async ({ page }) => {
	await page.goto("/?chain=qimmeq%2CN_qaq_Vb%2CV_IND_INTR_1SG");
	await expect(page.locator("#loading-modal")).toBeHidden({ timeout: 20_000 });
	await page.locator('#visualization-view [data-value="cards"]').click();
	await expect(page.locator(".slot-card")).toHaveCount(3);
	await expect(page.locator(".visualization-status")).toContainText("qimmeqarpunga");
	await expect(page.locator(".slot-card").first()).toContainText("dog");
	await page.locator('#opt-lang [data-value="da"]').click();
	await expect(page.locator(".slot-card").first()).toContainText("hund");
});

test("unfilled engine templates are default, optional accumulated meanings persist", async ({ page }) => {
	await page.goto("/?chain=qimmeq%2CN_qaq_Vb%2CV_IND_INTR_1SG");
	await page.locator('#visualization-view [data-value="ports"]').click();
	const gloss = page.locator(".port-node .viz-gloss").nth(1);
	await expect(gloss).toContainText("___");
	await expect(gloss).not.toContainText("dog");
	await page.locator("#display-toggle").click();
	await expect(page.locator("#opt-fill-blanks")).not.toBeChecked();
	await page.locator("#opt-fill-blanks").check();
	await expect(gloss).toContainText("dog");
	await page.reload();
	await page.locator('#visualization-view [data-value="ports"]').click();
	await expect(gloss).toContainText("dog");
	await page.locator("#display-toggle").click();
	await page.locator("#opt-fill-blanks").uncheck();
	await expect(gloss).toContainText("___");
	await page.locator("#word-input").fill("qimmeqarpunga");
	await page.locator("#word-input").press("Enter");
	await expect(page.locator(".breakdown-row").filter({ hasText: "qaq" }).locator(".breakdown-gloss")).toContainText("___");
	await page.locator("#opt-fill-blanks").check();
	await expect(page.locator(".breakdown-row").filter({ hasText: "qaq" }).locator(".breakdown-gloss")).toContainText("dog");
});

test("word cards and palettes match API colour triples across explicit and automatic themes", async ({ page }) => {
	await page.emulateMedia({ colorScheme: "light" });
	await page.goto("/?chain=qimmeq%2CN_qaq_Vb%2CV_IND_INTR_1SG");
	const verifyViews = async () => {
		for (const view of ["cards", "ports"]) {
			await page.locator(`#visualization-view [data-value="${view}"]`).click();
			if (view === "ports") await page.locator("[data-select-node]").first().click();
			await page.locator("#card-palette-filter").fill("qimmeq");
			const failures = await page.evaluate(async (view) => {
				const { getWordClassColors, WORD_CLASS_THEMES } = await import("/oq-api.js");
				const theme = document.documentElement.dataset.theme;
				const dark = theme === "dark" || (!theme && window.matchMedia("(prefers-color-scheme: dark)").matches);
				const cards = [...document.querySelectorAll(view === "cards" ? ".slot-card" : ".port-node")];
				const paths = ["nominal_root", "derivational_affix", "inflectional_affix"];
				const failures = [];
				for (const [index, path] of paths.entries()) {
					const expected = getWordClassColors([path], dark ? WORD_CLASS_THEMES.default : WORD_CLASS_THEMES.light);
					const sample = document.createElement("span");
					sample.style.backgroundColor = expected.fill; sample.style.color = expected.text; sample.style.border = `1px solid ${expected.border}`;
					document.body.append(sample);
					const elements = index === 0 ? [cards[index], document.querySelector('[data-preset-id="qimmeq"]')] : [cards[index]];
					for (const element of elements) for (const key of ["backgroundColor", "borderTopColor", "color"]) {
						if (window.getComputedStyle(element)[key] !== window.getComputedStyle(sample)[key]) failures.push(`${view} ${path} ${key}`);
					}
					if (view === "ports" && window.getComputedStyle(cards[index].querySelector("[data-select-node]")).color !== window.getComputedStyle(sample).color) failures.push(`port label ${path}`);
					sample.remove();
				}
				return failures;
			}, view);
			expect(failures).toEqual([]);
		}
	};
	await verifyViews();
	await page.locator("#theme-toggle").click(); // explicit light
	await verifyViews();
	await page.locator("#theme-toggle").click(); // explicit dark
	await verifyViews();
	await page.locator("#theme-toggle").click(); // auto with a dark OS preference
	await page.emulateMedia({ colorScheme: "dark" });
	await verifyViews();
});

test("Deconstruct links retain the routed visualization without leaking a Build chain", async ({ page }) => {
	await page.goto("/?w=qimmeqarpunga&view=stepper");
	await expect(page.locator(".step-surface")).toHaveText("qimmeqarpunga");
	await expect(page.locator(".step-meaning")).toContainText("dog");
	await page.locator('#visualization-view [data-value="ports"]').click();
	await expect(page).toHaveURL(/\?w=qimmeqarpunga&view=ports$/);
	await page.reload();
	await expect(page.locator(".port-node")).toHaveCount(3);
	await expect(page.locator('#visualization-view [data-value="ports"]')).toHaveAttribute("aria-checked", "true");
	await expect(page).not.toHaveURL(/chain=/);
});


test("surface ribbon uses pinned API spans and preserves the complete word", async ({ page }) => {
	await page.goto("/?chain=qimmeq%2CN_qaq_Vb%2CV_IND_INTR_1SG&view=ribbon");
	await expect(page.locator(".surface-ribbon .ribbon-morpheme > .ribbon-surface")).toHaveText(["qimme", "qar", "punga"]);
	await expect(page.locator(".ribbon-comparison")).toContainText("Citation form: qimmeq");
	await expect(page.locator(".ribbon-comparison")).toContainText("Surface: qimme");
	await expect(page.locator(".visualization-status")).toContainText("qimmeqarpunga");
	await expect(page.locator('#visualization-view [data-value="ribbon"]')).toHaveAttribute("aria-checked", "true");
	await page.locator(".ribbon-morpheme").nth(1).click();
	await expect(page.locator(".ribbon-changed")).toContainText("q");
	await expect(page.locator(".ribbon-comparison")).toContainText("Surface offsets: 5–8");
	await page.goto("/?chain=qimmeq%2CN_ABS_SG&view=ribbon");
	await expect(page.locator(".surface-ribbon .ribbon-morpheme > .ribbon-surface")).toHaveText(["qimmeq", "Ø"]);
	await expect(page.locator(".surface-ribbon .ribbon-morpheme").last()).toHaveAttribute("aria-label", /no written span/);
});

test("chain contrast builds both sides independently through the pinned API", async ({ page }) => {
	await page.goto("/?chain=qimmeq%2CN_qaq_Vb%2CV_IND_INTR_1SG&view=contrast&compare=qimmeq%2CN_qaq_Vb%2CV_IND_INTR_1SG");
	await expect(page.locator(".contrast-lane")).toHaveCount(2);
	await expect(page.locator(".contrast-lane .contrast-status")).toHaveText(["Complete word · qimmeqarpunga", "Complete word · qimmeqarpunga"]);
	await expect(page.locator(".contrast-shared")).toHaveCount(6);
	await expect(page.locator(".contrast-morpheme").nth(0)).toContainText("qimme");
	await expect(page.locator(".contrast-morpheme").nth(5)).toContainText("punga");
});

test("inflection grid includes only engine-built forms at API feature coordinates", async ({ page }) => {
	await page.goto("/?view=inflection&stem=neri");
	await expect(page.locator(".inflection-grid").first()).toBeVisible();
	const gridText = (await page.locator(".inflection-grid").allInnerTexts()).join(" ");
	expect(gridText).toContain("Statement");
	expect(gridText).toContain("nerivunga");
	expect(gridText).toContain("nerivoq");
	await expect(page.locator('#visualization-view [data-value="inflection"]')).toHaveAttribute("aria-checked", "true");
});
