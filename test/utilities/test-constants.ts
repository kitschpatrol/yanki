export const TEST_PROFILE_NAME = 'yanki-tests'

declare module 'vitest' {
	// eslint-disable-next-line ts/consistent-type-definitions
	interface ProvidedContext {
		ankiBasePath: string
	}
}
