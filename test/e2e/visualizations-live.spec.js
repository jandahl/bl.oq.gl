import { test, expect } from "@playwright/test";

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
