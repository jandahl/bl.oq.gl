import test from "node:test";
import assert from "node:assert/strict";
import { bindModal } from "../../docs/modal.js";

test("bindModal returns no-op helpers when dialog is missing", () => {
	const modal = bindModal(null);
	assert.equal(modal.isOpen(), false);
	modal.open();
	modal.close();
	assert.equal(modal.isOpen(), false);
});
