/**
 * Takes an object and an array of dot-delimited key paths, returning a new
 * object that only includes the specified fields from the original object.
 * Useful for test output.
 *
 * @example
 * 	const test = {
 * 		bar: {
 * 			bar: 'bar',
 * 			baz: 'baz',
 * 		},
 * 		bla: 'bla',
 * 		foo: 'foo',
 * 	}
 * 	const masked = fieldMask(test, ['bar.baz', 'foo'])
 * 	console.log(masked)
 * 	// Output: { bar: { baz: 'baz' }, foo: 'foo' }
 *
 * @template T - The type of the input object.
 * @param object - The source object to extract fields from.
 * @param fields - An array of dot-delimited key paths to include in the result.
 *
 * @returns A new object containing only the specified fields.
 */
export function fieldMask<T extends Record<string, unknown>>(
	object: T,
	fields: string[],
): Partial<T> {
	const result: Partial<T> = {}

	for (const field of fields) {
		copyFieldPath(object, result, field.split('.'))
	}

	return result
}

/**
 * Copies a single dot-delimited key path from the source object into the
 * destination object, creating intermediate objects as needed.
 *
 * @param source - The object to read the value from.
 * @param destination - The object to write the value into.
 * @param keys - The key path, already split on dots.
 */
function copyFieldPath(
	source: Record<string, unknown>,
	destination: Record<string, unknown>,
	keys: string[],
): void {
	let current = destination
	let src: unknown = source

	for (let i = 0; i < keys.length; i++) {
		const key = keys[i] as keyof typeof src

		if (i === keys.length - 1) {
			if (typeof src === 'object' && src !== null && Object.hasOwn(src, key)) {
				current[key] = (src as Record<string, unknown>)[key]
			}
		} else if (typeof src === 'object' && src !== null && Object.hasOwn(src, key)) {
			if (!Object.hasOwn(current, key)) {
				current[key] = {}
			}

			current = current[key] as Record<string, unknown>
			src = src[key]
		} else {
			return
		}
	}
}
