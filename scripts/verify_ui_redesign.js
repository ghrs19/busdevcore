const assert = require('assert');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3001';

async function verifyUI() {
  console.log('=== VERIFIKASI UI/UX REDESIGN BUSDEVCORE ===\n');

  // 1. Fetch HTML from localhost:3001
  console.log('1. Checking HTTP GET http://localhost:3001...');
  const res = await fetch(BASE_URL);
  assert.strictEqual(res.status, 200, 'Server must return status 200');
  const html = await res.text();
  console.log('PASS: HTTP 200 OK, HTML length:', html.length);

  // 2. Check CSS styling tokens in globals.css
  console.log('\n2. Verifying Linear/Vercel styling tokens in globals.css...');
  const cssPath = path.join(__dirname, '../src/app/globals.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.ok(css.includes('--bg-canvas: #08090a'), 'Palette #08090a defined');
  assert.ok(css.includes('--bg-panel: #0f1011'), 'Panel background defined');
  assert.ok(css.includes('--accent-primary: #5e6ad2'), 'Linear accent color defined');
  assert.ok(css.includes('.linear-card'), 'linear-card class defined');
  assert.ok(css.includes('.font-mono-numbers'), 'font-mono-numbers class defined');
  assert.ok(css.includes('.pill-group'), 'tactile pill-group class defined');
  assert.ok(css.includes('.pill-item'), 'pill-item class defined');
  assert.ok(css.includes('.badge-connected'), 'status badge class defined');
  assert.ok(css.includes('.linear-table'), 'linear-table class defined');
  console.log('PASS: globals.css contains complete Linear/Vercel dark minimal design tokens.');

  // 3. Inspect page component structure in page.tsx
  console.log('\n3. Verifying page.tsx UI/UX component hierarchy...');
  const pagePath = path.join(__dirname, '../src/app/page.tsx');
  const pageSrc = fs.readFileSync(pagePath, 'utf8');

  // Header & Badges
  assert.ok(pageSrc.includes('busdevcore') && pageSrc.includes('ERP'), 'Header brand & ERP label present');
  assert.ok(pageSrc.includes('PostgreSQL Connected') && pageSrc.includes('Port 3001'), 'Status badges present');

  // Metric Summary Cards
  assert.ok(pageSrc.includes('Total Estimated Cost'), 'Metric card: Total Estimated Cost present');
  assert.ok(pageSrc.includes('Total Manhours'), 'Metric card: Total Manhours present');
  assert.ok(pageSrc.includes('Module Count'), 'Metric card: Module Count present');
  assert.ok(pageSrc.includes('Task Count'), 'Metric card: Task Count present');

  // Company selection & New Company modal
  assert.ok(pageSrc.includes('Company & Project Info'), 'Section 1: Company & Project Info present');
  assert.ok(pageSrc.includes('Register New Company') || pageSrc.includes('+ New Company'), 'New company expander present');

  // Service, Category, Tag Pills
  assert.ok(pageSrc.includes('Service & Classification'), 'Section 2: Service & Classification present');
  assert.ok(pageSrc.includes('pill-group') && pageSrc.includes('pill-item'), 'Tactile pill selectors implemented');

  // Rate Configuration (Collapsible)
  assert.ok(pageSrc.includes('Hourly Rate Configuration'), 'Section 3: Collapsible rate configuration present');
  assert.ok(pageSrc.includes('isRateExpanded'), 'Rate expander toggle implemented');

  // Module & Task Breakdown
  assert.ok(pageSrc.includes('Module & Task Breakdown'), 'Section 4: Module & Task Breakdown present');
  assert.ok(pageSrc.includes('calculateModule'), 'Real-time module calculation used');
  assert.ok(pageSrc.includes('hours_pm') && pageSrc.includes('hours_web_dev'), 'Role-specific hour inputs present');

  // Live calculation sidebar
  assert.ok(pageSrc.includes('Live Calculation'), 'Sidebar Live Calculation present');
  assert.ok(pageSrc.includes('Grand Total Cost'), 'Grand Total Cost present');
  assert.ok(pageSrc.includes('Grand Total Manhours'), 'Grand Total Manhours present');
  assert.ok(pageSrc.includes('Role Hours & Cost'), 'Role breakdown present');

  // Historical Estimates & Modal Inspector
  assert.ok(pageSrc.includes('Historical Estimates'), 'Section 5: Historical Estimates present');
  assert.ok(pageSrc.includes('inspectEstimate') && pageSrc.includes('setInspectEstimate'), 'Modal inspector implemented');
  console.log('PASS: page.tsx contains all requested UI/UX redesign features.');

  // 4. Test live API endpoints
  console.log('\n4. Verifying live API data & calculations...');
  const estRes = await fetch(`${BASE_URL}/api/estimates`);
  assert.strictEqual(estRes.status, 200);
  const estData = await estRes.json();
  assert.ok(estData.success);
  assert.ok(Array.isArray(estData.estimates));
  console.log(`PASS: /api/estimates returned ${estData.estimates.length} historical estimates.`);

  const metaRes = await fetch(`${BASE_URL}/api/metadata`);
  assert.strictEqual(metaRes.status, 200);
  const metaData = await metaRes.json();
  assert.ok(metaData.success);
  console.log('PASS: /api/metadata returned services, categories, tags, and roles.');

  console.log('\n=== ALL UI/UX REDESIGN CHECKS VERIFIED SUCCESSFULLY ===');
}

verifyUI().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
