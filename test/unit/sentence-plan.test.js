import test from "node:test";
import assert from "node:assert/strict";
import {
	isSentenceInput,
	groupTokensIntoSentences,
	wordFromToken,
	planFromLattice,
	canvasSentences,
	canvasAssemblies,
	withInitialCapital,
	assemblyReading,
} from "../../docs/sentence-plan.js";

function assemble(lattice) {
	const tokens = lattice?.tokens ?? [];
	const text = tokens.map((token) => token.readings?.[0]?.headline || token.surface).join(", ");
	return {
		ok: tokens.length > 0,
		reason: tokens.length ? null : "empty",
		mode: tokens.length ? "serial" : "empty",
		text,
		parts: [],
	};
}

const catalog = new Map([
	["illu", { id: "illu", seq: [{ id: "illu" }] }],
	["neri", { id: "neri", seq: [{ id: "neri" }] }],
	["V_IND_INTR_3SG", { id: "V_IND_INTR_3SG", seq: [{ id: "V_IND_INTR_3SG" }] }],
	["N_INS_SG", { id: "N_INS_SG", seq: [{ id: "N_INS_SG" }] }],
]);

test("isSentenceInput is whitespace, not a trailing period on one word", () => {
	assert.equal(isSentenceInput("nerivoq"), false);
	assert.equal(isSentenceInput("nerivoq."), false);
	assert.equal(isSentenceInput("Piitap inaaniippoq"), true);
});

test("groupTokensIntoSentences cuts on .!? and newlines, not commas", () => {
	const tokens = [
		{ raw: "Illuga,", surface: "Illuga", start: 0, end: 7 },
		{ raw: "illu.", surface: "illu", start: 8, end: 13 },
		{ raw: "Qimmeq", surface: "Qimmeq", start: 14, end: 20 },
	];
	const groups = groupTokensIntoSentences(tokens, "Illuga, illu.\nQimmeq");
	assert.equal(groups.length, 2);
	assert.deepEqual(groups[0].map((token) => token.surface), ["Illuga", "illu"]);
	assert.deepEqual(groups[1].map((token) => token.surface), ["Qimmeq"]);
});

test("wordFromToken keeps closed catalog chains and refuses invented or missing ids", () => {
	const verified = wordFromToken({
		raw: "nerivoq",
		surface: "nerivoq",
		readings: [{ band: "hard_exact", headline: "he eats", ids: ["neri", "V_IND_INTR_3SG"] }],
	}, catalog);
	assert.equal(verified.status, "verified");
	assert.deepEqual(verified.canvasIds, ["neri", "V_IND_INTR_3SG"]);

	const soft = wordFromToken({
		raw: "illu",
		surface: "illu",
		readings: [{ band: "soft_exact", headline: "house", ids: ["illu"] }],
	}, catalog);
	assert.equal(soft.status, "soft");
	assert.deepEqual(soft.canvasIds, ["illu"]);

	const opaque = wordFromToken({
		raw: "Janimik",
		surface: "Janimik",
		readings: [{ band: "soft_exact", headline: "Jan", ids: ["opaque_proper:Jan", "N_INS_SG"], opaqueProper: true }],
	}, catalog);
	assert.equal(opaque.status, "opaque");
	assert.deepEqual(opaque.canvasIds, []);

	const missing = wordFromToken({
		raw: "illu",
		surface: "illu",
		readings: [{ band: "gold", headline: "house", ids: ["illu", "N_ABS_SG"] }],
	}, catalog);
	assert.equal(missing.status, "missing");
	assert.deepEqual(missing.missingIds, ["N_ABS_SG"]);
	assert.deepEqual(missing.canvasIds, []);

	const open = wordFromToken({
		raw: "illuqar",
		surface: "illuqar",
		readings: [],
	}, catalog, new Map([["illuqar", { matches: [{}, {}] }]]));
	assert.equal(open.status, "unparsed");
	assert.equal(open.note, "noteOpenAnalyses");
	assert.equal(open.openMatchCount, 2);
});

test("a span phrase that disagrees with the closed chain is not drawn", () => {
	const word = wordFromToken({
		raw: "inaaniippoq.",
		surface: "inaaniippoq",
		readings: [{
			band: "hard_exact",
			headline: "someone is somewhere",
			spanText: "she is in Peter's room",
			ids: ["it", "V_IND_INTR_3SG"],
		}],
	}, catalog);
	assert.equal(word.status, "span");
	assert.equal(word.headline, "she is in Peter's room");
	assert.equal(word.compositional, "someone is somewhere");
	assert.equal(word.heldLabel, "heldAttestedPhrase");
	assert.deepEqual(word.canvasIds, []);

	const plan = planFromLattice({
		text: "Piitap inaaniippoq.",
		tokens: [
			{ raw: "Piitap", surface: "Piitap", readings: [], also: [] },
			{
				raw: "inaaniippoq.",
				surface: "inaaniippoq",
				readings: [{
					band: "hard_exact",
					headline: "someone is somewhere",
					spanText: "she is in Peter's room",
					spanId: "span:0:1",
					ids: ["it", "V_IND_INTR_3SG"],
				}],
			},
		],
	}, { presetsById: catalog, assembleClause: assemble, lang: "en" });
	assert.equal(plan.sentences.length, 1);
	assert.equal(plan.sentences[0].words[0].status, "unparsed");
	assert.equal(plan.sentences[0].words[0].heldLabel, "heldInAttestedPhrase");
	assert.equal(plan.sentences[0].words[1].status, "span");
	assert.deepEqual(canvasSentences(plan), []);
});

test("mood labels are off unless asked for, and case roles stay", () => {
	const clause = {
		mode: "clause",
		text: "statement: I have a dog | at: the house",
		parts: [
			{ role: "statement", kind: "verb", text: "I have a dog" },
			{ role: "at", kind: "np", text: "the house" },
		],
	};
	assert.equal(assemblyReading(clause), "I have a dog | at: the house");
	assert.equal(assemblyReading(clause, true), "statement: I have a dog | at: the house");
	assert.equal(assemblyReading({
		mode: "clause",
		text: "udsagn: jeg har en hund",
		parts: [{ role: "udsagn", kind: "verb", text: "jeg har en hund" }],
	}), "jeg har en hund");
	assert.equal(assemblyReading({ mode: "serial", text: "Piitap, she is in Peter's room", parts: [] }), "Piitap, she is in Peter's room");
});

test("a new sentence takes an initial capital and leaves the rest alone", () => {
	assert.equal(withInitialCapital("qimmeqarpunga."), "Qimmeqarpunga.");
	assert.equal(withInitialCapital("Piitap inaaniippoq."), "Piitap inaaniippoq.");
	assert.equal(withInitialCapital("  ajorpoq"), "  Ajorpoq");
	const plan = planFromLattice({
		text: "piitap inaaniippoq. qimmeqarpunga.",
		tokens: [
			{ raw: "piitap", surface: "piitap", readings: [], also: [] },
			{ raw: "inaaniippoq.", surface: "inaaniippoq", readings: [{ band: "hard_exact", headline: "somewhere", ids: ["illu"] }] },
			{ raw: "qimmeqarpunga.", surface: "qimmeqarpunga", readings: [{ band: "hard_exact", headline: "I have a dog", ids: ["neri", "V_IND_INTR_3SG"] }] },
		],
	}, { presetsById: catalog, assembleClause: assemble, lang: "en" });
	assert.equal(plan.sentences[0].source, "Piitap inaaniippoq.");
	assert.equal(plan.sentences[1].source, "Qimmeqarpunga.");
});

test("planFromLattice makes one Blockly sentence per source sentence and keeps the clause gloss [api-feature:sentence-analysis]", () => {
	const lattice = {
		text: "illu. nerivoq",
		tokens: [
			{
				raw: "illu.",
				surface: "illu",
				start: 0,
				end: 5,
				readings: [{ band: "gold", headline: "house", ids: ["illu"] }],
				also: [],
			},
			{
				raw: "nerivoq",
				surface: "nerivoq",
				start: 6,
				end: 13,
				readings: [{ band: "hard_exact", headline: "he eats", ids: ["neri", "V_IND_INTR_3SG"] }],
				also: [],
			},
		],
	};
	const plan = planFromLattice(lattice, { presetsById: catalog, assembleClause: assemble, lang: "en" });
	assert.equal(plan.sentences.length, 2);
	assert.equal(plan.sentences[0].assembly.text, "house");
	assert.equal(plan.sentences[1].assembly.text, "he eats");
	assert.deepEqual(canvasSentences(plan), [[["illu"]], [["neri", "V_IND_INTR_3SG"]]]);
	assert.deepEqual(canvasAssemblies(plan), ["house", "he eats"]);
});
