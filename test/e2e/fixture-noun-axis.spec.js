// @ts-check
import { test, expect } from "@playwright/test";
import { bootFixtureApp } from "./fixture-boot.js";

test("a noun number change resolves the new coordinate, not the previous one", async ({ page }) => {
	page.on("pageerror", (err) => {
		throw new Error(`Unexpected uncaught page error: ${err.message}`);
	});
	await bootFixtureApp(page);
	const result = await page.evaluate(() => {
		const workspace = Blockly.getMainWorkspace();
		const block = workspace.newBlock("morpheme_block__noun_ending_picker");
		block.initSvg();
		block.render();
		const before = block.data;
		block.setFieldValue("PL", "NUMBER");
		return { before, after: block.data, number: block.getFieldValue("NUMBER") };
	});
	expect(result.before).toBe("N_ABS_SG");
	expect(result.number).toBe("PL");
	expect(result.after).toBe("N_ABS_PL");
});
