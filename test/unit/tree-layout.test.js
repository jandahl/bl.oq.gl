import test from "node:test";
import assert from "node:assert/strict";
import { layoutDerivation } from "../../docs/tree-layout.js";
const graph = { nodes: ["m-0", "m-1", "m-2", "d-1", "d-2"].map((id) => ({ id })), derivation: { root: "d-2", edges: [{ parent: "d-1", operand: "m-0" }, { parent: "d-1", operand: "m-1" }, { parent: "d-2", operand: "d-1" }, { parent: "d-2", operand: "m-2" }] } };
test("all morpheme leaves align and parent coverage follows engine edges", () => {
	const layout = layoutDerivation(graph);
	assert.deepEqual(layout.nodes.filter((n) => n.leaf).map((n) => n.y), [262, 262, 262]);
	assert.deepEqual(layout.nodes.find((n) => n.id === "d-1").leaves, ["m-0", "m-1"]);
	assert.equal(layout.nodes.find((n) => n.id === "d-2").x, 367.5);
});
test("missing nodes and cyclic edges fail visibly instead of disappearing", () => {
	assert.throws(() => layoutDerivation({ ...graph, nodes: [] }), /Missing derivation node/);
	assert.throws(() => layoutDerivation({ ...graph, derivation: { root: "m-0", edges: [{ parent: "m-0", operand: "m-0" }] } }), /Cyclic/);
});

test("the larger root stays inside the board and leaves room for its children", () => {
	for (const value of [graph, { nodes: [{ id: "m-0" }], derivation: { root: "m-0", edges: [] } }]) {
		const layout = layoutDerivation(value);
		const root = layout.nodes.find((node) => node.id === value.derivation.root);
		assert.equal(root.width, 280);
		assert.equal(root.height, 114);
		assert.ok(root.x - root.width / 2 >= 0);
		assert.ok(root.x + root.width / 2 <= layout.width);
		for (const child of layout.nodes.filter((node) => node.depth === 1)) assert.ok(child.y > root.y + root.height);
	}
});
