import { t } from "./i18n.js";

export function mountDictionaryLookup(host, { sources, searchEntries }) {
	if (!host) return;
	const form = document.createElement("form");
	form.className = "dictionary-search";
	const label = document.createElement("label");
	label.htmlFor = "dictionary-query";
	label.textContent = t("dictionarySearchLabel");
	const input = document.createElement("input");
	input.id = "dictionary-query";
	input.type = "search";
	input.autocomplete = "off";
	input.spellcheck = false;
	input.autocapitalize = "none";
	input.autocorrect = "off";
	input.placeholder = t("dictionarySearchPlaceholder");
	const submit = document.createElement("button");
	submit.type = "submit";
	submit.textContent = t("search");
	form.append(label, input, submit);
	const status = document.createElement("p");
	status.className = "dictionary-status";
	status.setAttribute("aria-live", "polite");
	const results = document.createElement("div");
	results.className = "dictionary-results";
	host.replaceChildren(form, status, results);
	let requestId = 0;
	let entries = [];
	let statusKey = "dictionaryEnterQuery";
	let statusVars = {};
	let statusExtra = "";
	const setStatus = (key, vars = {}, extra = "") => {
		statusKey = key;
		statusVars = vars;
		statusExtra = extra;
		status.textContent = t(statusKey, statusVars) + statusExtra;
	};
	const refreshLocale = () => {
		label.textContent = t("dictionarySearchLabel");
		input.placeholder = t("dictionarySearchPlaceholder");
		submit.textContent = t("search");
		status.textContent = t(statusKey, statusVars) + statusExtra;
		results.replaceChildren(...entries.map(renderEntry));
	};

	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		const query = input.value.trim();
		const currentRequest = ++requestId;
		results.replaceChildren();
		entries = [];
		if (!query) {
			setStatus("dictionaryEnterQuery");
			return;
		}
		setStatus("dictionarySearching");
		submit.disabled = true;
		try {
			const response = await searchEntries(sources, query, { lang: "kl" });
			if (currentRequest !== requestId) return;
			entries = response.results || [];
			results.replaceChildren(...entries.map(renderEntry));
			if (response.results?.length) setStatus("dictionaryResultCount", { n: response.results.length });
			else setStatus(response.failed ? "dictionaryUnavailable" : "dictionaryNoResults");
			if (response.errors?.length) {
				statusExtra = ` ${response.errors.map((error) => `${error.source}: ${error.message}`).join("; ")}`;
				status.textContent += statusExtra;
			}
		} catch (error) {
			if (currentRequest === requestId) setStatus("dictionaryUnavailable", {}, ` ${error?.message || String(error)}`);
		} finally {
			if (currentRequest === requestId) submit.disabled = false;
		}
	});
	return { refreshLocale };
}

function renderEntry(entry) {
	const article = document.createElement("article");
	article.className = "dictionary-entry";
	const heading = document.createElement("h3");
	heading.textContent = entry.surface || entry.kalaallisut || "?";
	article.append(heading);
	if (entry.wordClass?.en || entry.wordClass?.path?.length) {
		const category = document.createElement("p");
		category.className = "dictionary-category";
		category.textContent = entry.wordClass.en || entry.wordClass.path.join(" · ");
		article.append(category);
	}
	for (const [lang, label] of [["en", t("english")], ["da", t("danish")]]) {
		const sourceGloss = entry.glosses?.[lang] || entry[`gloss_${lang}`] || "";
		if (!sourceGloss) continue;
		const group = document.createElement("section");
		group.className = "dictionary-gloss-group";
		const heading = document.createElement("h4");
		heading.textContent = t("dictionarySourceGloss", { lang: label });
		const source = document.createElement("p");
		source.className = "dictionary-source-gloss";
		source.textContent = sourceGloss;
		group.append(heading, source);
		const options = Array.isArray(entry.gloss_options?.[lang]) ? entry.gloss_options[lang] : [];
		if (options.length) {
			const optionHeading = document.createElement("h5");
			optionHeading.textContent = t("dictionaryHeuristicOptions");
			const list = document.createElement("ul");
			list.className = "dictionary-gloss-options";
			for (const option of options) {
				const item = document.createElement("li");
				item.textContent = option;
				list.append(item);
			}
			group.append(optionHeading, list);
		}
		article.append(group);
	}
	const note = document.createElement("p");
	note.className = "dictionary-options-note";
	note.textContent = t("dictionaryOptionsNote");
	article.append(note);
	return article;
}
