// @ts-check
// Real FieldDropdown cache. The menu generator's first run happens before the
// field is attached, so the cache is every subject and a setValue usually
// sticks. Once the menu has been realized for the intransitive init mood,
// that cache rejects a transitive subject until getOptions(false). This
// harness does that realization, then restores through the production helper.
import { test, expect } from "@playwright/test";

const HARNESS = `<!doctype html>
<html><body>
<div id="blockly" style="height:480px;width:640px"></div>
<script src="/vendor/blockly.js"></script>
<script type="module">
import { buildVerbEndingIndex } from "/verb-endings.js";
import {
  defineMorphemeBlocks,
  defineVerbEndingPickerBlock,
  defineVerbObjectBlock,
  restoreVerbPickerFields,
} from "/blocks.js";

const intr = {
  id: "V_IND_INTR_1SG",
  expected: "-vunga",
  glossShort: "statement — I",
  morpheme_type: "inflectional_ending",
  seq: [{ inflection: { mood: "indicative", transitivity: "intransitive", subject: { person: 1, number: "sg" } } }],
};
const trans = {
  id: "V_IND_TR_3SG_3SG",
  expected: "-vaa",
  glossShort: "statement — he to him",
  morpheme_type: "inflectional_ending",
  seq: [{ inflection: {
    mood: "indicative",
    transitivity: "transitive",
    subject: { person: 3, number: "sg" },
    object: { person: 3, number: "sg" },
  } }],
};
const presets = [intr, trans];
const index = buildVerbEndingIndex(presets);
const byId = new Map(presets.map((preset) => [preset.id, preset]));
const personLabel = (person, number) => String(person) + number;
defineMorphemeBlocks();
defineVerbEndingPickerBlock(index, byId, () => ({ showIds: false }), (mood) => ({ text: mood, title: null }), personLabel);
defineVerbObjectBlock(index, personLabel);
const theme = Blockly.Theme.defineTheme("verb-subject-test", {
  base: Blockly.Themes.Classic,
  blockStyles: {
    oq_inflectional_blocks: { colourPrimary: "#559966" },
    oq_nominal_blocks: { colourPrimary: "#5588aa" },
    oq_verbal_blocks: { colourPrimary: "#aa8855" },
    oq_derivational_blocks: { colourPrimary: "#8855aa" },
    oq_enclitic_blocks: { colourPrimary: "#aa5588" },
    oq_neutral_blocks: { colourPrimary: "#888888" },
    bloq_word_container_blocks: { colourPrimary: "#445566" },
    bloq_sentence_container_blocks: { colourPrimary: "#665544" },
  },
  categoryStyles: {},
  componentStyles: {},
});
const workspace = Blockly.inject("blockly", {
  theme,
  sounds: false,
  toolbox: { kind: "flyoutToolbox", contents: [] },
});
try {
  const picker = workspace.newBlock("morpheme_block__verb_ending_picker");
  picker.initSvg();
  picker.render();
  // Realize the intransitive menu. After this, 3|sg is not a legal setValue.
  const realized = picker.getField("SUBJECT").getOptions(false).map((opt) => opt[1]);
  restoreVerbPickerFields(workspace, picker, trans);
  window.__result = {
    realized,
    data: picker.data,
    subject: picker.getFieldValue("SUBJECT"),
    error: null,
  };
} catch (error) {
  window.__result = { realized: [], data: null, subject: null, error: String(error && error.stack || error) };
}
window.__ready = true;
</script>
</body></html>`;

test("restoring a transitive verb ending keeps a subject outside the realized menu", async ({ page }) => {
	page.on("pageerror", (err) => {
		throw new Error(`Unexpected uncaught page error: ${err.message}`);
	});
	await page.route("**/verb-subject-harness.html", (route) => route.fulfill({
		status: 200,
		contentType: "text/html; charset=utf-8",
		body: HARNESS,
	}));
	await page.goto("/verb-subject-harness.html");
	await page.waitForFunction(() => window.__ready === true);
	const result = await page.evaluate(() => window.__result);
	expect(result.error, result.error || "").toBeNull();
	expect(result.realized).toEqual(["1|sg"]);
	expect(result.subject).toBe("3|sg");
	expect(result.data).toBe("V_IND_TR_3SG_3SG");
});
