import type { BenchRunOptions } from 'vitest'
import { test } from 'vitest'

// Benchmarks run inside tests, so the test timeout has to cover every warmup
// and measured iteration of the slowest benchmark.
const BENCH_TEST_TIMEOUT_MILLISECONDS = 10 * 60 * 1000

/**
 * Define a test that runs a single benchmark under the test's own name.
 *
 * @param name Name shared by the test and the benchmark it runs
 * @param benchmarkedFunction The function to measure
 * @param options Iteration and time budgets for the run
 */
export function benchTest(
	name: string,
	benchmarkedFunction: () => Promise<void>,
	options?: BenchRunOptions,
): void {
	test(name, { timeout: BENCH_TEST_TIMEOUT_MILLISECONDS }, async ({ bench }) => {
		await bench(name, benchmarkedFunction).run(options)
	})
}
