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
	assert.equal(t("loadingTitle"), "Loading");
	assert.equal(t("showMood"), "Show mood labels");
	setLocale("da");
	assert.equal(t("buildHeading"), "Byg et ord");
	assert.equal(t("clearFilter"), "Ryd filter");
	assert.equal(t("exampleWordsLabel"), "Ord");
	assert.equal(t("showMood"), "Vis modusmarkeringer");
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
