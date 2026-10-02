import { test, expect } from "@playwright/test";

test("invalid graph proposals retain every morpheme and Clear discards the draft", async ({ page }) => {
	await page.goto("/?chain=qimmeq%2CN_qaq_Vb%2CV_IND_INTR_1SG");
	await page.locator("#visualization-view").selectOption("ports");
	await page.locator(".port-node").first().getByRole("button", { name: "Move right", exact: true }).click();
	await expect(page.locator(".port-node")).toHaveCount(3);
	await expect(page.locator(".visualization-status.is-error")).toBeVisible();
	await page.locator("#clear-canvas-btn").click();
	await expect(page.locator(".port-node")).toHaveCount(0);
	await expect(page.locator(".visualization-status")).not.toHaveClass(/is-error/);
});

test("live port graph shows engine class shifts and ending features", async ({ page }) => {
	await page.goto("/?chain=qimmeq%2CN_qaq_Vb%2CV_IND_INTR_1SG");
	await page.locator("#visualization-view").selectOption("ports");
	await expect(page.locator(".port-node").nth(1)).toContainText("In: N");
	await expect(page.locator(".port-node").nth(1)).toContainText("Out: V");
	await page.locator("[data-select-node]").last().click();
	await expect(page.locator(".port-detail")).toContainText("indicative");
	await expect(page.locator(".port-detail")).toContainText("Person: 1");
});

test("live tree retains ordered derivation and unverified semantic evidence", async ({ page }) => {
	await page.goto("/?chain=qimmeq%2CN_qaq_Vb%2CV_IND_INTR_1SG");
	await page.locator("#visualization-view").selectOption("tree");
	await expect(page.locator(".derivation-node")).toHaveCount(5);
	await expect(page.locator(".tree-surface span")).toHaveText(["qimme", "qar", "punga"]);
	await page.locator('.derivation-node[data-node="d-1"]').click();
	await expect(page.locator(".tree-surface .is-selected")).toHaveText(["qimme", "qar"]);
	await page.locator(".semantic-evidence summary").click();
	await expect(page.locator(".semantic-evidence")).toContainText("not certified");
});

test("interlinear tiers use engine surface spans and citation forms", async ({ page }) => {
	await page.goto("/?chain=qimmeq%2CN_qaq_Vb%2CV_IND_INTR_1SG");
	await page.locator("#visualization-view").selectOption("interlinear");
	const rows = page.locator(".interlinear-table tbody tr");
	await expect(rows.nth(1).locator("td")).toHaveText(["qimme", "qar", "punga"]);
	await expect(rows.nth(0).locator("td").last()).toContainText("vunga");
	await expect(rows.nth(3).locator("td").last()).toContainText("punga");
});

test("engine-backed slot cards use actual surface and bilingual labels", async ({ page }) => {
	await page.goto("/?chain=qimmeq%2CN_qaq_Vb%2CV_IND_INTR_1SG");
	await expect(page.locator("#loading-modal")).toBeHidden({ timeout: 20_000 });
	await page.locator("#visualization-view").selectOption("cards");
	await expect(page.locator(".slot-card")).toHaveCount(3);
	await expect(page.locator(".visualization-status")).toContainText("qimmeqarpunga");
	await expect(page.locator(".slot-card").first()).toContainText("dog");
	await page.locator('#opt-lang [data-value="da"]').click();
	await expect(page.locator(".slot-card").first()).toContainText("hund");
});
