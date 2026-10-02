import { wordPresentation, editChain } from "./visualization-model.js";
import { t } from "./i18n.js";
import { renderInterlinear } from "./interlinear.js";
import { renderScopeTree } from "./scope-tree.js";
import { renderPortGraph } from "./port-graph.js";

export function element(tag, className, text) {
	const el = document.createElement(tag);
	if (className) el.className = className;
	if (text != null) el.textContent = String(text);
	return el;
}
export function action(text, run, disabled = false) {
	const button = element("button", "", text);
	button.type = "button";
	button.disabled = disabled;
	button.addEventListener("click", run);
	return button;
}
export function nodeGloss(node, options) {
	const langs = options.lang === "both" ? ["en", "da"] : [options.lang || "en"];
	return langs.map((lang) => node.labels?.[lang]?.gloss).filter(Boolean).join(" / ");
}

function renderCards(host, word, options, edit) {
	const row = element("div", "slot-cards");
	word.ids.forEach((id, index) => {
		const node = word.graph?.nodes.find((node) => node.kind === "morpheme" && node.seqIndex === index);
		const card = element("article", "slot-card");
		card.append(element("span", "viz-secondary", `${index + 1} · ${node?.zero_surface ? "Ø" : node?.surface?.marker || ""}`));
		card.append(element("strong", "", node?.surface?.citationText || word.seq[index]?.text || id));
		card.append(element("div", "", node ? nodeGloss(node, options) : id));
		if (options.showIds) card.append(element("code", "", id));
		const controls = element("div", "viz-actions");
		controls.append(action(t("moveLeft"), () => edit(index, "left"), index === 0), action(t("moveRight"), () => edit(index, "right"), index === word.ids.length - 1), action(t("remove"), () => edit(index, "remove")));
		card.append(controls);
		row.append(card);
	});
	host.append(row);
}

// Shared editor: Blockly remains the source of canvas state. Presentation
// controls submit an entire preserved sentence plan, including held words.
export function mountVisualizations(host, deps) {
	let selected = 0;
	let view = "blockly";
	let signature = "";
	let current = null;
	let limit = 24;
	let insertionIndex = null;
	let pendingPlan = null;
	const chooser = element("div", "visualization-toolbar");
	const viewLabel = element("label", "", t("visualization"));
	const viewSelect = element("select");
	viewSelect.id = "visualization-view";
	for (const [value, label] of [["blockly", "Blockly"], ["cards", t("slotCards")], ["interlinear", t("interlinear")], ["tree", t("derivationTree")], ["ports", t("portGraph")]]) {
		const option = element("option", "", label); option.value = value; viewSelect.append(option);
	}
	viewLabel.append(viewSelect);
	const wordLabel = element("label", "", t("selectedWord"));
	const wordSelect = element("select"); wordSelect.id = "visualization-word"; wordLabel.append(wordSelect);
	chooser.append(viewLabel, wordLabel);
	const panel = element("div", "visualization-panel"); panel.hidden = true;
	const viewport = element("div", "visualization-viewport");
	const status = element("p", "visualization-status"); status.setAttribute("aria-live", "polite");
	const palette = element("details", "card-palette"); palette.open = true;
	palette.append(element("summary", "", t("morphemePalette")));
	const filterLabel = element("label", "", t("paletteFilter"));
	const filter = element("input"); filter.type = "search"; filter.id = "card-palette-filter"; filterLabel.append(filter);
	const atLabel = element("label", "", t("insertAt"));
	const at = element("select"); at.id = "card-insert-at"; atLabel.append(at);
	const categoriesLabel = element("label", "", t("category"));
	const categories = element("select"); categories.id = "card-palette-category"; categoriesLabel.append(categories);
	const paletteControls = element("div", "visualization-toolbar"); paletteControls.append(filterLabel, categoriesLabel, atLabel);
	const entries = element("div", "palette-entries");
	palette.append(paletteControls, entries);
	panel.append(status, viewport, palette); host.replaceChildren(chooser, panel);

	function targets() {
		const plan = pendingPlan || deps.getPlan();
		return { plan, words: plan.flatMap((sentence, s) => (sentence.words || []).map((word, w) => ({ word, s, w }))) };
	}
	function edit(index, operation, id) {
		const { plan, words } = targets();
		const target = words[selected];
		if (target?.word.heldLabel) return;
		if (!target) plan.push({ words: [{ canvasIds: id ? [id] : [] }] });
		else plan[target.s].words[target.w].canvasIds = editChain(target.word.canvasIds || [], index, operation, id);
		pendingPlan = plan;
		if (deps.onChange(plan) !== false) pendingPlan = null;
		insertionIndex = null;
		signature = ""; refresh();
	}
	function renderPalette() {
		entries.replaceChildren();
		const list = deps.getPresets().filter((p) => (!categories.value || p.morpheme_type === categories.value) && deps.matches(p, filter.value.trim().toLowerCase()));
		for (const preset of list.slice(0, limit)) entries.append(action(deps.label(preset, deps.getOptions()), () => edit(Number(at.value), "insert", preset.id), Boolean(current?.held)));
		if (list.length > limit) entries.append(action(t("showMore"), () => { limit += 24; renderPalette(); }));
		if (!list.length) entries.append(element("p", "", t("noMorphemes")));
	}
	function refresh() {
		if (view === "blockly" && signature) return;
		const { words } = targets();
		selected = Math.min(selected, Math.max(0, words.length - 1));
		const options = deps.getOptions();
		const nextSignature = JSON.stringify([words.map((v) => v.word), options, selected, view, deps.getPresets().length]);
		if (signature === nextSignature) return;
		signature = nextSignature;
		wordSelect.replaceChildren();
		words.forEach(({ word }, index) => { const option = element("option", "", `${index + 1} · ${word.surface || word.raw || (word.canvasIds || []).join(" + ") || "…"}`); option.value = String(index); wordSelect.append(option); });
		wordSelect.value = String(selected); wordSelect.disabled = !words.length;
		const target = words[selected]?.word;
		current = target?.heldLabel ? { held: target.heldLabel, ids: [] } : wordPresentation(target?.canvasIds || [], deps.getPresetsById(), deps.getCatalog(), deps.engine, options);
		viewport.replaceChildren();
		status.classList.toggle("is-error", Boolean(target && current.error));
		status.textContent = !target ? t("emptyCanvasHint") : current.held || current.error || `${current.built?.word || ""} · ${current.built?.approximate ? t("approximateChain") : current.built?.closed ? t("completeChain") : t("openChain")}`;
		if (current.held) viewport.append(element("p", "", target?.surface || target?.raw || current.held));
		else if (view === "cards") renderCards(viewport, current, options, edit);
		else if (view === "interlinear") renderInterlinear(viewport, current, options);
		else if (view === "tree") renderScopeTree(viewport, current, options);
		else if (view === "ports") renderPortGraph(viewport, current, options, edit);
		palette.hidden = view !== "cards" && view !== "ports";
		at.replaceChildren();
		for (let i = 0; i <= current.ids.length; i++) { const option = element("option", "", i === current.ids.length ? t("endOfChain") : `${t("beforeMorpheme")} ${i + 1}`); option.value = String(i); at.append(option); }
		at.value = String(insertionIndex == null ? current.ids.length : Math.min(insertionIndex, current.ids.length));
		const oldCategory = categories.value; categories.replaceChildren();
		for (const value of ["", ...new Set(deps.getPresets().map((p) => p.morpheme_type).filter(Boolean))]) { const option = element("option", "", value || t("allCategories")); option.value = value; categories.append(option); }
		categories.value = oldCategory;
		renderPalette();
	}
	viewSelect.addEventListener("change", () => {
		view = viewSelect.value; panel.hidden = view === "blockly";
		deps.setBlocklyVisible(view === "blockly"); signature = ""; refresh();
	});
	wordSelect.addEventListener("change", () => { selected = Number(wordSelect.value); signature = ""; refresh(); });
	filter.addEventListener("input", () => { limit = 24; renderPalette(); });
	categories.addEventListener("change", () => { limit = 24; renderPalette(); });
	at.addEventListener("change", () => { insertionIndex = Number(at.value); });
	return { refresh, discardDraft: () => { pendingPlan = null; signature = ""; } };
}
