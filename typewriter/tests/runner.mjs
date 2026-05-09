// Minimal red/green test runner
let passed = 0, failed = 0;
const failures = [];

export function describe(name, fn) { console.log(`\n▶ ${name}`); fn(); }
export function it(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch(e) { console.log(`  ❌ ${name}\n     ${e.message}`); failed++; failures.push({name,e}); }
}
export function expect(val) {
  return {
    toBe: (exp) => { if (val !== exp) throw new Error(`expected ${JSON.stringify(exp)}, got ${JSON.stringify(val)}`); },
    toEqual: (exp) => { if (JSON.stringify(val) !== JSON.stringify(exp)) throw new Error(`expected ${JSON.stringify(exp)}, got ${JSON.stringify(val)}`); },
    toBeCloseTo: (exp, d=2) => { if (Math.abs(val-exp) > 10**-d) throw new Error(`expected ~${exp}, got ${val}`); },
    toBeTruthy: () => { if (!val) throw new Error(`expected truthy, got ${val}`); },
    toBeFalsy: () => { if (val) throw new Error(`expected falsy, got ${val}`); },
    toBeGreaterThan: (exp) => { if (val <= exp) throw new Error(`expected > ${exp}, got ${val}`); },
    toBeLessThan: (exp) => { if (val >= exp) throw new Error(`expected < ${exp}, got ${val}`); },
    toBeLessThanOrEqual: (exp) => { if (val > exp) throw new Error(`expected <= ${exp}, got ${val}`); },
  };
}
export function afterAll(fn) { process.on('exit', fn); }
process.on('exit', () => {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exitCode = 1;
});
