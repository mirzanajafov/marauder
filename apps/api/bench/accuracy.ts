import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Run, measure, scenarios, variants } from '../src/position/accuracy';

const run: Run = { seed: 7, minutes: 30, tagCount: 6 };
const started = Date.now();
const results = scenarios.map((scenario) => ({ scenario: scenario.name, variants: measure(scenario, variants, run) }));

for (const result of results) {
  console.log(`\n${result.scenario}`);
  console.table(result.variants);
}

writeFileSync(join(__dirname, 'accuracy.json'), `${JSON.stringify({ run, results }, null, 2)}\n`);
console.log(`\n${((Date.now() - started) / 1000).toFixed(1)} s`);
