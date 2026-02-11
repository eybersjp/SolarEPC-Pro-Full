import fs from 'fs';
import path from 'path';

interface Metric {
    testName: string;
    renderTime: number;
    modules?: number;
    timestamp: string;
}

function compareBenchmarks() {
    const currentPath = path.resolve(process.cwd(), 'benchmarks', 'frontend-latest.json');
    const baselinePath = path.resolve(process.cwd(), 'benchmarks', 'baseline.json');

    if (!fs.existsSync(currentPath)) {
        console.error(`Current results not found at ${currentPath}`);
        process.exit(1);
    }

    if (!fs.existsSync(baselinePath)) {
        console.log(`Baseline not found at ${baselinePath}. Saving current as baseline.`);
        fs.copyFileSync(currentPath, baselinePath);
        process.exit(0);
    }

    const current: Metric[] = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
    const baseline: Metric[] = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));

    const baselineMap = new Map(baseline.map(m => [m.testName, m]));
    const threshold = 0.1; // 10%
    let hasRegression = false;

    console.log('\nFrontend Performance Comparison:');
    console.log('-'.repeat(80));
    console.log(`${'Test Case'.slice(0, 40).padEnd(40)} | ${'Base (ms)'.padEnd(12)} | ${'Curr (ms)'.padEnd(12)} | ${'Change %'}`);
    console.log('-'.repeat(80));

    current.forEach(curr => {
        const base = baselineMap.get(curr.testName);
        if (base) {
            const diff = (curr.renderTime - base.renderTime) / base.renderTime;
            let status = '';
            if (diff > threshold) {
                status = '!!! REGRESSION !!!';
                hasRegression = true;
            } else if (diff < -threshold) {
                status = '+++ IMPROVEMENT +++';
            }

            console.log(`${curr.testName.slice(0, 40).padEnd(40)} | ${base.renderTime.toFixed(2).padEnd(12)} | ${curr.renderTime.toFixed(2).padEnd(12)} | ${(diff * 100).toFixed(1).padStart(7)}% ${status}`);
        } else {
            console.log(`${curr.testName.slice(0, 40).padEnd(40)} | ${'N/A'.padEnd(12)} | ${curr.renderTime.toFixed(2).padEnd(12)} | NEW`);
        }
    });

    console.log('-'.repeat(80));

    if (hasRegression) {
        console.error('\nFound performance regressions!');
        process.exit(1);
    } else {
        console.log('\nNo significant regressions detected.');
        process.exit(0);
    }
}

compareBenchmarks();
