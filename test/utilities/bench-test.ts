import type { BenchRunOptions } from 'vitest'
import slugify from '@sindresorhus/slugify'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'vitest'

// Benchmarks run inside tests, so the test timeout has to cover every warmup
// and measured iteration of the slowest benchmark.
const BENCH_TEST_TIMEOUT_MILLISECONDS = 10 * 60 * 1000

const BASELINE_DIRECTORY = path.resolve(import.meta.dirname, '../benchmarks')

// Set by the `bench:baseline` script
const isRecordingBaseline = process.env.YANKI_BENCH_RECORD_BASELINE === 'true'

/**
 * Define a test that runs a single benchmark under the test's own name.
 *
 * When the `YANKI_BENCH_RECORD_BASELINE` environment variable is `true`, the
 * result is stored as the benchmark's baseline in the git-ignored
 * `test/benchmarks` directory. Otherwise the benchmark is compared against its
 * stored baseline, if it has one.
 *
 * @param name Name shared by the test and the benchmark it runs, and the source
 *   of the baseline file name
 * @param benchmarkedFunction The function to measure
 * @param options Iteration and time budgets for the run
 */
export function benchTest(
	name: string,
	benchmarkedFunction: () => Promise<void>,
	options: BenchRunOptions = {},
): void {
	const baselinePath = path.join(BASELINE_DIRECTORY, `${slugify(name)}.json`)

	test(name, { timeout: BENCH_TEST_TIMEOUT_MILLISECONDS }, async ({ bench }) => {
		if (isRecordingBaseline) {
			await bench(name, { writeResult: baselinePath }, benchmarkedFunction).run(options)
			return
		}

		if (!fs.existsSync(baselinePath)) {
			await bench(name, benchmarkedFunction).run(options)
			return
		}

		await bench.compare(
			bench(name, benchmarkedFunction),
			bench.from('baseline', baselinePath),
			options,
		)
	})
}
