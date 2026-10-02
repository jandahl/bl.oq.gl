// @ts-check
/** Display explicit engine class metadata; unknown ports remain unknown.
 * @param {any} item @returns {{input: string|null, output: string|null}} */
export function classPorts(item) {
	const shift = item?.category_shift || item?.lexical_facts?.category_shift;
	const match = typeof shift === "string" ? /^\s*(\w+)\s*(?:->|→)\s*(\w+)\s*$/.exec(shift) : null;
	return match ? { input: match[1], output: match[2] } : { input: null, output: item?.word_class || item?.lexical_facts?.word_class || null };
}
