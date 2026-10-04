import { element, action, nodeGloss } from "./visualizations.js";
import { applyMorphemeColours } from "./theme.js";
import { t } from "./i18n.js";

export function renderInterlinear(host, word, options, presetsById = new Map()) {
	const nodes = word.graph?.nodes.filter((node) => node.kind === "morpheme") || [];
	if (!nodes.length) return;
	const table = element("table", "interlinear-table");
	table.append(element("caption", "", t("interlinear")));
	const rows = [t("citationForm"), t("surfaceForm"), t("morphemeGloss"), t("soundChange")].map((label) => {
		const row = element("tr"); const header = element("th", "", label); header.scope = "row"; row.append(header); return row;
	});
	const detail = element("p", "viz-secondary"); detail.setAttribute("aria-live", "polite");
	const buttons = [];
	nodes.forEach((node) => {
		const cells = rows.map(() => element("td"));
		cells.forEach((cell) => applyMorphemeColours(cell, presetsById.get(node.morpheme_id)));
		const form = node.zero_surface ? "Ø" : `${node.surface?.marker || ""}${node.surface?.citationText || word.seq[node.seqIndex]?.text || node.morpheme_id || "?"}`;
		const button = action(form, () => {
			buttons.forEach((item) => { const active = item.node === node; item.button.setAttribute("aria-pressed", String(active)); item.cells.forEach((cell) => cell.classList.toggle("is-selected", active)); });
			detail.textContent = `${form} · ${nodeGloss(node, options)}${options.showIds ? ` · ${node.morpheme_id}` : ""}`;
		});
		applyMorphemeColours(button, presetsById.get(node.morpheme_id));
		button.setAttribute("aria-pressed", "false"); cells[0].append(button);
		cells[1].textContent = node.zero_surface ? t("zeroSurface") : node.surface?.surfaceText ?? t("noSurface");
		cells[2].textContent = nodeGloss(node, options) || t("noGloss");
		const surface = node.surface;
		if (surface && (surface.changedRanges?.length || surface.citationText !== surface.surfaceText)) {
			const citation = surface.citationText;
			for (let i = 0; i < citation.length; i++) {
				const changed = surface.changedRanges?.some((range) => i >= range.start && i < range.end);
				cells[3].append(element(changed ? "del" : "span", "", citation[i]));
			}
			cells[3].append(element("span", "", ` → ${surface.surfaceText || "Ø"}`));
		} else cells[3].textContent = "—";
		if (options.showIds) cells[0].append(element("code", "viz-id", node.morpheme_id));
		cells.forEach((cell, i) => rows[i].append(cell));
		buttons.push({ node, button, cells });
	});
	const body = element("tbody"); body.append(...rows); table.append(body);
	const scroller = element("div", "interlinear-scroll"); scroller.append(table);
	host.append(scroller, detail);
}
