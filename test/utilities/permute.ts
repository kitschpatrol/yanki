/**
 * Generates all possible permutations of the provided strings or arrays of strings,
 * without changing the order of the top-level strings argument.
 * @param strings - The input strings or arrays of strings.
 * @returns - An array of all possible permutations.
 * @example
 * const permutations = permute('b', ['a', 'e'], 't', ['s', 'n']);
 * console.log(permutations);
 * // Output:
 * // [
 * //   'bats', 'bans',
 * //   'bets', 'bens'
 * // ]
 */
export function permute(...strings: Array<string | string[]>): string[] {
	const results: string[] = []

	/**
	 * Helper function to perform backtracking and generate permutations.
	 * @param index - The current index in the strings array.
	 * @param part - The current part of the permutation being constructed.
	 */
	function backtrack(index: number, part: string[]): void {
		if (index === strings.length) {
			results.push(part.join(''))
			return
		}

		const current = strings[index]
		if (Array.isArray(current)) {
			for (const aString of current) {
				backtrack(index + 1, [...part, aString])
			}
		} else {
			backtrack(index + 1, [...part, current])
		}
	}

	backtrack(0, [])
	return results
}
