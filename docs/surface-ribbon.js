import { surfaceRibbonSegments } from "./surface-ribbon-model.js";
import { applyMorphemeColours } from "./theme.js";
import { element, action, nodeGloss, morphemeForm } from "./visualizations.js";
import { t } from "./i18n.js";

export function renderSurfaceRibbon(host, word, options) {
	const nodes = word.graph?.nodes.filter((node) => node.kind === "morpheme") || [];
	if (!nodes.length) return;
	const alignment = surfaceRibbonSegments(word.built?.ok ? word.built.word : null, nodes);
	if (!alignment.aligned) {
		host.append(element("p", "visualization-status", t("surfaceAlignmentUnavailable")));
		const list = element("ol", "ribbon-unmapped-morphemes");
		for (const node of nodes) {
			const item = word.seq[node.seqIndex];
			const row = element("li"); applyMorphemeColours(row, item);
			row.append(element("strong", "viz-form", morphemeForm(node, item)));
			row.append(element("span", "viz-gloss", nodeGloss(node, options) || t("noGloss")));
			list.append(row);
		}
		host.append(list);
		return;
	}

	const ribbon = element("div", "surface-ribbon");
	ribbon.setAttribute("role", "group"); ribbon.setAttribute("aria-label", t("surfaceRibbon"));
	const detail = element("div", "ribbon-detail"); detail.setAttribute("aria-live", "polite");
	const buttons = [];
	for (const [index, segment] of alignment.segments.entries()) {
		if (segment.kind === "unmapped") {
			const literal = element("span", "ribbon-unmapped", segment.text);
			literal.setAttribute("aria-label", `${t("unmappedSurface")}: ${segment.text}`);
			ribbon.append(literal);
			continue;
		}
		const node = segment.node;
		const item = word.seq[node.seqIndex];
		const button = action("", () => {
			buttons.forEach((entry) => entry.button.setAttribute("aria-pressed", String(entry.button === button)));
			detail.replaceChildren(
				element("span", "ribbon-citation", `${t("citationForm")}: ${morphemeForm(node, item)}`),
				element("span", "ribbon-surface", `${t("surfaceForm")}: ${segment.text || "Ø"}`),
				element("span", "ribbon-gloss", `${t("morphemeGloss")}: ${nodeGloss(node, options) || t("noGloss")}`),
			);
		});
		button.className = "ribbon-morpheme api-morpheme-colours";
		button.setAttribute("aria-pressed", "false");
		if (node.zero_surface) button.setAttribute("aria-label", `${t("zeroSurface")}: ${nodeGloss(node, options) || t("noGloss")}`);
		button.dataset.seqIndex = String(node.seqIndex);
		applyMorphemeColours(button, item);
		button.style.flexGrow = String(Math.max(1, segment.end - segment.start));
		button.append(element("strong", "ribbon-surface", segment.text || "Ø"));
		if (options.spellingMode !== "spelling-only") button.append(element("span", "viz-gloss", nodeGloss(node, options) || t("noGloss")));
		if (options.showIds) button.append(element("code", "viz-id", node.morpheme_id || ""));
		ribbon.append(button); buttons.push({ button, index });
	}
	host.append(ribbon, detail);
	if (buttons.length) buttons[0].button.click();
}
