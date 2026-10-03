import { wordPresentation, editChain, normalizeEditablePlan } from "./visualization-model.js";
import { t, getLocale, applyLocale } from "./i18n.js";
import { renderInterlinear } from "./interlinear.js";
import { renderScopeTree } from "./scope-tree.js";
import { renderPortGraph } from "./port-graph.js";
import { renderStepper } from "./stepper.js";

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

export function morphemeForm(node, item) {
	if (node?.zero_surface || item?.text === "") return "Ø";
	return node?.surface ? `${node.surface.marker || ""}${node.surface.citationText}` : item?.text || t("noSurface");
}
export function appendMorphemeLabel(host, node, item, options) {
	if (options.spellingMode !== "gloss-only") host.append(element("strong", "viz-form", morphemeForm(node, item)));
	if (options.spellingMode !== "spelling-only") host.append(element("span", "viz-gloss", node ? nodeGloss(node, options) || t("noGloss") : t("noGloss")));
}
export function editControls(index, count, edit) {
	const controls = element("div", "viz-actions");
	for (const [operation, key, disabled] of [["left", "moveLeft", index === 0], ["right", "moveRight", index === count - 1], ["remove", "remove", false]]) {
		const button = action(t(key), () => edit(index, operation), disabled);
		button.dataset.editIndex = String(index); button.dataset.editOperation = operation;
		controls.append(button);
	}
	return controls;
}

function localized(tag, key) {
	const el = element(tag, "", t(key)); el.dataset.i18n = key; return el;
}

function renderCards(host, word, options, edit) {
	const row = element("div", "slot-cards");
	word.ids.forEach((id, index) => {
		const node = word.graph?.nodes.find((node) => node.kind === "morpheme" && node.seqIndex === index);
		const card = element("article", "slot-card");
		card.append(element("span", "viz-secondary", String(index + 1)));
		appendMorphemeLabel(card, node, word.seq[index], options);
		if (options.showIds) card.append(element("code", "", id));
		card.append(editControls(index, word.ids.length, edit));
		row.append(card);
	});
	host.append(row);
}

// Shared editor: Blockly remains the source of canvas state. Presentation
// controls submit an entire preserved sentence plan, including held words.
// onChange synchronously returns true or an engine rejection { error }.
export function mountVisualizations(host, deps) {
	let selected = 0;
	let view = "blockly";
	let signature = "";
	let current = null;
	let limit = 24;
	let insertionIndex = null;
	let pendingPlan = null;
	let pendingSource = "";
	let pendingError = "";
	const chooser = element("div", "visualization-toolbar");
	const viewLabel = element("label"); viewLabel.append(localized("span", "visualization"));
	const viewSelect = element("select");
	viewSelect.id = "visualization-view";
	for (const [value, key] of [["blockly", null], ["cards", "slotCards"], ["interlinear", "interlinear"], ["tree", "derivationTree"], ["ports", "portGraph"], ["stepper", "derivationStepper"]]) {
		const option = key ? localized("option", key) : element("option", "", "Blockly"); option.value = value; viewSelect.append(option);
	}
	viewLabel.append(viewSelect);
	const wordLabel = element("label"); wordLabel.append(localized("span", "selectedWord"));
	const wordSelect = element("select"); wordSelect.id = "visualization-word"; wordLabel.append(wordSelect);
	chooser.append(viewLabel, wordLabel);
	const panel = element("div", "visualization-panel"); panel.hidden = true;
	const viewport = element("div", "visualization-viewport");
	const status = element("p", "visualization-status"); status.setAttribute("aria-live", "polite");
	const palette = element("details", "card-palette"); palette.open = true;
	palette.append(localized("summary", "morphemePalette"));
	const filterLabel = element("label"); filterLabel.append(localized("span", "paletteFilter"));
	const filter = element("input"); filter.type = "search"; filter.id = "card-palette-filter"; filterLabel.append(filter);
	const atLabel = element("label"); atLabel.append(localized("span", "insertAt"));
	const at = element("select"); at.id = "card-insert-at"; atLabel.append(at);
	const categoriesLabel = element("label"); categoriesLabel.append(localized("span", "category"));
	const categories = element("select"); categories.id = "card-palette-category"; categoriesLabel.append(categories);
	const paletteControls = element("div", "visualization-toolbar"); paletteControls.append(filterLabel, categoriesLabel, atLabel);
	const entries = element("div", "palette-entries");
	palette.append(paletteControls, entries);
	panel.append(status, viewport, palette); host.replaceChildren(chooser, panel);

	function targets() {
		const canvas = deps.getPlan();
		// A rejected draft belongs to the canvas snapshot it was edited from.
		// External edits must not let that draft replace a newer canvas.
		if (pendingPlan && pendingSource !== JSON.stringify(canvas)) discardDraft();
		const plan = pendingPlan || canvas;
		return { plan, words: plan.flatMap((sentence, s) => (sentence.words || []).map((word, w) => ({ word, s, w }))) };
	}
	function edit(index, operation, id) {
		const focused = document.activeElement;
		const restoreFocus = host.contains(focused);
		const presetId = focused?.dataset?.presetId;
		const { plan, words } = targets();
		const target = words[selected];
		if (target?.word.heldLabel) return;
		if (!target && operation !== "insert") { signature = ""; refresh(); return; }
		if (!target) plan.push({ words: [{ canvasIds: [id] }] });
		else plan[target.s].words[target.w].canvasIds = editChain(target.word.canvasIds || [], index, operation, id);
		pendingSource = JSON.stringify(deps.getPlan());
		pendingPlan = normalizeEditablePlan(plan);
		pendingError = "";
		const outcome = deps.onChange(pendingPlan);
		if (outcome?.error) pendingError = outcome.error;
		else discardDraft();
		insertionIndex = null;
		signature = ""; refresh();
		if (restoreFocus) {
			const fallback = current.held ? wordSelect : palette.open ? filter : palette.querySelector("summary");
			if (presetId) {
				([...entries.querySelectorAll("[data-preset-id]")].find((button) => button.dataset.presetId === presetId && !button.disabled) || fallback).focus();
			} else {
				const to = operation === "left" ? index - 1 : operation === "right" ? index + 1 : index;
				const slot = Math.min(Math.max(0, to), current.ids.length - 1);
				const controls = [...viewport.querySelectorAll(`[data-edit-index="${slot}"]`)].filter((button) => !button.disabled);
				(controls.find((button) => button.dataset.editOperation === operation) || controls[0] || fallback).focus();
			}
		}
	}
	function renderPalette() {
		entries.replaceChildren();
		const list = deps.getPresets().filter((p) => (!categories.value || p.morpheme_type === categories.value) && deps.matches(p, filter.value.trim().toLowerCase()));
		for (const preset of list.slice(0, limit)) {
			const button = action(deps.label(preset, deps.getOptions()), () => edit(Number(at.value), "insert", preset.id), Boolean(current?.held));
			button.dataset.presetId = preset.id; entries.append(button);
		}
		if (list.length > limit) entries.append(action(t("showMore"), () => { limit += 24; renderPalette(); }));
		if (!list.length) entries.append(element("p", "", t("noMorphemes")));
	}
	function refresh() {
		applyLocale(host);
		const { words } = targets();
		selected = Math.min(selected, Math.max(0, words.length - 1));
		const options = deps.getOptions();
		const nextSignature = JSON.stringify([words.map((v) => v.word), options, getLocale(), selected, view, deps.getPresets().length]);
		if (signature === nextSignature) return;
		signature = nextSignature;
		wordSelect.replaceChildren();
		words.forEach(({ word }, index) => {
			let label = word.surface || word.raw || "…";
			const ids = word.canvasIds || [];
			if (!word.heldLabel && ids.length) {
				const presets = deps.getPresetsById();
				if (ids.every((id) => presets.has(id))) {
					const seq = ids.flatMap((id) => presets.get(id).seq);
				try {
					const built = deps.engine.buildWord(seq);
					label = built.ok ? `${built.approximate ? "≈ " : ""}${built.word}` : seq.map((item) => morphemeForm(null, item)).join(" + ");
				}
				catch { label = t("noSurface"); }
			} else label = t("noSurface");
				if (options.showIds) label += ` · ${ids.join(" + ")}`;
			}
			const option = element("option", "", `${index + 1} · ${label}`); option.value = String(index); wordSelect.append(option);
		});
		wordSelect.value = String(selected); wordSelect.disabled = !words.length;
		if (view === "blockly") return;
		const target = words[selected]?.word;
		current = target?.heldLabel ? { held: target.heldLabel, ids: [] } : wordPresentation(target?.canvasIds || [], deps.getPresetsById(), deps.getCatalog(), deps.engine, options);
		viewport.replaceChildren();
		status.classList.toggle("is-error", Boolean(target && current.error));
		status.textContent = !target ? t("emptyCanvasHint") : (current.held ? t(current.held) : current.error) || `${current.built?.word || ""} · ${current.built?.approximate ? t("approximateChain") : current.built?.closed ? t("completeChain") : t("openChain")}`;
		if (current.held) viewport.append(element("p", "", target?.surface || target?.raw || current.held));
		else if (view === "cards") renderCards(viewport, current, options, edit);
		else if (view === "interlinear") renderInterlinear(viewport, current, options);
		else if (view === "tree") renderScopeTree(viewport, current, options);
		else if (view === "ports") renderPortGraph(viewport, current, options, edit);
		else if (view === "stepper") renderStepper(viewport, current, options, deps.engine);
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
	function discardDraft() { pendingPlan = null; pendingSource = ""; pendingError = ""; signature = ""; }
	return { refresh, discardDraft, getDraftError: () => pendingPlan && view !== "blockly" ? pendingError : "" };
}
