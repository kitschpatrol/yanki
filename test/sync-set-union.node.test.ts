import type { PartialDeep } from 'type-fest'
import fs from 'node:fs/promises'
import path from 'node:path'
import { expect, it } from 'vitest'
import type { SyncFilesOptions } from '../src/lib'
import { syncFiles } from '../src/lib'
import { getAllFrontmatter } from '../src/lib/model/frontmatter'
import { describeWithFileFixture } from './fixtures/file-fixture'

/**
 * Reproduces the reported second-sync "TypeError: n.union is not a function"
 * https://github.com/kitschpatrol/yanki-obsidian/issues/81
 */
describeWithFileFixture(
	'sync after adding a note in a nested deck',
	{
		assetPath: './test/assets/test-sync-set-union',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it(
			'syncs a new note in a nested deck after the initial sync',
			{ timeout: 60_000 },
			async () => {
				const options: PartialDeep<SyncFilesOptions> = {
					allFilePaths: context.allFiles,
					ankiConnectOptions: { autoLaunch: false },
					ankiWeb: false,
					basePath: path.join(context.tempAssetPath, 'Anki'),
					namespace: context.namespace,
					obsidianVault: 'Vault',
				}
				const firstResults = await syncFiles(context.markdownFiles, options)
				expect(firstResults.synced).toHaveLength(4)
				expect(firstResults.synced.every(({ action }) => action === 'created')).toBe(true)
				expect(firstResults.synced.map(({ note }) => note.deckName).toSorted()).toEqual([
					'Animals',
					'Animals::Biped',
					'Animals::Quadruped',
					'Non-living things',
				])

				for (const { filePath, note } of firstResults.synced) {
					const markdown = await fs.readFile(filePath!, 'utf8')
					const frontmatter = await getAllFrontmatter(markdown)
					expect(frontmatter.noteId).toBeGreaterThan(0)
					expect(frontmatter.noteId).toBe(note.noteId)
				}

				const chickenPath = path.join(context.tempAssetPath, 'Anki/Animals/Biped/Chicken.md')
				await fs.writeFile(chickenPath, 'Chicken\n\n---\n\nA biped.\n')
				context.markdownFiles.push(chickenPath)
				context.allFiles.push(chickenPath)

				// Existing notes should remain unchanged while Chicken gets created.
				const secondResults = await syncFiles(context.markdownFiles, options)
				expect(secondResults.synced).toHaveLength(5)
				for (const { filePath, note } of firstResults.synced) {
					expect(secondResults.synced.find((synced) => synced.filePath === filePath)).toMatchObject(
						{
							action: 'unchanged',
							note: { noteId: note.noteId },
						},
					)
				}

				const chicken = secondResults.synced.find(({ action }) => action === 'created')
				expect(chicken).toMatchObject({ note: { deckName: 'Animals::Biped' } })
				const chickenFrontmatter = await getAllFrontmatter(await fs.readFile(chickenPath, 'utf8'))
				expect(chickenFrontmatter.noteId).toBeGreaterThan(0)
				expect(chickenFrontmatter.noteId).toBe(chicken?.note.noteId)
				expect(await context.yankiConnect.note.findNotes({ query: '*' })).toHaveLength(5)
			},
		)
	},
)
