import test from "node:test";
import assert from "node:assert/strict";
import { buildNounEndingIndex, nounCandidatesFor, parseNominalCoordinate } from "../../docs/noun-endings.js";

const ending = (id, caseName, meaning = id) => ({ id, meaning, lexical_facts: { morpheme_type: "inflectional_ending", case: caseName } });

test("parseNominalCoordinate recognizes explicit case, number, and possessor coordinates", () => {
	assert.deepEqual(parseNominalCoordinate(ending("N_ABS_POSS3SG_PL", "absolutive")), { case: "absolutive", possessor: "3SG", number: "PL" });
	assert.deepEqual(parseNominalCoordinate({ id: "N_ABS_SG", morpheme_type: "inflectional_ending", case: "absolutive" }), { case: "absolutive", possessor: "none", number: "SG" });
	assert.deepEqual(parseNominalCoordinate({ id: "N_ERG_SG", morpheme_type: "inflectional_ending" }), { case: "ergative", possessor: "none", number: "SG" });
	assert.equal(parseNominalCoordinate(ending("N_DEM_EXCL_A", "")), null);
	assert.equal(parseNominalCoordinate(ending("N_ABS_POSS9SG_SG", "absolutive")), null);
});

test("parseNominalCoordinate consumes 0.4.7+ structured inflection coordinates directly", () => {
	const structuredPossessed = {
		id: "N_ABS_POSS2SG_SG",
		morpheme_type: "inflectional_ending",
		inflection: { case: "absolutive", number: "sg", possessor: { person: 2, number: "sg" } },
	};
	assert.deepEqual(parseNominalCoordinate(structuredPossessed), { case: "absolutive", possessor: "2SG", number: "SG" });

	const structuredUnpossessed = {
		id: "N_INS_PL",
		morpheme_type: "inflectional_ending",
		inflection: { case: "instrumental", number: "pl", possessor: null },
	};
	assert.deepEqual(parseNominalCoordinate(structuredUnpossessed), { case: "instrumental", possessor: "none", number: "PL" });
});

test("buildNounEndingIndex groups structured nominal endings and keeps duplicate candidates", () => {
	const index = buildNounEndingIndex([
		ending("N_ABS_SG", "absolutive", "absolutive singular"),
		ending("N_ABS_POSS1SG_PL", "absolutive", "possessed plural"),
		ending("N_ABS_POSS1SG_PL_ARCHAIC", "absolutive", "archaic possessed plural"),
		ending("N_ERG_SG", "ergative"),
		{ id: "N_OTHER", lexical_facts: { morpheme_type: "inflectional_ending", case: "absolutive" } },
	]);
	assert.deepEqual(index.cases, ["absolutive", "ergative"]);
	assert.deepEqual(nounCandidatesFor(index, "absolutive", "none", "SG").map((x) => x.id), ["N_ABS_SG"]);
	assert.deepEqual(nounCandidatesFor(index, "absolutive", "1SG", "PL").map((x) => x.id), ["N_ABS_POSS1SG_PL", "N_ABS_POSS1SG_PL_ARCHAIC"]);
});

test("nounForm and nounParadigm contracts match nominal stem [api-feature:noun-paradigm]", async () => {
	const { NOUN_PARADIGM_CELLS, matchNounStem, nounForm, nounParadigm } = await import("../../docs/fixtures/engine-stub.js");
	assert.equal(NOUN_PARADIGM_CELLS.length, 13);
	assert.equal(NOUN_PARADIGM_CELLS[0].id, "N_ABS_SG");

	const stem = { id: "qimmeq", text: "qimmeq", word_class: "N", morpheme_type: "stem" };
	const matched = matchNounStem("qimmeq", [stem]);
	assert.equal(matched.ok, true);
	assert.equal(matched.stem.id, "qimmeq");

	const cellResult = nounForm(stem, { cell: "N_ABS_SG" });
	assert.equal(cellResult.ok, true);
	assert.equal(cellResult.status, "built");

	const paradigm = nounParadigm(stem);
	assert.equal(paradigm.stemId, "qimmeq");
	assert.equal(paradigm.cells.length, 13);
});
