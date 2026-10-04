import { inflectionGridGroups } from "./inflection-grid-model.js";
import { applyMorphemeColours } from "./theme.js";
import { action, element } from "./visualizations.js";
import { moodDisplayLabel } from "./verb-endings.js";
import { t } from "./i18n.js";

export function renderInflectionGrid(host, options, deps) {
	const picker = element("section", "inflection-stem-picker");
	const searchLabel = element("label", ""); searchLabel.append(element("span", "", t("inflectionStemSearch")));
	const search = element("input"); search.type = "search"; search.autocomplete = "off"; searchLabel.append(search);
	const choices = element("div", "inflection-stem-results");
	const selected = element("p", "inflection-selected-stem");
	const status = element("p", "inflection-status", t("inflectionInstructions"));
	const tableHost = element("div", "inflection-grid-scroll");
	picker.append(searchLabel, choices, selected, status, tableHost);
	let stemId = deps.getInflectionStem();
	function render() {
		choices.replaceChildren();
		const query = search.value.trim().toLowerCase();
		if (query) {
			const matches = deps.getPresets().filter((preset) => ["stem", "root"].includes(preset.morpheme_type) && deps.matches(preset, query)).slice(0, 12);
			for (const preset of matches) choices.append(action(deps.label(preset, options), () => {
				stemId = preset.id; deps.setInflectionStem(stemId); search.value = ""; render();
			}));
			if (!matches.length) choices.append(element("p", "", t("inflectionNoStems")));
		}
		const stem = deps.getPresetsById().get(stemId);
		selected.textContent = stem ? `${t("inflectionSelected")}: ${deps.label(stem, options)}` : stemId ? `${t("missingInflectionStem")}: ${stemId}` : t("inflectionNoStem");
		tableHost.replaceChildren();
		if (!stem) { status.textContent = t("inflectionInstructions"); return; }
		const groups = inflectionGridGroups(deps.getPresets(), stem.word_class);
		if (!groups.length || !stem.seq?.length) {
			status.textContent = t("inflectionNoStructuredData"); return;
		}
		status.textContent = t("inflectionValidationNote");
		for (const group of groups) tableHost.append(renderGroup(group, stem, deps, options));
	}
	search.addEventListener("input", render);
	render(); host.append(picker);
}

function renderGroup(group, stem, deps, options) {
	const section = element("section", "inflection-group");
	section.append(element("h3", "", groupLabel(group.features, stem.word_class)));
	const table = element("table", "inflection-grid");
	table.append(element("caption", "", t("inflectionGridCaption")));
	const head = element("thead"); const header = element("tr");
	header.append(element("th", "", stem.word_class === "N" ? t("possessor") : t("subject")));
	for (const columnKey of group.columns) header.append(element("th", "", columnLabel(JSON.parse(columnKey), stem.word_class, deps)));
	head.append(header); table.append(head);
	const body = element("tbody");
	for (const rowKey of group.rows) {
		const row = element("tr"); row.append(element("th", "", rowLabel(JSON.parse(rowKey), stem.word_class, deps)));
		for (const columnKey of group.columns) {
			const cell = element("td", "inflection-cell");
			const candidates = group.cells.get(`${rowKey}\u0000${columnKey}`) || [];
			if (!candidates.length) cell.append(element("span", "inflection-unavailable", t("inflectionNotCatalogued")));
			for (const { preset } of candidates) {
				let built;
				try { built = deps.engine.buildWord([...stem.seq, ...preset.seq]); }
				catch { built = null; }
				if (built?.ok && built.closed && !built.approximate) {
					const form = element("div", "inflection-form"); applyMorphemeColours(form, preset);
					form.append(element("strong", "", built.word));
					if (preset.seq.some((item) => item.text === "")) form.append(element("span", "", "Ø"));
					form.append(element("span", "viz-gloss", deps.label(preset, options)));
					if (options.showIds) form.append(element("code", "", preset.id));
					cell.append(form);
				} else cell.append(element("span", "inflection-unavailable", unavailableStatus(built)));
			}
			row.append(cell);
		}
		body.append(row);
	}
	table.append(body); section.append(table);
	return section;
}

function groupLabel([first, second], wordClass) {
	return wordClass === "N" ? t(first) : `${t(first)} · ${t(second)}`;
}
function rowLabel(row, wordClass, deps) {
	if (wordClass === "N") return row[0] == null ? t("noPossessor") : personLabel(row[0], row[1], deps);
	const subject = personLabel(row[0], row[1], deps);
	return row[2] == null ? subject : `${subject} · ${t("object")}: ${personLabel(row[2], row[3], deps)}`;
}
function columnLabel(column, wordClass, deps) {
	if (wordClass === "N") return t(String(column).toLowerCase());
	return apiMoodLabel(column, deps);
}
function apiMoodLabel(mood, deps) {
	if (!deps.resolveMoodLabel) return t(mood);
	return moodDisplayLabel(mood, (key) => {
		const result = deps.resolveMoodLabel(key);
		return typeof result === "string" ? { text: result, title: null } : result;
	});
}
function personLabel(person, number, deps) {
	const result = deps.resolvePersonLabel?.(person, String(number).toUpperCase());
	return result || `${person} ${t(String(number).toLowerCase())}`;
}
function unavailableStatus(built) {
	if (!built?.ok) return t("inflectionInvalid");
	if (built.approximate) return t("inflectionApproximate");
	if (!built.closed) return t("inflectionOpen");
	return t("inflectionUnavailable");
}
