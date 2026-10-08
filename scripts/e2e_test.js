const assert = require('assert');
const BASE_URL = 'http://localhost:3001';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

async function run() {
  console.log('=== STARTING E2E FLOW VERIFICATION ===');

  // 1. Fetch metadata
  console.log('1. Testing GET /api/metadata...');
  const metaRes = await request('/api/metadata');
  assert.strictEqual(metaRes.status, 200);
  assert.strictEqual(metaRes.data.success, true);
  const itService = metaRes.data.serviceTypes.find((s) => s.code === 'IT');
  const digitalService = metaRes.data.serviceTypes.find((s) => s.code === 'DIGITAL');
  const devCategory = metaRes.data.categories.find((c) => c.code === 'DEVELOPMENT');
  const maintCategory = metaRes.data.categories.find((c) => c.code === 'MAINTENANCE');
  const initialTag = metaRes.data.tags.find((t) => t.code === 'INITIAL');
  const crTag = metaRes.data.tags.find((t) => t.code === 'CR');

  assert.ok(itService && itService.is_active, 'IT service active');
  assert.ok(digitalService && !digitalService.is_active, 'DIGITAL service reserved/inactive');
  assert.ok(devCategory, 'Development category exists');
  assert.ok(maintCategory, 'Maintenance category exists');
  assert.ok(initialTag, 'INITIAL tag exists');
  assert.ok(crTag, 'CR tag exists');
  console.log('Metadata OK: IT, DIGITAL, DEVELOPMENT, MAINTENANCE, INITIAL, CR validated.');

  // 2. Pembuatan perusahaan baru
  console.log('\n2. Testing POST /api/companies (new company creation)...');
  const uniqueName = `PT QA Test Company ${Date.now()}`;
  const createCompRes = await request('/api/companies', {
    method: 'POST',
    body: JSON.stringify({
      name: uniqueName,
      email: 'qa@testcompany.com',
      phone: '021-88889999',
      address: 'Jl. Jenderal Sudirman Kav. 1, Jakarta',
    }),
  });
  assert.strictEqual(createCompRes.status, 201);
  assert.strictEqual(createCompRes.data.success, true);
  const newCompany = createCompRes.data.company;
  assert.ok(newCompany.id, 'New company has ID');
  assert.strictEqual(newCompany.name, uniqueName);
  console.log(`PASS: Created new company ID ${newCompany.id}: ${newCompany.name}`);

  // 3. Pemilihan perusahaan existing
  console.log('\n3. Testing GET /api/companies (fetch company list)...');
  const listCompRes = await request('/api/companies');
  assert.strictEqual(listCompRes.status, 200);
  assert.strictEqual(listCompRes.data.success, true);
  const foundNew = listCompRes.data.companies.find((c) => c.id === newCompany.id);
  assert.ok(foundNew, 'Newly created company found in companies list');
  const existingCompany = listCompRes.data.companies.find((c) => c.name === 'PT Djarum') || listCompRes.data.companies[0];
  assert.ok(existingCompany, 'Existing company available for selection');
  console.log(`PASS: Selected existing company ID ${existingCompany.id}: ${existingCompany.name}`);

  // 4. Test validation rules
  console.log('\n4. Testing Business Rule Validations on POST /api/estimates...');
  // 4a. Development without Tag -> must fail 400
  const noTagRes = await request('/api/estimates', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Dev Without Tag Test',
      company_id: existingCompany.id,
      service_type_id: itService.id,
      category_id: devCategory.id,
      tag_id: null,
      modules: [],
    }),
  });
  assert.strictEqual(noTagRes.status, 400);
  assert.strictEqual(noTagRes.data.success, false);
  console.log('PASS: Development without Tag rejected with 400.');

  // 4b. Maintenance with Tag -> must fail 400
  const maintWithTagRes = await request('/api/estimates', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Maintenance With Tag Test',
      company_id: existingCompany.id,
      service_type_id: itService.id,
      category_id: maintCategory.id,
      tag_id: initialTag.id,
      modules: [],
    }),
  });
  assert.strictEqual(maintWithTagRes.status, 400);
  assert.strictEqual(maintWithTagRes.data.success, false);
  console.log('PASS: Maintenance with Tag rejected with 400.');

  // 4c. Reserved DIGITAL service -> must fail 400
  const digitalRes = await request('/api/estimates', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Digital Service Test',
      company_id: existingCompany.id,
      service_type_id: digitalService.id,
      category_id: devCategory.id,
      tag_id: initialTag.id,
      modules: [],
    }),
  });
  assert.strictEqual(digitalRes.status, 400);
  assert.strictEqual(digitalRes.data.success, false);
  console.log('PASS: Reserved DIGITAL service type rejected with 400.');

  // 5. Test Estimate Creation & Rate Snapshot persistence
  console.log('\n5. Testing Estimate Creation with Default Rate Snapshot...');
  const createEst1 = await request('/api/estimates', {
    method: 'POST',
    body: JSON.stringify({
      title: 'E2E Verified Estimate - Standard Rates',
      company_id: existingCompany.id,
      service_type_id: itService.id,
      category_id: devCategory.id,
      tag_id: initialTag.id,
      notes: 'QA E2E test estimate with standard spreadsheet rates',
      modules: [
        {
          name: 'Core Module',
          tasks: [
            {
              name: 'Feature A',
              hours_pm: 2,
              hours_web_dev: 10,
              hours_ui_ux: 4,
              hours_qc_doc: 2,
              hours_dev_ops: 2,
            },
          ],
        },
      ],
    }),
  });
  assert.strictEqual(createEst1.status, 201);
  assert.strictEqual(createEst1.data.success, true);
  const est1Id = createEst1.data.estimate.id;

  const getEst1 = await request(`/api/estimates/${est1Id}`);
  assert.strictEqual(getEst1.status, 200);
  assert.strictEqual(getEst1.data.success, true);
  const e1 = getEst1.data.estimate;
  assert.strictEqual(e1.company_id, existingCompany.id);
  assert.strictEqual(e1.service_type_code, 'IT');
  assert.strictEqual(e1.category_code, 'DEVELOPMENT');
  assert.strictEqual(e1.tag_code, 'INITIAL');
  assert.strictEqual(e1.rate_snapshots.PM, 39602);
  assert.strictEqual(e1.rate_snapshots.WEB_DEV, 39602);
  assert.strictEqual(e1.rate_snapshots.UI_UX, 33113);
  assert.strictEqual(e1.rate_snapshots.QC_DOC, 33101);
  assert.strictEqual(e1.rate_snapshots.DEV_OPS, 43760);
  assert.strictEqual(Number(e1.total_hours), 20);
  assert.strictEqual(Number(e1.total_cost), 761398);
  console.log(`PASS: Estimate ${est1Id} rate snapshots & total verified: 20h, Rp ${e1.total_cost}`);

  // 6. Test Estimate Creation with Custom Snapshot Rates for New Company
  console.log('\n6. Testing Estimate Creation with Custom Snapshot Rates for New Company...');
  const customRates = {
    PM: 50000,
    WEB_DEV: 45000,
    UI_UX: 40000,
    QC_DOC: 35000,
    DEV_OPS: 55000,
  };
  const createEst2 = await request('/api/estimates', {
    method: 'POST',
    body: JSON.stringify({
      title: 'E2E Verified Estimate - Custom Rates',
      company_id: newCompany.id,
      service_type_id: itService.id,
      category_id: devCategory.id,
      tag_id: crTag.id,
      notes: 'QA E2E test estimate with custom snapshot rates',
      custom_rates: customRates,
      modules: [
        {
          name: 'Custom Module',
          tasks: [
            {
              name: 'Custom Task',
              hours_pm: 10,
              hours_web_dev: 20,
              hours_ui_ux: 5,
              hours_qc_doc: 5,
              hours_dev_ops: 2,
            },
          ],
        },
      ],
    }),
  });
  assert.strictEqual(createEst2.status, 201);
  assert.strictEqual(createEst2.data.success, true);
  const est2Id = createEst2.data.estimate.id;

  const getEst2 = await request(`/api/estimates/${est2Id}`);
  assert.strictEqual(getEst2.status, 200);
  const e2 = getEst2.data.estimate;
  assert.strictEqual(e2.company_id, newCompany.id);
  assert.strictEqual(e2.tag_code, 'CR');
  assert.strictEqual(e2.rate_snapshots.PM, 50000);
  assert.strictEqual(e2.rate_snapshots.WEB_DEV, 45000);
  assert.strictEqual(e2.rate_snapshots.UI_UX, 40000);
  assert.strictEqual(e2.rate_snapshots.QC_DOC, 35000);
  assert.strictEqual(e2.rate_snapshots.DEV_OPS, 55000);
  assert.strictEqual(Number(e2.total_hours), 42);
  assert.strictEqual(Number(e2.total_cost), 1885000);
  console.log(`PASS: Estimate ${est2Id} custom rate snapshots & total verified: 42h, Rp ${e2.total_cost}`);

  // 7. Test Maintenance Estimate Creation
  console.log('\n7. Testing Maintenance Estimate Creation (No Tag)...');
  const createEst3 = await request('/api/estimates', {
    method: 'POST',
    body: JSON.stringify({
      title: 'E2E Maintenance Estimate',
      company_id: existingCompany.id,
      service_type_id: itService.id,
      category_id: maintCategory.id,
      tag_id: null,
      notes: 'QA E2E maintenance estimate',
      modules: [
        {
          name: 'Maintenance Pack',
          tasks: [
            {
              name: 'Monthly Maintenance',
              hours_pm: 2,
              hours_web_dev: 8,
              hours_ui_ux: 0,
              hours_qc_doc: 2,
              hours_dev_ops: 0,
            },
          ],
        },
      ],
    }),
  });
  assert.strictEqual(createEst3.status, 201);
  const est3Id = createEst3.data.estimate.id;

  const getEst3 = await request(`/api/estimates/${est3Id}`);
  assert.strictEqual(getEst3.status, 200);
  const e3 = getEst3.data.estimate;
  assert.strictEqual(e3.category_code, 'MAINTENANCE');
  assert.strictEqual(e3.tag_id, null);
  assert.strictEqual(Number(e3.total_hours), 12);
  assert.strictEqual(Number(e3.total_cost), 462222);
  console.log(`PASS: Maintenance estimate ${est3Id} verified: 12h, Rp ${e3.total_cost}, tag is null.`);

  console.log('\n=== ALL E2E FLOW CHECKS PASSED SUCCESSFULLY ===');
}

run().catch((err) => {
  console.error('E2E Verification Failed:', err);
  process.exit(1);
});
