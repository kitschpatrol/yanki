import type { AddressInfo } from 'node:net'
import { execa } from 'execa'
import fs from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'
import { expect, it } from 'vitest'
import type { CleanResult, SetStyleResult, SyncFilesResult } from '../src/lib'
import { getStyle, listNotes, syncFiles } from '../src/lib'
import { CSS_DEFAULT_STYLE } from '../src/lib/shared/constants'
import { getSlugifiedNamespace } from '../src/lib/utilities/namespace'
import { describeWithFileFixture } from './fixtures/file-fixture'

// Runs the bundled CLI, since bundling can break code paths that pass when tested from source
const cliPath = path.resolve('dist/bin/cli.js')
const customCssPath = path.resolve('test/assets/test-style/custom.css')
const stackTraceLine = /^\s+at /mv

/**
 * Throws an actionable error if the CLI hasn't been built.
 */
async function assertCliBuilt(): Promise<void> {
	try {
		await fs.access(cliPath)
	} catch (error) {
		throw new Error(`Built CLI not found at ${cliPath}. Run \`pnpm build\` first.`, {
			cause: error,
		})
	}
}

/**
 * Runs the built CLI with the given arguments and parses its JSON output.
 */
async function runCli(args: string[]): Promise<unknown> {
	await assertCliBuilt()
	const { stdout } = await execa(process.execPath, [cliPath, ...args, '--json'])
	return JSON.parse(stdout)
}

/**
 * Gets a port with nothing listening on it. Avoids fixed low ports, since
 * Node's fetch refuses some of them (e.g. port 1) before connecting.
 */
async function getClosedPort(): Promise<number> {
	const server = net.createServer()
	await new Promise<void>((resolve) => {
		server.listen(0, '127.0.0.1', resolve)
	})
	const { port } = server.address() as AddressInfo
	await new Promise((resolve) => {
		server.close(resolve)
	})
	return port
}

/**
 * Runs the built CLI against a port with nothing listening, as if Anki were
 * closed. Resolves with the exit code and output instead of throwing on
 * failure.
 */
async function runCliWithoutAnki(args: string[]) {
	await assertCliBuilt()
	const ankiConnect = `http://127.0.0.1:${await getClosedPort()}`
	return execa(process.execPath, [cliPath, ...args, '--anki-connect', ankiConnect], {
		reject: false,
	})
}

/**
 * Checks for the friendly error, and for no yargs help text or stack trace.
 */
function expectAnkiUnreachableError({ exitCode, stderr }: { exitCode?: number; stderr: string }) {
	expect(exitCode).toBe(1)
	expect(stderr).toContain(
		'Failed to connect to Anki. Make sure Anki is running and AnkiConnect is installed.',
	)
	expect(stderr).not.toContain('Options:')
	expect(stderr).not.toMatch(stackTraceLine)
}

describeWithFileFixture(
	'built cli',
	{
		assetPath: './test/assets/test-media-resync/',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		async function syncWithLibrary(): Promise<SyncFilesResult> {
			return syncFiles(context.markdownFiles, {
				allFilePaths: context.allFiles,
				ankiConnectOptions: {
					autoLaunch: false,
				},
				ankiWeb: false,
				dryRun: false,
				namespace: context.namespace,
				syncMediaAssets: 'local',
			})
		}

		async function getMediaFileNames(): Promise<string[]> {
			return context.yankiConnect.media.getMediaFilesNames({
				pattern: `${getSlugifiedNamespace(context.namespace)}-*`,
			})
		}

		it('syncs a note with local media', { timeout: 60_000 }, async () => {
			const result = (await runCli([
				'sync',
				context.tempAssetPath,
				'--namespace',
				context.namespace,
				'--anki-web',
				'false',
				'--sync-media',
				'local',
			])) as SyncFilesResult

			expect(result.synced).toHaveLength(1)
			expect(result.synced[0]?.action).toBe('created')
			expect(await getMediaFileNames()).toHaveLength(1)
		})

		it('lists synced notes', { timeout: 60_000 }, async () => {
			const syncResult = await syncWithLibrary()

			const result = (await runCli(['list', '--namespace', context.namespace])) as Awaited<
				ReturnType<typeof listNotes>
			>

			expect(result.notes.map((note) => note.noteId)).toEqual(
				syncResult.synced.map((synced) => synced.note.noteId),
			)
		})

		it('deletes synced notes and their media', { timeout: 60_000 }, async () => {
			await syncWithLibrary()

			const result = (await runCli([
				'delete',
				'--namespace',
				context.namespace,
				'--anki-web',
				'false',
			])) as CleanResult

			expect(result.deletedNotes).toHaveLength(1)

			const { notes } = await listNotes({
				ankiConnectOptions: {
					autoLaunch: false,
				},
				namespace: context.namespace,
			})
			expect(notes).toHaveLength(0)
			expect(await getMediaFileNames()).toHaveLength(0)
		})

		it('sets and resets the note style', { timeout: 60_000 }, async () => {
			const customResult = (await runCli([
				'style',
				'--css',
				customCssPath,
				'--anki-web',
				'false',
			])) as SetStyleResult

			expect(customResult.models.length).toBeGreaterThan(0)
			expect(await getStyle({ ankiConnectOptions: { autoLaunch: false } })).toBe(
				await fs.readFile(customCssPath, 'utf8'),
			)

			// Omitting --css restores the default, which also leaves Anki clean for later tests
			await runCli(['style', '--anki-web', 'false'])

			expect(await getStyle({ ankiConnectOptions: { autoLaunch: false } })).toBe(CSS_DEFAULT_STYLE)

			// Clean means identical to the CSS of Anki's own note types
			const { css: ankiDefaultCss } = await context.yankiConnect.model.modelStyling({
				modelName: 'Basic',
			})
			expect(CSS_DEFAULT_STYLE).toBe(ankiDefaultCss)
		})
	},
)

describeWithFileFixture(
	'built cli without anki',
	{
		assetPath: './test/assets/test-minimal-notes/',
		cleanUpAnki: false,
		cleanUpTempFiles: true,
	},
	(context) => {
		// eslint-disable-next-line test/expect-expect -- expectAnkiUnreachableError makes the assertions.
		it.each([
			{ args: ['list'] },
			// Random namespace, don't touch anything
			{ args: ['delete', '--namespace', 'D2FCB6BB-7214-458C-82C6-1ECC7593656F'] },
			{ args: ['style'] },
		])('$args.0 reports that Anki is unreachable', { timeout: 20_000 }, async ({ args }) => {
			expectAnkiUnreachableError(await runCliWithoutAnki(args))
		})

		it('sync reports that Anki is unreachable', { timeout: 20_000 }, async () => {
			const result = await runCliWithoutAnki(['sync', context.tempAssetPath])

			expectAnkiUnreachableError(result)
			expect(result.stderr).toContain(
				`Failed to sync ${context.markdownFiles.length} notes to Anki`,
			)
		})

		it('sync --dry-run reports that Anki is unreachable', { timeout: 20_000 }, async () => {
			const result = await runCliWithoutAnki(['sync', context.tempAssetPath, '--dry-run'])

			expectAnkiUnreachableError(result)
			expect(result.stderr).toContain(
				`Failed to sync ${context.markdownFiles.length} notes to Anki.`,
			)
		})

		it('sync --json reports each note as unreachable', { timeout: 20_000 }, async () => {
			const result = await runCliWithoutAnki(['sync', context.tempAssetPath, '--json'])

			expectAnkiUnreachableError(result)
			const { synced } = JSON.parse(result.stdout) as SyncFilesResult
			expect(synced.map((note) => note.action)).toEqual(
				context.markdownFiles.map(() => 'ankiUnreachable'),
			)
		})
	},
)
