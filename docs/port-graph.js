import { element, action, nodeGloss, appendMorphemeLabel, editControls } from "./visualizations.js";
import { classPorts } from "./port-model.js";
import { t } from "./i18n.js";

export function renderPortGraph(host, word, options, edit, onSelect = () => {}, selectedNode = null) {
	const nodes = word.graph?.nodes.filter((node) => node.kind === "morpheme") || [];
	if (!nodes.length) return;
	host.append(element("p", "viz-secondary", t("portGraphInstruction")));
	const path = element("ol", "port-path"); path.setAttribute("aria-label", t("portGraph"));
	const detail = element("div", "port-detail"); detail.setAttribute("aria-live", "polite");
	const fields = (node) => {
		const inflection = node.labels?.[options.lang === "da" ? "da" : "en"]?.inflection || word.seq[node.seqIndex]?.inflection;
		detail.replaceChildren(element("strong", "", nodeGloss(node, options)));
		if (inflection) {
			const list = element("dl", "port-features");
			for (const [key, value] of Object.entries(inflection)) {
				list.append(element("dt", "", t(key)), element("dd", "", typeof value === "object" ? Object.entries(value || {}).map(([k, v]) => `${t(k)}: ${v}`).join(" · ") : String(value)));
			}
			detail.append(list);
		}
		if (options.showIds) detail.append(element("code", "viz-id", node.morpheme_id));
	};
	for (const [index, node] of nodes.entries()) {
		const li = element("li", "port-node");
		const ports = classPorts(word.seq[node.seqIndex]);
		const select = action("", () => { path.querySelectorAll("[data-select-node]").forEach((b) => b.setAttribute("aria-pressed", String(b === select))); fields(node); onSelect(index); });
		select.dataset.selectNode = node.id; select.setAttribute("aria-pressed", String(index === selectedNode));
		if (index === selectedNode) fields(node);
		appendMorphemeLabel(select, node, word.seq[node.seqIndex], options);
		li.append(select);
		if (index > 0) { const anchor = element("span", "port-anchor incoming"); anchor.setAttribute("aria-hidden", "true"); li.append(anchor); }
		if (index < nodes.length - 1) { const anchor = element("span", "port-anchor outgoing"); anchor.setAttribute("aria-hidden", "true"); li.append(anchor); }
		const portLabels = element("div", "port-labels");
		if (index > 0) portLabels.append(element("span", "port-in", `${t("inputPort")}: ${className(ports.input)}`));
		if (index < nodes.length - 1 || !word.built?.closed) portLabels.append(element("span", "port-out", `${t("outputPort")}: ${className(ports.output)}`));
		li.append(portLabels);
		// The card edit model is indexed by catalog slots. Engine occurrences
		// from compound presets can be inspected but never mis-edit a slot.
		if (word.seq.length === word.ids.length) li.append(editControls(index, nodes.length, edit));
		path.append(li);
	}
	host.append(path, detail);
}

function className(value) { return value === "N" ? t("noun") : value === "V" ? t("verb") : value || "?"; }
