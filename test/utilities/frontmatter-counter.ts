/* eslint-disable jsdoc/require-jsdoc */

import fs from 'node:fs/promises'

const NEWLINE_REGEX = /\r?\n/

export async function countLinesOfFrontmatter(filePath: string) {
	const markdown = await fs.readFile(filePath, 'utf8')
	const markdownLines = markdown.split(NEWLINE_REGEX)
	const startFrontmatterDelimiterLine = markdownLines.findIndex((line) => line.startsWith('---'))
	const endFrontmatterDelimiterLine = markdownLines.findIndex(
		(line, index) => index > startFrontmatterDelimiterLine && line.startsWith('---'),
	)
	return endFrontmatterDelimiterLine - startFrontmatterDelimiterLine
}
