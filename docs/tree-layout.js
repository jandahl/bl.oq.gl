// @ts-check
/** @typedef {{id: string, x: number, y: number, width: number, height: number, depth: number, leaf: boolean, leaves: string[]}} PositionedNode */
/** @param {{nodes: any[], derivation: {root: string|null, edges: {parent: string, operand: string, relation: string}[]}}} graph */
export function layoutDerivation(graph) {
	const byId = new Map(graph.nodes.map((node) => [node.id, node]));
	/** @type {PositionedNode[]} */
	const positioned = [];
	let leafCount = 0;
	let maxDepth = 0;
	/** @param {string} id @param {number} depth @param {Set<string>} ancestors @returns {PositionedNode} */
	function visit(id, depth, ancestors) {
		if (ancestors.has(id)) throw new Error("Cyclic derivation graph");
		if (!byId.has(id)) throw new Error(`Missing derivation node: ${id}`);
		const children = graph.derivation.edges.filter((edge) => edge.parent === id);
		const path = new Set(ancestors); path.add(id);
		const descendants = children.map((edge) => visit(edge.operand, depth + 1, path));
		const x = descendants.length ? (descendants[0].x + descendants[descendants.length - 1].x) / 2 : leafCount++ * 210 + 105;
		maxDepth = Math.max(maxDepth, depth);
		const node = { id, x, y: depth * 115 + (depth ? 32 : 0), width: depth ? 190 : 280, height: depth ? 82 : 114, depth, leaf: children.length === 0, leaves: descendants.length ? descendants.flatMap((child) => child.leaves) : [id] };
		positioned.push(node); return node;
	}
	if (graph.derivation.root) visit(graph.derivation.root, 0, new Set());
	for (const node of positioned) if (node.leaf && maxDepth) node.y = maxDepth * 115 + 32;
	const leftInset = Math.max(0, ...positioned.map((node) => node.width / 2 - node.x));
	for (const node of positioned) node.x += leftInset;
	return { nodes: positioned, edges: graph.derivation.edges, width: Math.max(280, leafCount * 210 + leftInset, ...positioned.map((node) => node.x + node.width / 2)), height: Math.max(100, ...positioned.map((node) => node.y + node.height + 18)) };
}
