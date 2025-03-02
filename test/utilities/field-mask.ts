/**
 * Takes an object and an array of dot-delimited key paths, returning a new object
 * that only includes the specified fields from the original object. Useful for test output.
 * @template T - The type of the input object.
 * @param object - The source object to extract fields from.
 * @param fields - An array of dot-delimited key paths to include in the result.
 * @returns A new object containing only the specified fields.
 * @example
 * const test = {
 *   bar: {
 *     bar: 'bar',
 *     baz: 'baz',
 *   },
 *   bla: 'bla',
 *   foo: 'foo',
 * };
 * const masked = fieldMask(test, ['bar.baz', 'foo']);
 * console.log(masked);
 * // Output: { bar: { baz: 'baz' }, foo: 'foo' }
 */
export function fieldMask<T extends Record<string, unknown>>(
	object: T,
	fields: string[],
): Partial<T> {
	const result: Partial<T> = {}

	for (const field of fields) {
		const keys = field.split('.')
		let current: Record<string, unknown> = result
		let src: unknown = object

		for (let i = 0; i < keys.length; i++) {
			const key = keys[i] as keyof typeof src

			if (i === keys.length - 1) {
				if (typeof src === 'object' && src !== null && key in src) {
					current[key] = (src as Record<string, unknown>)[key]
				}
			} else if (typeof src === 'object' && src !== null && key in src) {
				if (!(key in current)) {
					current[key] = {}
				}

				current = current[key] as Record<string, unknown>
				src = src[key]
			} else {
				break
			}
		}
	}

	return result
}
