import { getHash } from '../../src/lib/utilities/string'

export const TEST_PROFILE_NAME = 'yanki-tests'

/**
 * Namespace for the notes of a file fixture test, unique to its description.
 */
export function getTestNamespace(description: string): string {
	return `Yanki Test - ${getHash(description, 16)}`
}

declare module 'vitest' {
	// eslint-disable-next-line ts/consistent-type-definitions
	interface ProvidedContext {
		ankiBasePath: string
		ankiConnectVersion: string
	}
}
