const assert = require('assert');
const BASE_URL = 'http://localhost:3001';

async function verifyMultiPage() {
  console.log('=== VERIFIKASI MULTI-PAGE ARCHITECTURE BUSDEVCORE ===\n');

  // 1. Dashboard Page '/'
  console.log('1. Checking Main Page: GET http://localhost:3001...');
  const mainRes = await fetch(BASE_URL);
  assert.strictEqual(mainRes.status, 200, 'Main page must return 200 OK');
  const mainHtml = await mainRes.text();

  assert.ok(mainHtml.includes('busdevcore'), 'Navbar brand busdevcore present');
  assert.ok(mainHtml.includes('Estimates / Dashboard'), 'Navbar link Estimates / Dashboard present');
  assert.ok(mainHtml.includes('+ Buat Costing'), 'Navbar link + Buat Costing present');
  assert.ok(mainHtml.includes('Historical Estimates'), 'Page title Historical Estimates present');
  assert.ok(mainHtml.includes('+ Buat Costing Baru'), 'Button + Buat Costing Baru present');
  assert.ok(mainHtml.includes('Total Estimasi'), 'Metric card Total Estimasi present');
  assert.ok(mainHtml.includes('Total Nilai Biaya'), 'Metric card Total Nilai Biaya present');
  assert.ok(mainHtml.includes('Rata-rata Biaya'), 'Metric card Rata-rata Biaya present');
  assert.ok(mainHtml.includes('Total Jam Kerja'), 'Metric card Total Jam Kerja present');
  console.log('PASS: Main page HTML structure verified.');

  // 2. New Estimate Page '/estimates/new'
  console.log('\n2. Checking New Estimate Page: GET http://localhost:3001/estimates/new...');
  const newRes = await fetch(`${BASE_URL}/api/estimates`);
  assert.strictEqual(newRes.status, 200, 'API estimates returns 200 OK');

  const formRes = await fetch(`${BASE_URL}/estimates/new`);
  assert.strictEqual(formRes.status, 200, 'Form page must return 200 OK');
  const formHtml = await formRes.text();

  assert.ok(formHtml.includes('Buat Costing Baru'), 'Form title Buat Costing Baru present');
  assert.ok(formHtml.includes('Kembali ke Daftar Estimasi'), 'Back link present');
  assert.ok(formHtml.includes('Informasi Proyek'), 'Section 1 Project & Client info present');
  assert.ok(formHtml.includes('Klasifikasi Layanan'), 'Section 2 Classification present');
  assert.ok(formHtml.includes('Master Rate Per Jam'), 'Section 3 Master Rate config present');
  assert.ok(formHtml.includes('WBS Matrix'), 'Section 4 WBS Matrix present');
  assert.ok(formHtml.includes('Simpan Estimasi'), 'Submit button present');
  console.log('PASS: New estimate form page HTML structure verified.');

  // 3. Test Detail API endpoint for Inspect Modal
  console.log('\n3. Checking Estimate Detail Breakdown API /api/estimates/:id...');
  const estimatesList = await (await fetch(`${BASE_URL}/api/estimates`)).json();
  assert.ok(estimatesList.success);
  assert.ok(estimatesList.estimates.length > 0, 'Must have at least 1 estimate');

  const firstEst = estimatesList.estimates[0];
  const detailRes = await fetch(`${BASE_URL}/api/estimates/${firstEst.id}`);
  assert.strictEqual(detailRes.status, 200);
  const detailData = await detailRes.json();

  assert.ok(detailData.success);
  assert.ok(detailData.estimate);
  assert.strictEqual(detailData.estimate.id, firstEst.id);
  assert.ok(Array.isArray(detailData.estimate.modules), 'Modules array present');
  console.log(`PASS: Detail endpoint returned ${detailData.estimate.modules.length} modules for estimate #${firstEst.id}.`);

  console.log('\n=== ALL MULTI-PAGE ARCHITECTURE CHECKS PASSED ===');
}

verifyMultiPage().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
