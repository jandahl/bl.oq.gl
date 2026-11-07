import test from "node:test";
import assert from "node:assert/strict";
import {
	wordTone,
	WORD_TONE_COUNT,
	renderBreakdown,
	renderTonedPhrases,
	renderSentenceBreakdown,
	renderWordBreakdowns,
	oqDictionaryUrl,
	oqDeconstructUrl,
	oqBuilderUrl,
} from "../../docs/breakdown.js";

function matches(el, sel) {
	if (sel.startsWith(".")) return String(el.className || "").split(/\s+/).includes(sel.slice(1));
	if (sel.startsWith("#")) return el.id === sel.slice(1);
	return el.tagName === sel.toUpperCase();
}

function queryAll(root, sel) {
	const found = [];
	for (const child of root.children || []) {
		if (matches(child, sel)) found.push(child);
		found.push(...queryAll(child, sel));
	}
	return found;
}

function serialize(el) {
	const own = el.textContent ? `${el.className}:${el.textContent}` : "";
	const nested = (el.children || []).map(serialize).filter(Boolean).join("|");
	return [own, nested].filter(Boolean).join("|");
}

function installDomShim() {
	if (typeof document !== "undefined") return;
	globalThis.document = {
			createElement(tag) {
			const el = {
				tagName: tag.toUpperCase(),
				className: "",
				dataset: {},
				textContent: "",
				children: [],
				style: {},
				appendChild(child) {
					this.children.push(child);
					return child;
				},
				append(...nodes) {
					for (const n of nodes) {
						if (typeof n === "string") this.textContent += n;
						else this.children.push(n);
					}
				},
				replaceChildren(...nodes) {
					this.children = [];
					this.textContent = "";
					this.append(...nodes);
				},
				querySelector(sel) {
					return queryAll(this, sel)[0] || null;
				},
				querySelectorAll(sel) {
					return queryAll(this, sel);
				},
				get innerHTML() {
					return serialize(this);
				},
				set innerHTML(_v) {
					this.children = [];
					this.textContent = "";
				},
			};
			el.classList = {
				add(...names) {
					const set = new Set(String(el.className || "").split(/\s+/).filter(Boolean));
					for (const name of names) set.add(name);
					el.className = [...set].join(" ");
				},
				contains(name) {
					return String(el.className || "").split(/\s+/).includes(name);
				},
			};
			return el;
		},
	};
}

test("wordTone cycles through a stable palette", () => {
	assert.equal(wordTone(0), "0");
	assert.equal(wordTone(1), "1");
	assert.equal(wordTone(WORD_TONE_COUNT), "0");
	assert.equal(wordTone(WORD_TONE_COUNT + 2), "2");
	assert.equal(wordTone(-1), String(WORD_TONE_COUNT - 1));
});

test("renderTonedPhrases paints fixture surfaces without a live catalog", () => {
	installDomShim();
	const container = document.createElement("div");
	renderTonedPhrases(container, ["qimmeq", "nerivoq"], "status-word");
	assert.equal(container.children.length, 2);
	assert.equal(container.children[0].textContent, "qimmeq");
	assert.equal(container.children[0].dataset.wordTone, "0");
	assert.equal(container.children[1].textContent, "nerivoq");
	assert.equal(container.children[1].dataset.wordTone, "1");
});

test("renderBreakdown: fixture seq renders via injected glossSummaryItems", () => {
	installDomShim();
	const container = document.createElement("div");
	const seq = [
		{ id: "qimmeq", text: "qimmeq" },
		{ id: "N_qaq_Vb", text: "-qaq" },
		{ id: "V_IND_INTR_1SG", text: "-vunga" },
	];
	const glossSummaryItems = (items) => items.map((item) => ({
		spelling: item.text,
		gloss: item.id === "qimmeq" ? "dog" : item.id === "N_qaq_Vb" ? "have a ___" : "I",
		id: item.id,
	}));
	const headlineGloss = (items) => items.map((i) => i.gloss).join(" ");
	renderBreakdown(container, "qimmeqarpunga", seq, { word: "qimmeqarpunga", approximate: false, closed: true }, glossSummaryItems, {
		lang: "en",
		headlineGloss,
	});
	assert.match(container.innerHTML, /qimmeqarpunga/);
	const heading = container.querySelector(".breakdown-word");
	assert.ok(heading);
	assert.equal(heading.textContent, "qimmeqarpunga");
	const marthaBtn = container.querySelector(".martha-link");
	const marthaPage = container.querySelector(".martha-page-link");
	assert.ok(marthaBtn);
	assert.equal(marthaBtn.dataset.marthaWord, "qimmeqarpunga");
	assert.ok(marthaPage);
	assert.match(marthaPage.href, /oqaasileriffik\.gl.*st=qimmeqarpunga/);
	// Rows are appended after the translation; composedTranslation shape is
	// covered in gloss.test.js — here we only need the fixture path to run.
	assert.ok(container.children.length >= 1);
});

test("renderBreakdown keeps a sibling reading band across a re-render", () => {
	installDomShim();
	const article = document.createElement("article");
	const band = document.createElement("p");
	band.className = "reading-band";
	band.textContent = "exact · qimmeqarpunga";
	article.appendChild(band);
	const seq = [{ id: "qimmeq", text: "qimmeq" }];
	const built = { word: "qimmeqarpunga", approximate: false, closed: true };
	const glossSummaryItems = () => [];
	renderBreakdown(article, "qimmeqarpunga", seq, built, glossSummaryItems, { lang: "en" });
	renderBreakdown(article, "qimmeqarpunga", seq, built, glossSummaryItems, { lang: "en" });
	assert.equal(article.children[0], band);
	assert.equal(band.textContent, "exact · qimmeqarpunga");
	assert.equal(article.querySelectorAll(".reading-band").length, 1);
	assert.equal(article.querySelectorAll(".breakdown-body").length, 1);
	assert.equal(article.querySelector(".breakdown-word").textContent, "qimmeqarpunga");
});

test("renderSentenceBreakdown shows a band for a built word and does not draw a missing word as a chain", () => {
	installDomShim();
	const container = document.createElement("div");
	const seq = [{ id: "qimmeq", text: "qimmeq", marker: "" }];
	const plan = {
		sentences: [{
			source: "Qimmeq ajorpoq.",
			assembly: { text: "The dog is bad.", mode: "serial" },
			words: [
				{
					surface: "qimmeq",
					raw: "qimmeq",
					band: "hard_exact",
					seq,
					built: { ok: true, word: "qimmeq", approximate: false, closed: true },
				},
				{
					surface: "ajorpoq",
					raw: "ajorpoq",
					band: "none",
					canvasIds: [],
					headline: "is bad",
					note: "Catalog entry has no builder sequence.",
				},
			],
		}],
	};
	let seenPrefs = null;
	const glossSummaryItems = (items, glossOpts) => {
		seenPrefs = glossOpts;
		return items.map((item) => ({
			text: item.text,
			marker: "",
			gloss: "dog",
			id: item.id,
		}));
	};
	const meta = renderSentenceBreakdown(container, plan, glossSummaryItems, {
		t: (_key, vars) => vars?.text ?? "not-on-canvas",
		lang: "en",
		headlineGloss: (items) => items.map((item) => item.gloss).join(" "),
		visibleAssembly: (assembly) => assembly.text,
		presentationPreferences: { numberPreference: "plural", determinationPreference: "definite" },
	});
	const articles = container.querySelectorAll("article");
	assert.equal(articles.length, 2);
	assert.equal(articles[0].querySelector(".reading-band").textContent, "exact · qimmeq");
	assert.ok(articles[0].querySelector(".breakdown-body"));
	assert.equal(articles[1].querySelector(".reading-band").textContent, "unparsed · ajorpoq");
	assert.equal(articles[1].querySelector(".breakdown-note").textContent, "Catalog entry has no builder sequence.");
	assert.equal(articles[1].querySelector(".breakdown-row"), null);
	assert.equal(articles[1].querySelector(".breakdown-body"), null);
	assert.equal(meta, "The dog is bad.");
	assert.equal(seenPrefs.numberPreference, "plural");
	assert.equal(seenPrefs.determinationPreference, "definite");
	const firstOqBuilder = articles[0].querySelector(".oq-builder-link");
	assert.ok(firstOqBuilder);
	assert.equal(firstOqBuilder.href, "https://oq.gl/builder/?seq=%5B%22qimmeq%22%5D");
	const secondOqDeconstruct = articles[1].querySelector(".oq-deconstruct-link");
	assert.ok(secondOqDeconstruct);
	assert.equal(secondOqDeconstruct.href, "https://oq.gl/deconstruct/?w=ajorpoq");
});

test("OQ cross-link helpers respect honesty boundary and strip trailing N_ABS_SG for OQ Builder", () => {
	installDomShim();
	assert.equal(oqDictionaryUrl("≈ qimmeq"), "https://oq.gl/?q=qimmeq");
	assert.equal(oqDeconstructUrl("qimmeqarpunga", "N_qaq_Vb"), "https://oq.gl/deconstruct/?w=qimmeqarpunga&detail=N_qaq_Vb");
	assert.equal(
		oqBuilderUrl([{ id: "qimmeq" }, { id: "N_ABS_SG" }]),
		"https://oq.gl/builder/?seq=%5B%22qimmeq%22%5D",
	);

	// Approximate or open breakdowns link to OQ Deconstruct, never OQ Builder.
	const approxContainer = document.createElement("div");
	const seq = [{ id: "qimmeq", text: "qimmeq", marker: "" }];
	const glossSummaryItems = (items) => items.map((item) => ({ text: item.text, marker: "", gloss: "dog", id: item.id }));
	renderBreakdown(approxContainer, "qimmeq", seq, { word: "qimmeq", approximate: true, closed: true }, glossSummaryItems, { lang: "en" });
	assert.equal(approxContainer.querySelector(".oq-builder-link"), null);
	assert.equal(approxContainer.querySelector(".oq-deconstruct-link")?.href, "https://oq.gl/deconstruct/?w=qimmeq");
	assert.equal(approxContainer.querySelector(".oq-dict-link")?.href, "https://oq.gl/?q=qimmeq");
	assert.equal(
		approxContainer.querySelector(".breakdown-spelling")?.href,
		"https://oq.gl/deconstruct/?w=qimmeq&detail=qimmeq",
	);

	// Missing word in renderWordBreakdowns still gets OQ Lookup and Deconstruct links.
	const missingContainer = document.createElement("div");
	renderWordBreakdowns(missingContainer, [{ word: "illu", missing: true, seq: null, built: null }], glossSummaryItems, { lang: "en" });
	assert.equal(missingContainer.querySelector(".oq-dict-link")?.href, "https://oq.gl/?q=illu");
	assert.equal(missingContainer.querySelector(".oq-deconstruct-link")?.href, "https://oq.gl/deconstruct/?w=illu");
});
