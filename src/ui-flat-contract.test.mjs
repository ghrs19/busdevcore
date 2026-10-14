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

test('components use shared classes instead of inline clones', () => {
  const offenders = [];
  for (const f of files) {
    const s = readFileSync(f, 'utf8');
    if (/<label\b[^>]*style=\{\{[^}]*display:\s*'block'/.test(s)) offenders.push(`${f}: inline block label`);
    if (/'btn-primary[^']*'\s*:\s*'btn-secondary/.test(s)) offenders.push(`${f}: primary/secondary toggle swap`);
    if (/rgb\(8 10 14/.test(s)) offenders.push(`${f}: inline modal scrim`);
    if (/border-b-2/.test(s)) offenders.push(`${f}: underline tab`);
  }
  assert.deepEqual(offenders, []);
});

test('globals.css defines shared modal, tab and label classes', () => {
  const css = readFileSync('src/app/globals.css', 'utf8');
  for (const c of ['.modal-overlay', '.modal-panel', '.tab-bar', '.tab.active', '.field-label', '.btn-danger', '.btn-icon']) {
    assert.ok(css.includes(c), `missing ${c}`);
  }
});

test('page, navbar and fixed action bars share Master width; audit JSON stays flat', () => {
  const css = readFileSync('src/app/globals.css', 'utf8');
  assert.match(css, /--page-max:\s*1360px/);
  assert.match(css, /\.audit-detail[^\n]*background:\s*transparent;\s*box-shadow:\s*none/);
  for (const f of ['src/components/ui/Page.tsx', 'src/components/Navbar.tsx', 'src/app/commercial/new/page.tsx', 'src/app/estimates/new/page.tsx']) {
    assert.match(readFileSync(f, 'utf8'), /maxWidth:\s*'var\(--page-max\)'/, f);
  }
  const audit = readFileSync('src/app/audit/page.tsx', 'utf8');
  assert.match(audit, /className="audit-detail[^\"]*"/);
  assert.doesNotMatch(audit, /audit-detail[^\"]*hover:bg-/);
});

test('Copilot uses a protected full page with server-side Hermes bridge, not a floating widget', () => {
  const layout = readFileSync('src/app/layout.tsx', 'utf8');
  const navbar = readFileSync('src/components/Navbar.tsx', 'utf8');
  const page = readFileSync('src/app/copilot/page.tsx', 'utf8');
  const middleware = readFileSync('src/middleware.ts', 'utf8');
  assert.doesNotMatch(layout, /AIChatWidget/);
  assert.match(navbar, /href: '\/copilot'.*adminOnly: true/);
  assert.match(middleware, /pathname\.startsWith\('\/copilot'\)/);
  assert.match(page, /fetch\('\/api\/ai\/chat'/);
  assert.doesNotMatch(page, /HERMES_API_KEY|HERMES_API_URL/);
});

test('Copilot shows Hermes tool activity without executable model markup', () => {
  const page = readFileSync('src/app/copilot/page.tsx', 'utf8');
  assert.match(page, /result\.tools/);
  assert.match(page, /m\.tools\?\.map/);
  assert.doesNotMatch(page, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(page, /hanya baca|Tidak dapat mengubah data/);
});

test('headings, fixed chrome and status chips use shared classes', () => {
  const offenders = [];
  for (const f of files) {
    const s = readFileSync(f, 'utf8');
    if (/<h[1-4]\b[^>]*style=\{\{[^}]*fontSize/.test(s)) offenders.push(`${f}: inline heading size`);
    if (/position:\s*'fixed'/.test(s) && !f.endsWith('AIChatWidget.tsx')) offenders.push(`${f}: inline fixed positioning`);
  }
  assert.deepEqual(offenders, []);
  const css = readFileSync('src/app/globals.css', 'utf8');
  for (const c of ['.heading-page', '.heading-md', '.heading-sm', '.sticky-bar', '.toast', '.status-chip']) {
    assert.ok(css.includes(c), `missing ${c}`);
  }
});
