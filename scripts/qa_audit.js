const assert = require('assert');

async function runQAAudit() {
  const BASE_URL = 'http://localhost:3001';
  console.log('--- STARTING QA AUDIT FOR TASK t_64ad264e ---');

  // 1. Check Main Page '/' HTML & Elements
  console.log('\n[TEST 1] Verifying Main Page (/) structure...');
  const homeRes = await fetch(BASE_URL + '/');
  assert.strictEqual(homeRes.status, 200, 'Main page must respond with 200 OK');
  const homeHtml = await homeRes.text();

  assert(homeHtml.includes('Historical Estimates'), 'Historical Estimates title present');
  assert(homeHtml.includes('+ Buat Costing Baru'), 'Button + Buat Costing Baru present');
  assert(homeHtml.includes('href="/estimates/new"'), 'Navigation link to /estimates/new present');
  assert(homeHtml.includes('Total Estimasi'), 'Metric card Total Estimasi present');
  assert(homeHtml.includes('Total Nilai Biaya'), 'Metric card Total Nilai Biaya present');
  assert(homeHtml.includes('Rata-rata Biaya'), 'Metric card Rata-rata Biaya present');
  assert(homeHtml.includes('Total Jam Kerja'), 'Metric card Total Jam Kerja present');
  console.log('✓ Main page headers, links, and metric cards verified.');

  // 2. Check Companies and Metadata API for Search & Filter options
  console.log('\n[TEST 2] Verifying Companies & Metadata API filter data...');
  const [compRes, metaRes] = await Promise.all([
    fetch(BASE_URL + '/api/companies'),
    fetch(BASE_URL + '/api/metadata'),
  ]);
  assert.strictEqual(compRes.status, 200, 'Companies API must return 200 OK');
  assert.strictEqual(metaRes.status, 200, 'Metadata API must return 200 OK');
  const compData = await compRes.json();
  const meta = await metaRes.json();

  assert(compData.success, 'Companies success');
  assert(Array.isArray(compData.companies) && compData.companies.length > 0, 'Companies available');
  assert(meta.success, 'Metadata success');
  assert(Array.isArray(meta.serviceTypes) && meta.serviceTypes.length > 0, 'Service types available');
  assert(Array.isArray(meta.categories) && meta.categories.length > 0, 'Categories available');
  assert(Array.isArray(meta.tags) && meta.tags.length > 0, 'Tags available');
  console.log(`✓ Metadata loaded: ${compData.companies.length} companies, ${meta.serviceTypes.length} services, ${meta.categories.length} categories, ${meta.tags.length} tags.`);

  // 3. Check /estimates/new Page structure
  console.log('\n[TEST 3] Verifying /estimates/new form page...');
  const formRes = await fetch(BASE_URL + '/estimates/new');
  assert.strictEqual(formRes.status, 200, 'Estimates new page must respond with 200 OK');
  const formHtml = await formRes.text();

  assert(formHtml.includes('Buat Costing Baru'), 'Form header present');
  assert(formHtml.includes('Informasi Proyek'), 'Section project info present');
  assert(formHtml.includes('Klasifikasi Layanan'), 'Section classification present');
  assert(formHtml.includes('Master Rate Per Jam'), 'Section rate master present');
  assert(formHtml.includes('WBS Matrix'), 'Section WBS matrix present');
  assert(formHtml.includes('Simpan Estimasi'), 'Submit button present');
  console.log('✓ Form /estimates/new sections verified.');

  // 4. Test Estimasi Creation with Real Data & Business Rule Validation
  console.log('\n[TEST 4] Testing estimate creation & calculation pipeline via API...');
  const company = compData.companies[0];
  const serviceType = meta.serviceTypes.find((s) => s.code === 'IT');
  const category = meta.categories.find((c) => c.code === 'DEVELOPMENT');
  const tag = meta.tags.find((t) => t.code === 'CR');

  const newPayload = {
    title: 'QA Automated Test Estimate ' + Date.now(),
    company_id: company.id,
    service_type_id: serviceType.id,
    category_id: category.id,
    tag_id: tag.id,
    notes: 'QA Automated verification run',
    custom_rates: {
      pm: 80000,
      web_dev: 55000,
      ui_ux: 50000,
      qc_doc: 40000,
      dev_ops: 65000,
    },
    modules: [
      {
        name: 'Modul Core Auth & RBAC',
        tasks: [
          {
            name: 'NextAuth integration',
            hours_pm: 2,
            hours_web_dev: 10,
            hours_ui_ux: 4,
            hours_qc_doc: 2,
            hours_dev_ops: 2,
          },
          {
            name: 'Permission Middleware',
            hours_pm: 1,
            hours_web_dev: 6,
            hours_ui_ux: 0,
            hours_qc_doc: 2,
            hours_dev_ops: 1,
          },
        ],
      },
    ],
  };

  const createRes = await fetch(BASE_URL + '/api/estimates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newPayload),
  });
  assert.strictEqual(createRes.status, 201, 'POST /api/estimates must return 201 Created');
  const createData = await createRes.json();
  assert(createData.success, 'Create estimate must succeed');
  const newId = createData.estimate.id;
  // Calculate expected hours: (2+10+4+2+2) + (1+6+0+2+1) = 20 + 10 = 30 hours
  assert.strictEqual(Number(createData.estimate.total_hours), 30, 'Total hours must be 30');
  console.log(`✓ Estimate created: ID #${newId}, total hours: ${createData.estimate.total_hours}, total cost: Rp ${Number(createData.estimate.total_cost).toLocaleString('id-ID')}`);

  // 5. Verify Estimate Detail Inspect endpoint
  console.log('\n[TEST 5] Testing inspect detail modal endpoint /api/estimates/:id...');
  const detailRes = await fetch(`${BASE_URL}/api/estimates/${newId}`);
  assert.strictEqual(detailRes.status, 200, 'GET /api/estimates/:id must return 200 OK');
  const detailData = await detailRes.json();
  assert(detailData.success, 'Detail must be successful');
  assert.strictEqual(detailData.estimate.id, newId, 'Detail ID must match');
  assert.strictEqual(detailData.estimate.modules.length, 1, 'Module length must match');
  assert.strictEqual(detailData.estimate.modules[0].tasks.length, 2, 'Task length must match');
  console.log(`✓ Inspect detail retrieved: ${detailData.estimate.modules.length} module, ${detailData.estimate.modules[0].tasks.length} tasks.`);

  // 6. Verify Estimate appears in Historical Estimates list
  console.log('\n[TEST 6] Verifying presence in Historical Estimates list...');
  const listRes = await fetch(BASE_URL + '/api/estimates');
  assert.strictEqual(listRes.status, 200, 'GET /api/estimates must return 200 OK');
  const listData = await listRes.json();
  assert(listData.success, 'List response must succeed');
  const found = listData.estimates.find((e) => e.id === newId);
  assert(found, `Newly created estimate #${newId} must be in the estimates list`);
  console.log(`✓ Estimate #${newId} verified in historical estimates list.`);

  console.log('\n=== ALL QA CRITERIA VERIFIED SUCCESSFULLY ===\n');
}

runQAAudit().catch((err) => {
  console.error('QA AUDIT FAILED:', err);
  process.exit(1);
});
