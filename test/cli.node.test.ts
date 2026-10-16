import { execa } from 'execa'
import fs from 'node:fs/promises'
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

/**
 * Runs the built CLI with the given arguments and parses its JSON output.
 */
async function runCli(args: string[]): Promise<unknown> {
	try {
		await fs.access(cliPath)
	} catch (error) {
		throw new Error(`Built CLI not found at ${cliPath}. Run \`pnpm build\` first.`, {
			cause: error,
		})
	}

	const { stdout } = await execa(process.execPath, [cliPath, ...args, '--json'])
	return JSON.parse(stdout)
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
		})
	},
)
