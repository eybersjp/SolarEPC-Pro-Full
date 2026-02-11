import { ReactElement } from 'react'
import { render } from '@testing-library/react'

export interface PerformanceMetrics {
    testName: string
    renderTime: number
    modules?: number
    apiCalls?: number
    memoryDelta?: number
    timestamp: string
}

/**
 * Measures the initial render time of a component
 */
export async function measureRenderTime(
    ui: ReactElement,
    options: any = {}
): Promise<number> {
    const start = performance.now()
    const { unmount } = render(ui, options)
    const end = performance.now()
    unmount()
    return end - start
}

/**
 * Tracks memory usage (Chrome only)
 */
export function trackMemoryUsage(): { initial: number; final: number; delta: number } {
    // @ts-ignore - performance.memory is Chrome specific
    const memory = (performance as any).memory
    if (!memory) {
        return { initial: 0, final: 0, delta: 0 }
    }

    const initial = memory.usedJSHeapSize
    // Force GC if possible (requires --expose-gc)
    if (global.gc) global.gc()

    return {
        initial,
        get final() {
            return memory.usedJSHeapSize
        },
        get delta() {
            return memory.usedJSHeapSize - initial
        }
    }
}

/**
 * Generates a structured performance report
 */
export function generatePerformanceReport(metrics: PerformanceMetrics[]): string {
    const rows = metrics.map(m =>
        `| ${m.testName.padEnd(40)} | ${m.renderTime.toFixed(2).padStart(10)}ms | ${String(m.modules || 'N/A').padStart(8)} |`
    ).join('\n')

    return `
# Frontend Performance Report
Generated: ${new Date().toISOString()}

| Test Case                                | Render Time   | Modules  |
|------------------------------------------|---------------|----------|
${rows}
`
}

/**
 * Compares current metrics with baseline
 */
export function compareWithBaseline(current: PerformanceMetrics, baseline: PerformanceMetrics): {
    diff: number
    isRegression: boolean
} {
    const diff = (current.renderTime - baseline.renderTime) / baseline.renderTime
    return {
        diff,
        isRegression: diff > 0.1 // 10% threshold
    }
}
