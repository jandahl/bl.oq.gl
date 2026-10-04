import { action, element, nodeGloss } from "./visualizations.js";
import { applyMorphemeColours } from "./theme.js";
import { t } from "./i18n.js";

const BAND_LABELS = { gold: "bandGold", hard_exact: "bandExact", soft_exact: "bandSoft", none: "bandNone", approximate: "approximateChain" };

/** Render the exact API-ranked analyses returned for one Deconstruct word. */
export function renderAnalysisLanes(host, readings, selectedIds, options, deps) {
	if (!readings.length) {
		host.append(element("p", "visualization-status", t("analysisLanesInstructions")));
		return;
	}
	const list = element("div", "analysis-lanes");
	list.setAttribute("role", "radiogroup");
	list.setAttribute("aria-label", t("analysisLanes"));
	const active = JSON.stringify(selectedIds);
	const selectedIndex = readings.findIndex((reading) => JSON.stringify((reading.seq || []).map((item) => item.id)) === active);
	readings.forEach((reading, index) => {
		const ids = (reading.seq || []).map((item) => item.id);
		const button = action("", () => {
			const result = deps.selectAnalysisReading?.(reading) ?? { error: t("analysisLaneSelectUnavailable") };
			if (result?.error) {
				const error = list.querySelector(".analysis-lanes-error") || element("p", "analysis-lanes-error is-error");
				error.textContent = result.error;
				list.prepend(error);
				return;
			}
			list.querySelectorAll("[role=radio]").forEach((lane) => {
				lane.setAttribute("aria-checked", String(lane === button));
				lane.tabIndex = lane === button ? 0 : -1;
			});
		});
		button.className = "analysis-lane";
		button.setAttribute("role", "radio");
		const isSelected = JSON.stringify(ids) === active;
		button.setAttribute("aria-checked", String(isSelected));
		button.tabIndex = index === (selectedIndex < 0 ? 0 : selectedIndex) ? 0 : -1;
		button.setAttribute("aria-label", t("analysisLaneLabel", { n: index + 1, word: reading.built?.word || "" }));
		button.dataset.analysisLane = String(index);
		button.addEventListener("keydown", (event) => {
			const lanes = [...list.querySelectorAll("[role=radio]")];
			const target = event.key === "Home" ? lanes[0]
				: event.key === "End" ? lanes.at(-1)
					: ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(event.key)
						? lanes[(index + (event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1) + lanes.length) % lanes.length]
						: null;
			if (target) { event.preventDefault(); target.focus(); target.click(); }
		});
		const heading = element("div", "analysis-lane-heading");
		heading.append(element("strong", "analysis-lane-rank", `${t("analysisLane") } ${index + 1}`));
		const bandKey = BAND_LABELS[reading.band];
		const statusKey = reading.built?.ok
			? reading.built.approximate ? "approximateChain" : reading.built.closed ? "completeChain" : "openChain"
			: "contrastUnavailable";
		if (reading.band && (!bandKey || bandKey !== statusKey)) heading.append(element("span", "analysis-lane-band", bandKey ? t(bandKey) : String(reading.band)));
		if (reading.built?.ok) {
			heading.append(element("span", "analysis-lane-status", t(statusKey)));
		} else heading.append(element("span", "analysis-lane-status is-error", t("contrastUnavailable")));
		button.append(heading);
		if (reading.built?.ok) button.append(element("span", "analysis-lane-surface", reading.built.word));
		const rows = element("ol", "analysis-lane-morphemes");
		let word = null;
		try {
			word = deps.engine.presentSequence(reading.seq || [], deps.getCatalog(), reading.built?.ok ? { word: reading.built.word } : {});
		} catch {
			// Preserve and show the API's IDs if a returned reading cannot be presented.
		}
		for (const [seqIndex, item] of (reading.seq || []).entries()) {
			const preset = deps.getPresetsById().get(item.id);
			const node = word?.nodes?.find((candidate) => candidate.kind === "morpheme" && candidate.seqIndex === seqIndex);
			const row = element("li", "analysis-lane-morpheme");
			if (preset) applyMorphemeColours(row, preset);
			if (node) {
				const realized = node.zero_surface ? "Ø" : node.surface?.surfaceText;
				row.append(element("strong", "viz-form", realized != null ? realized : t("analysisLaneSpanUnavailable")));
				row.append(element("span", "viz-gloss", nodeGloss(node, options) || t("noGloss")));
			} else {
				row.append(element("strong", "viz-form", t("analysisLaneSpanUnavailable")));
			}
			if (options.showIds) row.append(element("code", "viz-id", item.id || ""));
			rows.append(row);
		}
		if (reading.built?.ok && !reading.built.closed) button.append(element("p", "analysis-lane-note", t("openChain")));
		if (reading.built?.approximate) button.append(element("p", "analysis-lane-note", t("approximateChain")));
		button.append(rows);
		list.append(button);
	});
	const instruction = element("p", "analysis-lanes-instruction", t("analysisLanesSelect"));
	const note = readings.length === 1 ? element("p", "analysis-lanes-note", t("analysisLanesSingle")) : null;
	host.append(instruction, list);
	if (note) host.append(note);
}
