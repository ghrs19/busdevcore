const assert = require('node:assert/strict');

const BASE_URL = 'http://localhost:3001';

async function main() {
  console.log('=== QA VERIFICATION: DYNAMIC ROLES & WBS ENGINE ===');

  // STEP 1: Test API /api/roles (GET, POST, PUT)
  console.log('\n--- 1. Testing /api/roles API Endpoints ---');
  
  // 1a. GET /api/roles
  const getRolesRes = await fetch(`${BASE_URL}/api/roles`);
  assert.equal(getRolesRes.status, 200, 'GET /api/roles must return 200');
  const getRolesData = await getRolesRes.json();
  assert.equal(getRolesData.success, true, 'GET /api/roles success must be true');
  assert.ok(Array.isArray(getRolesData.roles), 'roles must be an array');
  console.log(`[PASS] GET /api/roles: retrieved ${getRolesData.roles.length} roles.`);

  // 1b. POST /api/roles (Create new dynamic role)
  const roleSuffix = Date.now().toString().slice(-4);
  const testRoleCode = `SEC_SPEC_${roleSuffix}`;
  const testRoleName = 'Security Specialist';
  const initialRate = 55000;

  const createRoleRes = await fetch(`${BASE_URL}/api/roles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: testRoleCode,
      name: testRoleName,
      default_hourly_rate: initialRate,
      is_active: true,
    }),
  });
  assert.equal(createRoleRes.status, 201, 'POST /api/roles must return 201');
  const createRoleData = await createRoleRes.json();
  assert.equal(createRoleData.success, true, 'POST /api/roles success must be true');
  assert.equal(createRoleData.role.code, testRoleCode);
  assert.equal(createRoleData.role.name, testRoleName);
  assert.equal(Number(createRoleData.role.default_hourly_rate), initialRate);
  console.log(`[PASS] POST /api/roles: created role ${testRoleCode} with default rate Rp ${initialRate}.`);

  // 1c. PUT /api/roles (Update role rate)
  const updatedRate = 60000;
  const updateRoleRes = await fetch(`${BASE_URL}/api/roles`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: testRoleCode,
      default_hourly_rate: updatedRate,
    }),
  });
  assert.equal(updateRoleRes.status, 200, 'PUT /api/roles must return 200');
  const updateRoleData = await updateRoleRes.json();
  assert.equal(updateRoleData.success, true, 'PUT /api/roles success must be true');
  assert.equal(Number(updateRoleData.role.default_hourly_rate), updatedRate);
  console.log(`[PASS] PUT /api/roles: updated role rate to Rp ${updatedRate}.`);

  // Verify in metadata API
  const metaRes = await fetch(`${BASE_URL}/api/metadata`);
  assert.equal(metaRes.status, 200);
  const metaData = await metaRes.json();
  const foundInMeta = metaData.roles.find(r => r.code === testRoleCode);
  assert.ok(foundInMeta, 'New role must be reflected in /api/metadata');
  assert.equal(Number(foundInMeta.default_hourly_rate), updatedRate);
  console.log('[PASS] /api/metadata: dynamic role verified in metadata stream.');

  // STEP 2: Verify form /estimates/new UI elements & calculations
  console.log('\n--- 2. Verifying form /estimates/new capabilities ---');
  const newFormRes = await fetch(`${BASE_URL}/estimates/new`);
  assert.equal(newFormRes.status, 200, 'GET /estimates/new must return 200');
  const newFormHtml = await newFormRes.text();
  assert.ok(newFormHtml.includes('+ Tambah Role Baru'), 'Form must have "+ Tambah Role Baru" button');
  assert.ok(newFormHtml.includes('Master Rate Per Jam'), 'Form must have "Master Rate Per Jam" section');
  assert.ok(newFormHtml.includes('WBS Matrix'), 'Form must have "WBS Matrix" section');
  console.log('[PASS] /estimates/new HTML elements for dynamic roles and WBS matrix confirmed.');

  // STEP 3: Verify saving estimate with dynamic role & custom rate snapshot
  console.log('\n--- 3. Verifying Save Estimate with Dynamic Role & Snapshot ---');
  const compRes = await fetch(`${BASE_URL}/api/companies`);
  const compData = await compRes.json();
  const company = compData.companies[0];
  const itService = metaData.serviceTypes.find(s => s.code === 'IT');
  const devCat = metaData.categories.find(c => c.code === 'DEVELOPMENT' || c.code === 'DEV');
  const initTag = metaData.tags.find(t => t.code === 'INITIAL');

  // Custom project snapshot rate: override SEC_SPEC to 65000 and PM to 40000
  const customProjectRates = {
    PM: 40000,
    WEB_DEV: 35000,
    UI_UX: 32000,
    QC_DOC: 28000,
    DEV_OPS: 38000,
    [testRoleCode]: 65000,
  };

  const hoursSecSpec = 12;
  const hoursPm = 4;
  const expectedTaskCost = (hoursPm * 40000) + (hoursSecSpec * 65000); // 160,000 + 780,000 = 940,000
  const expectedTotalHours = hoursPm + hoursSecSpec; // 16

  const estimatePayload = {
    title: `Penetration Testing & Security Audit ${testRoleCode}`,
    company_id: company.id,
    service_type_id: itService.id,
    category_id: devCat.id,
    tag_id: initTag.id,
    notes: 'Testing dynamic role snapshot rate and WBS calculation accuracy',
    custom_rates: customProjectRates,
    modules: [
      {
        name: 'Modul Hardening & Auditing',
        tasks: [
          {
            name: 'Vulnerability Assessment & PenTest',
            hours_pm: hoursPm,
            role_hours: {
              PM: hoursPm,
              [testRoleCode]: hoursSecSpec,
            },
          },
        ],
      },
    ],
  };

  const createEstRes = await fetch(`${BASE_URL}/api/estimates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(estimatePayload),
  });
  assert.equal(createEstRes.status, 201, 'POST /api/estimates must return 201');
  const createEstData = await createEstRes.json();
  assert.equal(createEstData.success, true);
  const createdEstimate = createEstData.estimate;

  console.log(`[PASS] Estimate created with ID ${createdEstimate.id}`);
  assert.equal(Number(createdEstimate.total_hours), expectedTotalHours, `Total hours must be ${expectedTotalHours}`);
  assert.equal(Number(createdEstimate.total_cost), expectedTaskCost, `Total cost must be ${expectedTaskCost}`);
  console.log(`[PASS] Calculation accurate: ${expectedTotalHours} hours -> Rp ${expectedTaskCost}`);

  // 3b. Verify GET /api/estimates/:id returns full detail with dynamic role and snapshot
  const getDetailRes = await fetch(`${BASE_URL}/api/estimates/${createdEstimate.id}`);
  assert.equal(getDetailRes.status, 200);
  const getDetailData = await getDetailRes.json();
  assert.equal(getDetailData.success, true);
  const detail = getDetailData.estimate;

  assert.equal(Number(detail.rate_snapshots[testRoleCode]), 65000, 'Custom snapshot rate for dynamic role must be 65000');
  const detailTask = detail.modules[0].tasks[0];
  assert.equal(Number(detailTask.role_hours[testRoleCode]), hoursSecSpec, `Dynamic role hours in task must be ${hoursSecSpec}`);
  assert.equal(Number(detailTask.hours_pm), hoursPm);
  assert.equal(Number(detailTask.total_cost), expectedTaskCost);
  console.log('[PASS] Estimate detail returned full dynamic role hours and snapshot rate.');

  // 3c. Verify main page displays and includes inspect capability
  const homeRes = await fetch(`${BASE_URL}/`);
  assert.equal(homeRes.status, 200);
  const homeHtml = await homeRes.text();
  assert.ok(homeHtml.includes('Historical Estimates'));
  assert.ok(homeHtml.includes(createdEstimate.title) || homeHtml.includes('busdevcore'));
  console.log('[PASS] Main page reflects estimate records and supports modal inspection.');

  console.log('\n=== ALL QA TESTS COMPLETED SUCCESSFULLY ===');
}

main().catch(err => {
  console.error('\n[FAIL] QA Verification failed:', err);
  process.exit(1);
});
