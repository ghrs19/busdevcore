import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx') && !p.includes('/print/')) out.push(p);
  }
  return out;
}

const files = walk('src');

test('flat theme: no inline shadows, blur or gradients in UI source', () => {
  const offenders = [];
  for (const f of files) {
    const s = readFileSync(f, 'utf8');
    if (/boxShadow:|backdropFilter:|linear-gradient\(/.test(s)) offenders.push(f);
  }
  assert.deepEqual(offenders, []);
});

test('icon buttons rely on btn-icon sizing, not inline width/height', () => {
  const offenders = [];
  for (const f of files) {
    const s = readFileSync(f, 'utf8');
    for (const m of s.matchAll(/<(?:button|a|Link)\b[^>]*btn-icon[^>]*style=\{\{[^}]*(?:width|height)\s*:/g)) {
      offenders.push(`${f}: ${m[0].slice(0, 80)}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('globals.css keeps button system flat', () => {
  const css = readFileSync('src/app/globals.css', 'utf8');
  assert.match(css, /\.btn-icon\s*\{[^}]*border-radius:\s*50%/);
  assert.match(css, /--shadow-card:\s*none/);
  assert.match(css, /--shadow-pop:\s*none/);
});
