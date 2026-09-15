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
	assert.equal(t("loadingCached"), "Opening saved catalog…");
	setLocale("da");
	assert.equal(t("buildHeading"), "Byg et ord");
	assert.equal(t("clearFilter"), "Ryd filter");
	assert.equal(t("exampleWordsLabel"), "Ord");
	assert.equal(t("loadingTitle"), "Indlæser");
	setLocale("en");
});

test("i18n falls back safely for unsupported locales and missing keys", () => {
	setLocale("sv");
	assert.equal(getLocale(), "en");
	assert.equal(t("settingsHeading"), "Display and language");
	assert.equal(t("missing-key"), "missing-key");
});
