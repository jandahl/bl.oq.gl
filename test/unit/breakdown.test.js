import test from "node:test";
import assert from "node:assert/strict";
import { wordTone, WORD_TONE_COUNT, renderBreakdown, renderTonedPhrases } from "../../docs/breakdown.js";

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
					const cls = sel.startsWith(".") ? sel.slice(1) : sel;
					return this.children.find((c) => c.className === cls || c.id === sel.replace(/^#/, "")) || null;
				},
				querySelectorAll(sel) {
					const cls = sel.startsWith(".") ? sel.slice(1) : sel;
					return this.children.filter((c) => c.className === cls);
				},
				get innerHTML() {
					return this.children.map((c) => `${c.className}:${c.textContent}`).join("|");
				},
				set innerHTML(_v) {
					this.children = [];
					this.textContent = "";
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
	// Rows are appended after the translation; composedTranslation shape is
	// covered in gloss.test.js — here we only need the fixture path to run.
	assert.ok(container.children.length >= 1);
});
