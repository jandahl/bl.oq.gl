import { derivationStages } from "./step-model.js";
import { element, action, appendMorphemeLabel } from "./visualizations.js";
import { applyMorphemeColours } from "./theme.js";
import { t } from "./i18n.js";

const selections = new WeakMap();
export function renderStepper(host, word, options, engine, presetsById = new Map()) {
	// Each stage explains the accumulated result, regardless of other views.
	options = { ...options, fillBlanks: true };
	const stages = derivationStages(word.seq, engine.buildWord);
	if (!stages.length) return;
	const key = JSON.stringify(word.seq.map((item) => [item.id, item.text]));
	let selected = selections.get(host)?.key === key ? selections.get(host).index : stages.length - 1;
	selected = Math.min(selected, stages.length - 1);
	const root = element("section", "derivation-stepper"); root.setAttribute("aria-label", t("derivationStepper"));
	const strip = element("div", "step-stages"); strip.setAttribute("role", "group"); strip.setAttribute("aria-label", t("derivationStages"));
	const result = element("div", "step-result"); result.setAttribute("aria-live", "polite");
	const controls = element("div", "viz-actions");
	const previous = action(t("previousStage"), () => select(selected - 1));
	const next = action(t("nextStage"), () => select(selected + 1));
	controls.append(previous, next);
	const buttons = stages.map((stage, index) => {
		const node = word.graph?.nodes.find((node) => node.kind === "morpheme" && node.seqIndex === index);
		const button = action("", () => select(index));
		button.append(element("span", "", `${index + 1} ·`));
		appendMorphemeLabel(button, node, stage.item, options);
		applyMorphemeColours(button, presetsById.get(stage.item.id));
		button.dataset.stage = String(index); strip.append(button); return button;
	});
	function select(index) {
		selected = Math.max(0, Math.min(index, stages.length - 1));
		selections.set(host, { key, index: selected });
		buttons.forEach((button, i) => button.setAttribute("aria-pressed", String(i === selected)));
		previous.disabled = selected === 0; next.disabled = selected === stages.length - 1;
		const stage = stages[selected];
		const node = word.graph?.nodes.find((node) => node.kind === "morpheme" && node.seqIndex === selected);
		result.replaceChildren(element("p", "viz-secondary", t("stagePosition", { n: selected + 1, total: stages.length })));
		const built = stage.built;
		if (!built.ok) {
			result.append(element("p", "visualization-status is-error", built.reason || t("invalidStage"))); return;
		}
		result.append(element("strong", "step-surface", built.word), element("p", "step-status", built.approximate ? t("approximateChain") : built.closed ? t("completeChain") : t("openChain")));
		for (const lang of options.lang === "both" ? ["en", "da"] : [options.lang || "en"]) {
			const label = node?.labels?.[lang];
			const meaning = label?.stemOut || label?.gloss;
			if (meaning) result.append(element("p", "step-meaning", `${lang.toUpperCase()} · ${meaning}`));
			if (label?.semanticStep?.safe === false) result.append(element("p", "viz-secondary", t("meaningUnresolved")));
		}
	}
	root.append(strip, result, controls); host.append(root); select(selected);
}
