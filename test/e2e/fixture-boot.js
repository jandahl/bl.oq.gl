// Shared fixture-mode boot: point the app at the local engine stub + mini
// catalog before any module evaluates oq-api.js's top-level loadEngine().
/** @param {import('@playwright/test').Page} page */
export async function bootFixtureApp(page) {
	// HTML preloads otherwise download the live engine/catalog even in fixture
	// mode. Keep offline tests independent of those unused network requests.
	await page.route("https://**", (route) => route.abort());
	await page.addInitScript(() => {
		const origin = location.origin;
		globalThis.__BLOQ_ENGINE_URL__ = `${origin}/fixtures/engine-stub.js`;
		globalThis.__BLOQ_CATALOG_URLS__ = [`${origin}/fixtures/catalog-mini.json`];
		globalThis.__BLOQ_EXAMPLES_URL__ = `${origin}/fixtures/standard-examples.json`;
	});
	await page.goto("/");
	await page.waitForFunction(
		() => document.querySelector("#status-line")?.textContent?.includes("Loaded"),
		undefined,
		{ timeout: 15_000 },
	);
}
