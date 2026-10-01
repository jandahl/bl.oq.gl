import test from "node:test";
import assert from "node:assert/strict";
import { getLocale, setLocale, t } from "../../docs/i18n.js";

test("i18n exposes the main page's English and Danish UI labels", () => {
	setLocale("en");
	assert.equal(t("app.title"), "BLOQ");
	assert.equal(t("buildHeading"), "Build a word");
	assert.equal(t("clearFilter"), "Clear filter");
	assert.equal(t("exampleWordsLabel"), "Words");
	assert.equal(t("exampleSentencesLabel"), "Sentences");
	assert.equal(t("examplesOpen"), "Browse…");
	assert.equal(t("examplesHeading"), "Examples");
	assert.equal(t("workedExamplesEmpty"), "No examples in this list yet.");
	assert.equal(t("loadingTitle"), "Loading");
	assert.equal(t("showMood"), "Show mood labels");
	assert.equal(t("layoutHorizontal"), "Horizontal");
	setLocale("da");
	assert.equal(t("buildHeading"), "Byg et ord");
	assert.equal(t("clearFilter"), "Ryd filter");
	assert.equal(t("exampleWordsLabel"), "Ord");
	assert.equal(t("showMood"), "Vis modusmarkeringer");
	assert.equal(t("layoutWrap"), "Ombryd");
	setLocale("en");
});

test("i18n falls back safely for unsupported locales and missing keys", () => {
	setLocale("sv");
	assert.equal(getLocale(), "en");
	assert.equal(t("settingsHeading"), "Display and language");
	assert.equal(t("missing-key"), "missing-key");
});

test("i18n covers status and canvas strings in English and Danish", () => {
	setLocale("en");
	assert.equal(t("unknownMorpheme"), "Unknown morpheme in stack.");
	assert.equal(t("noVerifiedBreakdown", { token: "xyz" }), "No verified breakdown found for \"xyz\".");
	assert.equal(t("canvasLabel"), "Morpheme workshop canvas");
	assert.equal(t("results"), "Results");
	setLocale("da");
	assert.equal(t("unknownMorpheme"), "Ukendt morfem i stakken.");
	assert.match(t("noVerifiedBreakdown", { token: "xyz" }), /xyz/);
	assert.equal(t("results"), "Resultater");
	setLocale("en");
});

test("learner-facing band, note, sentence, and candidate strings exist in both locales", () => {
	setLocale("en");
	assert.equal(t("bandGold"), "gold");
	assert.equal(t("bandExact"), "exact");
	assert.equal(t("bandSoft"), "soft");
	assert.equal(t("bandNone"), "unparsed");
	assert.equal(t("noBuilderSequence"), "Catalog entry has no builder sequence.");
	assert.equal(t("closedReadingDoesNotBuild"), "This closed reading does not build.");
	assert.equal(t("sentenceN", { n: 2 }), "Sentence 2");
	assert.equal(t("evalCandidates", { count: 4 }), "4 candidates");
	setLocale("da");
	assert.equal(t("bandGold"), "guld");
	assert.equal(t("bandExact"), "eksakt");
	assert.equal(t("bandSoft"), "blød");
	assert.equal(t("bandNone"), "utolket");
	assert.equal(t("noBuilderSequence"), "Katalogposten har ingen byggesekvens.");
	assert.equal(t("closedReadingDoesNotBuild"), "Denne lukkede læsning kan ikke bygges.");
	assert.equal(t("sentenceN", { n: 2 }), "Sætning 2");
	assert.equal(t("evalCandidates", { count: 4 }), "4 kandidater");
	assert.equal(t("completeWord"), "fuldstændigt ord");
	assert.equal(t("openDerivation"), "Midterivelse — denne kæde slutter ikke med et ordfinalt morfem.");
	assert.equal(t("noteOpenAnalyses"), "Ingen lukket sætningslæsning. Åbne eller omtrentlige ordanalyser bliver ikke lagt på sætningslærredet.");
	assert.equal(t("wordIndex", { word: 2 }), "ord 2");
	setLocale("en");
	assert.equal(t("completeWord"), "complete word");
	assert.equal(t("atPosition", { position: 2 }), "at position 2");
	assert.equal(t("otherBreakdowns", { count: 3 }), "Other verified breakdowns (3)");
});
