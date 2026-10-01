import test from "node:test";
import assert from "node:assert/strict";
import { raceCatalogResponses } from "../../docs/catalog-fetch.js";

function hangUntilAbort(signal) {
	return new Promise((_, reject) => {
		const abort = () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
		if (signal?.aborted) abort();
		else signal?.addEventListener("abort", abort, { once: true });
	});
}

test("the cold race omits credentials and does not bypass the preload cache", async () => {
	const seen = [];
	const fetchImpl = (url, init) => {
		seen.push({ url, init });
		if (url === "primary") return Promise.resolve(new Response("primary", { status: 200 }));
		return hangUntilAbort(init.signal);
	};
	await raceCatalogResponses(["primary", "mirror"], { fetchImpl, waitMs: 50 });
	assert.equal(seen[0].init.credentials, "omit");
	assert.equal(seen[0].init.cache, undefined);
	assert.equal(seen[1].init.credentials, "omit");
	assert.equal(seen[1].init.signal.aborted, true);
});

test("the oq-api catalog wins when it answers inside the wait, and the mirror is aborted", async () => {
	const signals = [];
	const fetchImpl = (url, { signal }) => {
		signals.push({ url, signal });
		if (url === "primary") return Promise.resolve(new Response("primary", { status: 200 }));
		return hangUntilAbort(signal);
	};
	const result = await raceCatalogResponses(["primary", "mirror"], { fetchImpl, waitMs: 1_000 });
	assert.equal(result.url, "primary");
	assert.equal(result.index, 0);
	assert.equal(await result.response.text(), "primary");
	assert.equal(signals[1].signal.aborted, true);
});

test("a hung primary yields to the mirror after the wait", async () => {
	const fetchImpl = (url, { signal }) => {
		if (url === "primary") return hangUntilAbort(signal);
		return Promise.resolve(new Response("mirror", { status: 200 }));
	};
	const started = Date.now();
	const result = await raceCatalogResponses(["primary", "mirror"], { fetchImpl, waitMs: 40 });
	assert.equal(result.url, "mirror");
	assert.equal(await result.response.text(), "mirror");
	assert.ok(Date.now() - started >= 30);
	assert.ok(Date.now() - started < 1_000);
});

test("a fast primary failure does not wait out the deadline", async () => {
	const fetchImpl = (url) => {
		if (url === "primary") return Promise.resolve(new Response("no", { status: 503 }));
		return Promise.resolve(new Response("mirror", { status: 200 }));
	};
	const started = Date.now();
	const result = await raceCatalogResponses(["primary", "mirror"], { fetchImpl, waitMs: 5_000 });
	assert.equal(result.url, "mirror");
	assert.ok(Date.now() - started < 500);
});

test("every host is named when none answer", async () => {
	const fetchImpl = (url) => Promise.resolve(new Response(url, { status: 500 }));
	await assert.rejects(
		() => raceCatalogResponses(["primary", "mirror"], { fetchImpl, waitMs: 20 }),
		(error) => error.message.includes("primary: HTTP 500") && error.message.includes("mirror: HTTP 500"),
	);
});

test("a hung primary and a failing mirror settle on the rest deadline", async () => {
	const fetchImpl = (url, { signal }) => {
		if (url === "primary") return hangUntilAbort(signal);
		return Promise.resolve(new Response("mirror", { status: 500 }));
	};
	const started = Date.now();
	await assert.rejects(
		() => raceCatalogResponses(["primary", "mirror"], { fetchImpl, waitMs: 30, restWaitMs: 30 }),
		/morpheme catalog fetch failed/,
	);
	const elapsed = Date.now() - started;
	assert.ok(elapsed >= 25, `settled too fast: ${elapsed}`);
	assert.ok(elapsed < 500, `still pending too long: ${elapsed}`);
});
