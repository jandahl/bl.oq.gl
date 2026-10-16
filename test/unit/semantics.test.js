import test from "node:test";
import assert from "node:assert/strict";
import {
	SEQUENCE_COMPOSITION_SCHEMA,
	SEMANTIC_FRAME_SCHEMA,
	composeChainSemantics,
	attachFrames,
} from "../../docs/semantics.js";
import {
	composeSequenceSemantics,
	attachSemanticFrames,
} from "../../docs/fixtures/engine-stub.js";

const presetsById = new Map([
	["neri", { id: "neri", seq: [{ id: "neri" }] }],
	["V_IND_INTR_3SG", { id: "V_IND_INTR_3SG", seq: [{ id: "V_IND_INTR_3SG" }] }],
]);

test("composeChainSemantics runs semantic composition over morpheme sequence [api-feature:sequence-semantic-composition]", () => {
	const result = composeChainSemantics(
		["neri", "V_IND_INTR_3SG"],
		presetsById,
		{},
		{ composeSequenceSemantics },
	);
	assert.equal(result.schema_version, SEQUENCE_COMPOSITION_SCHEMA);
	assert.equal(result.ok, true);
	assert.equal(result.root, "neri");
});

test("attachFrames embeds semantic frame presentation data [api-feature:semantic-frame-presentation]", () => {
	const wordMatch = {
		word: "nerivoq",
		surface: "nerivoq",
		chain: ["neri", "V_IND_INTR_3SG"],
	};
	const framed = attachFrames(wordMatch, presetsById, { attachSemanticFrames });
	assert.ok(framed.semantic_frame);
	assert.equal(framed.semantic_frame.schema_version, SEMANTIC_FRAME_SCHEMA);
});
