/**
 * Wrap an array to count how many times its entries are read, so a test can
 * tell one pass over a long list from one pass per use.
 */
export function countReads<T>(items: T[]): { countedItems: T[]; getReads: () => number } {
	let reads = 0
	const countedItems = new Proxy(items, {
		get(target, key, receiver): unknown {
			if (typeof key === 'string' && Number.isInteger(Number(key))) {
				reads++
			}

			return Reflect.get(target, key, receiver)
		},
	})

	return { countedItems, getReads: () => reads }
}
