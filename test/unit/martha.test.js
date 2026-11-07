import test from "node:test";
import assert from "node:assert/strict";
import { marthaUrl, marthaSpeechText, isMarthaSpeechEnabled, setMarthaSpeechEnabled } from "../../docs/martha.js";
import { setLocale } from "../../docs/i18n.js";

const store = new Map();
Object.defineProperty(globalThis, "localStorage", {
	value: {
		getItem: (key) => (store.has(key) ? store.get(key) : null),
		setItem: (key, value) => store.set(key, String(value)),
		removeItem: (key) => store.delete(key),
		clear: () => store.clear(),
	},
	configurable: true,
});

test("Martha URL uses the language-specific Oqaasileriffik page and encodes st", () => {
	setLocale("en");
	assert.equal(marthaUrl("illu"), "https://oqaasileriffik.gl/en/langtech/martha/?st=illu");

	setLocale("da");
	assert.equal(marthaUrl("qimmeqarpunga"), "https://oqaasileriffik.gl/da/sprogteknologi/martha/?st=qimmeqarpunga");

	assert.equal(marthaUrl("inuk", "kl"), "https://oqaasileriffik.gl/oqaaserpassualerineq/martha/?st=inuk");
	assert.equal(marthaUrl("≈ qimmeq", "en"), "https://oqaasileriffik.gl/en/langtech/martha/?st=qimmeq");
	setLocale("en");
});

test("Martha speech is enabled by default and can be disabled", () => {
	store.clear();
	assert.equal(isMarthaSpeechEnabled(), true);
	setMarthaSpeechEnabled(false);
	assert.equal(isMarthaSpeechEnabled(), false);
	setMarthaSpeechEnabled(true);
	assert.equal(isMarthaSpeechEnabled(), true);
});

test("Martha playback text is normalized and trailing punctuation or approximate prefix is not spoken", () => {
	assert.equal(marthaSpeechText("  Qujanaq\n ilisilu?!  "), "Qujanaq ilisilu");
	assert.equal(marthaSpeechText("≈ qimmeqarpunga!"), "qimmeqarpunga");
	assert.equal(marthaSpeechText("  "), "");
});
