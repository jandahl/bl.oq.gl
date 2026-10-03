import { layoutDerivation } from "./tree-layout.js";
import { element, action, nodeGloss, appendMorphemeLabel } from "./visualizations.js";
import { t } from "./i18n.js";

export function renderScopeTree(host, word, options) {
	if (!word.graph?.derivation?.root) return;
	const graph = word.graph;
	let layout;
	try { layout = layoutDerivation(graph); }
	catch (error) { host.append(element("p", "visualization-status is-error", error.message)); return; }
	host.append(element("p", "viz-secondary", t("orderedDerivationOnly")));
	const scroll = element("div", "tree-scroll");
	scroll.setAttribute("role", "region"); scroll.setAttribute("aria-label", t("derivationTree")); scroll.tabIndex = 0;
	const board = element("div", "derivation-board"); board.style.width = `${layout.width}px`; board.style.height = `${layout.height}px`;
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`); svg.setAttribute("aria-hidden", "true");
	const positions = new Map(layout.nodes.map((node) => [node.id, node]));
	for (const edge of layout.edges) {
		const a = positions.get(edge.parent), b = positions.get(edge.operand);
		if (!a || !b) continue;
		const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
		path.setAttribute("d", `M${a.x},${a.y + 82} C${a.x},${a.y + 100} ${b.x},${b.y - 18} ${b.x},${b.y}`);
		path.dataset.parent = edge.parent; path.dataset.operand = edge.operand; svg.append(path);
	}
	board.append(svg);
	const surface = element("div", "tree-surface");
	const morphemes = graph.nodes.filter((node) => node.kind === "morpheme");
	for (const node of morphemes) { const span = element("span", "", node.zero_surface ? "Ø" : node.surface?.surfaceText ?? "?"); span.dataset.node = node.id; surface.append(span); }
	const detail = element("p", "viz-secondary"); detail.setAttribute("aria-live", "polite");
	function labelNode(host, node) {
		if (node.kind === "morpheme") appendMorphemeLabel(host, node, word.seq[node.seqIndex], options);
		else {
			host.append(element("strong", "", t("derivedExpression")));
			if (options.spellingMode !== "spelling-only") host.append(element("span", "viz-gloss", nodeGloss(node, options)));
		}
	}
	for (const placed of layout.nodes.slice().sort((a, b) => a.depth - b.depth || a.x - b.x)) {
		const node = graph.nodes.find((node) => node.id === placed.id);
		const button = action("", () => {
			board.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.node === node.id)));
			surface.querySelectorAll("span").forEach((span) => span.classList.toggle("is-selected", placed.leaves.includes(span.dataset.node)));
			detail.replaceChildren(); labelNode(detail, node);
		});
		button.className = "derivation-node"; button.dataset.node = node.id; button.setAttribute("aria-pressed", "false");
		button.style.left = `${placed.x - 95}px`; button.style.top = `${placed.y}px`;
		labelNode(button, node);
		if (options.showIds) button.append(element("code", "viz-id", node.id));
		board.append(button);
	}
	scroll.append(board); host.append(scroll, surface, detail);
	const evidence = element("details", "semantic-evidence");
	evidence.append(element("summary", "", `${t("semanticEvidence")} · ${graph.semantics.status}`));
	evidence.append(element("p", "viz-secondary", t("semanticUnverified")));
	const list = element("ul");
	const nameFor = (id) => {
		const node = graph.nodes.find((node) => node.id === id);
		return node ? nodeGloss(node, options) || node.type || node.morpheme_id || node.kind : id;
	};
	for (const edge of graph.semantics.edges) list.append(element("li", "", `${nameFor(edge.parent)} → ${nameFor(edge.operand)} · ${edge.relation}`));
	for (const obligation of graph.obligations || []) list.append(element("li", "", obligation.reason || obligation.kind));
	if (!list.children.length) list.append(element("li", "", t("noSemanticEdges")));
	evidence.append(list); host.append(evidence);
}
