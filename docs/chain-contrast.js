import { alignChainIds } from "./contrast-model.js";
import { wordPresentation } from "./visualization-model.js";
import { applyMorphemeColours } from "./theme.js";
import { action, element, morphemeForm, nodeGloss } from "./visualizations.js";
import { t } from "./i18n.js";
import { contrastSuggestions } from "./exploration-examples.js";

export function renderChainContrast(host, left, options, deps) {
	const controls = element("section", "contrast-controls");
	const heading = element("h3", "", t("contrastChainPicker"));
	const label = element("label", ""); label.append(element("span", "", t("contrastSearch")));
	const search = element("input"); search.type = "search"; search.autocomplete = "off"; label.append(search);
	const choices = element("div", "contrast-search-results");
	const selected = element("ol", "contrast-selected");
	const ids = deps.getContrastChain().slice();
	const update = () => deps.setContrastChain(ids.slice());
	controls.append(element("p", "exploration-purpose", t("contrastPurpose")), element("p", "viz-secondary", t("contrastHowTo")));
	const examples = element("div", "exploration-examples");
	examples.append(element("strong", "", t("contrastTryChange")));
	const suggestions = contrastSuggestions(left.ids || [], deps.getPresetsById(), deps.engine.buildWord);
	for (const suggestion of suggestions) {
		const button = action(`${suggestion.surface} — ${t(suggestion.reason)}`, () => {
			ids.splice(0, ids.length, ...suggestion.ids); update(); drawSelected(); renderRight();
		});
		button.dataset.contrastSuggestion = suggestion.reason;
		examples.append(button);
	}
	if (!suggestions.length) examples.append(element("p", "viz-secondary", t("contrastNoSuggestions")));
	controls.append(examples);
	function drawSelected() {
		selected.replaceChildren();
		ids.forEach((id, index) => {
			const preset = deps.getPresetsById().get(id);
			const row = element("li", "");
			row.append(element("span", "", preset ? deps.label(preset, options) : `${t("missingContrastMorpheme")}: ${id}`));
			row.append(action(t("remove"), () => { ids.splice(index, 1); update(); drawSelected(); renderRight(); }));
			selected.append(row);
		});
	}
	function drawChoices() {
		choices.replaceChildren();
		const query = search.value.trim().toLowerCase();
		if (!query) return;
		const matches = deps.getPresets().filter((preset) => deps.matches(preset, query)).slice(0, 12);
		for (const preset of matches) choices.append(action(deps.label(preset, options), () => {
			ids.push(preset.id); update(); search.value = ""; drawChoices(); drawSelected(); renderRight();
		}));
		if (!matches.length) choices.append(element("p", "", t("contrastNoMatches")));
	}
	const lanes = element("div", "contrast-lanes");
	const leftLane = element("section", "contrast-lane");
	const rightLane = element("section", "contrast-lane");
	leftLane.append(element("h3", "", t("contrastLeft")));
	rightLane.append(element("h3", "", t("contrastRight")));
	const leftStatus = element("p", "contrast-status");
	const rightStatus = element("p", "contrast-status");
	const leftRows = element("ol", "contrast-morphemes");
	const rightRows = element("ol", "contrast-morphemes");
	leftLane.append(leftStatus, leftRows); rightLane.append(rightStatus, rightRows); lanes.append(leftLane, rightLane);
	function renderRight() {
		const right = wordPresentation(ids, deps.getPresetsById(), deps.getCatalog(), deps.engine, options);
		leftStatus.textContent = chainStatus(left, t);
		rightStatus.textContent = chainStatus(right, t);
		leftRows.replaceChildren(); rightRows.replaceChildren();
		const aligned = alignChainIds(left.ids || [], right.ids || []);
		for (const row of aligned) {
			leftRows.append(row.leftIndex == null ? emptyCell() : morphemeCell(left, row.leftIndex, options, deps, row.shared));
			rightRows.append(row.rightIndex == null ? emptyCell() : morphemeCell(right, row.rightIndex, options, deps, row.shared));
		}
		if (!aligned.length) {
			leftRows.append(element("li", "contrast-empty", t("contrastEmptyChain")));
			rightRows.append(element("li", "contrast-empty", t("contrastEmptyChain")));
		}
	}
	controls.append(heading, label, choices, selected);
	search.addEventListener("input", drawChoices);
	drawSelected(); renderRight();
	host.append(controls, lanes);
}

function emptyCell() { return element("li", "contrast-morpheme contrast-gap", "—"); }
function morphemeCell(word, index, options, deps, shared) {
	const node = word.graph?.nodes.find((entry) => entry.kind === "morpheme" && entry.seqIndex === index);
	const preset = deps.getPresetsById().get(word.ids[index]);
	const item = word.seq[index];
	const cell = element("li", "contrast-morpheme");
	applyMorphemeColours(cell, preset);
	if (node) {
		cell.append(element("strong", "", morphemeForm(node, item)));
		const realized = node.zero_surface ? "Ø" : node.surface?.surfaceText || t("noSurface");
		const offsets = node.surface ? ` · ${node.surface.surfaceStart}–${node.surface.surfaceEnd}` : "";
		cell.append(element("span", "", `${realized}${offsets}`));
		cell.append(element("span", "viz-gloss", nodeGloss(node, options) || t("noGloss")));
	} else cell.append(element("span", "", word.error || t("contrastUnavailable")));
	if (options.showIds) cell.append(element("code", "", word.ids[index]));
	if (shared) cell.append(element("small", "contrast-shared", t("contrastSharedId")));
	return cell;
}
function chainStatus(word, translate) {
	if (word.error) return word.error;
	if (!word.built?.ok) return translate("contrastUnavailable");
	return `${word.built.approximate ? translate("approximateChain") : word.built.closed ? translate("completeChain") : translate("openChain")} · ${word.built.word}`;
}
