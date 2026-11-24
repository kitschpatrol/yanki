/**
 * Fill in the defaults for a flat options object.
 *
 * An option that is undefined leaves its default in place. Values are taken by
 * reference rather than merged or copied, since this runs for every note and an
 * option like `allFilePaths` can list every file in a vault.
 *
 * @returns A new object holding every default, overridden by the options that
 *   are defined.
 */
export function applyDefaults<Options extends Record<string, unknown>>(
	defaults: Options,
	options: Partial<Options> | undefined,
): Options {
	const result = { ...defaults }

	const optionKeys = Object.keys(options ?? {}) as Array<keyof Options>
	for (const key of optionKeys) {
		const value = options?.[key]
		if (value !== undefined) {
			result[key] = value
		}
	}

	return result
}
