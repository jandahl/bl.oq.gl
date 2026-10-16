// Indexes structured nominal inflectional endings. Prefers oq-api 0.4.7+
// structured `inflection` ({ case, number, possessor }), falling back to
// lexical_facts and entry ID parsing for backwards compatibility.

const CASE_ORDER = ["absolutive", "ergative", "instrumental", "allative", "locative", "ablative", "equalis", "vialis"];
const NUMBER_ORDER = ["SG", "PL"];
const POSSESSOR_ORDER = ["none", "1SG", "2SG", "3SG", "4SG", "1PL", "2PL", "3PL", "4PL"];
const CASE_BY_CODE = { ABS: "absolutive", ERG: "ergative", INS: "instrumental", ALL: "allative", LOC: "locative", ABL: "ablative", EQU: "equalis", VIA: "vialis" };

function parseNominalCoordinate(preset) {
	const facts = preset?.lexical_facts ?? preset;
	if (facts?.morpheme_type !== "inflectional_ending" && preset?.morpheme_type !== "inflectional_ending") return null;

	// Structured nominal inflection coordinate (oq-api 0.4.7+)
	const inflection = preset?.inflection ?? facts?.inflection ?? preset?.seq?.[0]?.inflection;
	if (inflection?.case && inflection?.number && Object.hasOwn(inflection, "possessor")) {
		const possessor = inflection.possessor
			? `${inflection.possessor.person}${String(inflection.possessor.number).toUpperCase()}`
			: "none";
		return {
			case: inflection.case,
			possessor,
			number: String(inflection.number).toUpperCase(),
		};
	}

	const match = /^N_[A-Z]+(?:_POSS(1SG|2SG|3SG|4SG|1PL|2PL|3PL|4PL))?_(SG|PL)(?:_[A-Z]+)?$/.exec(preset?.id ?? "");
	const caseName = facts.case || CASE_BY_CODE[preset?.id?.split("_")[1]];
	if (!caseName || !match) return null;
	return { case: caseName, possessor: match[1] ?? "none", number: match[2] };
}

export function buildNounEndingIndex(presets) {
	const index = new Map();
	const cases = [];
	for (const preset of presets ?? []) {
		const coordinate = parseNominalCoordinate(preset);
		if (!coordinate) continue;
		if (!cases.includes(coordinate.case)) cases.push(coordinate.case);
		const key = `${coordinate.case}|${coordinate.possessor}|${coordinate.number}`;
		const list = index.get(key) ?? [];
		list.push({ id: preset.id, label: preset.meaning || preset.glossShort || preset.id });
		index.set(key, list);
	}
	return {
		index,
		cases: CASE_ORDER.filter((value) => cases.includes(value)).concat(cases.filter((value) => !CASE_ORDER.includes(value))),
		possessors: POSSESSOR_ORDER.filter((value) => [...index.keys()].some((key) => key.includes(`|${value}|`))),
		numbers: NUMBER_ORDER.filter((value) => [...index.keys()].some((key) => key.endsWith(`|${value}`))),
	};
}

export function nounCandidatesFor(index, caseName, possessor = "none", number = "SG") {
	return index?.index?.get(`${caseName}|${possessor}|${number}`) ?? [];
}

export { parseNominalCoordinate };
