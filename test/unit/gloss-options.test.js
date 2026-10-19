import test from "node:test";
import assert from "node:assert/strict";
import { lookupGlossOptions } from "../../docs/gloss-options.js";

const presetsById = new Map([
	["arnaq", { id: "arnaq", morpheme_type: "stem", word_class: "N" }],
	["is", { id: "is", morpheme_type: "suffix", word_class: "N" }],
]);
const sequences = [[{ id: "arnaq", text: "arnaq" }, { id: "is", text: "it" }]];

function deps(results) {
	return {
		sources: ["dictionary"],
		searchEntries: async (_sources, query, options) => {
			assert.equal(query, "arnaq");
			assert.deepEqual(options, { lang: "kl", match: "exact" });
			return { results };
		},
		stemWordClass: (description) => description === "noun" ? "N" : "V",
		presetsById,
		};
}

test("lookupGlossOptions accepts one exact dictionary result with matching word class", async () => {
	const found = await lookupGlossOptions(sequences, deps([{
		surface: "ARNAQ",
		desc: "noun",
		gloss_options: { en: ["woman", "lady"], da: ["kvinde"] },
	}]));
	assert.deepEqual(found.get("arnaq"), { en: ["woman", "lady"], da: ["kvinde"] });
});

test("lookupGlossOptions omits unmatched or ambiguous dictionary results", async () => {
	const candidates = [
		[{ surface: "arnaq", desc: "verb", gloss_options: { en: ["fall"] } }],
		[
			{ surface: "arnaq", desc: "noun", gloss_options: { en: ["woman"] } },
			{ surface: "arnaq", desc: "noun", gloss_options: { en: ["lady"] } },
		],
	];
	for (const results of candidates) assert.equal((await lookupGlossOptions(sequences, deps(results))).size, 0);
});
