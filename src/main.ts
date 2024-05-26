import { getAnkiJsonFromMarkdown } from './parse/parse'
import fs from 'node:fs/promises'

const markdownContent = await fs.readFile('./test/assets/basic-type-in-the-answer.md', 'utf8')
const note = await getAnkiJsonFromMarkdown(markdownContent)
console.log(note)
