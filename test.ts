import { syncNoteFiles } from './src/lib/sync/sync'
import prettyMilliseconds from 'pretty-ms'

const testPaths = [
	'./test/assets/cloze.md',
	'./test/assets/cloze-extra.md',
	'./test/assets/basic.md',
	'./test/assets/nested/basic.md',
	'./test/assets/nested/empty/another/basic.md',
	'./test/assets/basic-no-back.md',
	'./test/assets/basic-and-reversed-card.md',
	'./test/assets/basic-type-in-the-answer.md',
	'./test/assets-more/basic.md',
]

const result = await syncNoteFiles(testPaths)

const checkedCount = result.synced.filter((note) => note.action === 'unchanged').length
const updatedCount = result.synced.filter((note) => note.action === 'updated').length
const created = result.synced.filter((note) =>
	['created', 'recreated'].includes(note.action),
).length

console.log(
	`Created ${created}, updated ${updatedCount}, checked ${checkedCount}, deleted ${result.deleted.length} in ${prettyMilliseconds(result.duration)}`,
)
