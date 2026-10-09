const assert = require('node:assert/strict');

const BASE_URL = 'http://localhost:3001';

async function run() {
  console.log('--- E2E Test Dynamic Roles & Costing ---');

  // 1. Test GET /api/roles
  console.log('1. Testing GET /api/roles...');
  const resRoles = await fetch(`${BASE_URL}/api/roles`);
  assert.equal(resRoles.status, 200);
  const dataRoles = await resRoles.json();
  assert.equal(dataRoles.success, true);
  assert.ok(Array.isArray(dataRoles.roles));
  assert.ok(dataRoles.roles.some(r => r.code === 'PM'));
  console.log(`   Found ${dataRoles.roles.length} roles.`);

  // 2. Test POST /api/roles (create new dynamic role)
  console.log('2. Testing POST /api/roles (create QA_ENG)...');
  const uniqueCode = `QA_ENG_${Date.now().toString().slice(-4)}`;
  const resCreateRole = await fetch(`${BASE_URL}/api/roles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: uniqueCode,
      name: 'QA Automation Engineer',
      default_hourly_rate: 35000,
      is_active: true,
    }),
  });
  assert.equal(resCreateRole.status, 201);
  const dataCreateRole = await resCreateRole.json();
  assert.equal(dataCreateRole.success, true);
  assert.equal(dataCreateRole.role.code, uniqueCode);
  assert.equal(dataCreateRole.role.default_hourly_rate, 35000);
  console.log(`   Role ${uniqueCode} created successfully.`);

  // 3. Test PUT /api/roles (update role rate)
  console.log('3. Testing PUT /api/roles (update rate to 38000)...');
  const resUpdateRole = await fetch(`${BASE_URL}/api/roles`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: uniqueCode,
      default_hourly_rate: 38000,
    }),
  });
  assert.equal(resUpdateRole.status, 200);
  const dataUpdateRole = await resUpdateRole.json();
  assert.equal(dataUpdateRole.success, true);
  assert.equal(dataUpdateRole.role.default_hourly_rate, 38000);
  console.log(`   Role rate updated to ${dataUpdateRole.role.default_hourly_rate}.`);

  // 4. Test GET /api/metadata contains the new role
  console.log('4. Testing GET /api/metadata...');
  const resMeta = await fetch(`${BASE_URL}/api/metadata`);
  assert.equal(resMeta.status, 200);
  const dataMeta = await resMeta.json();
  assert.ok(dataMeta.roles.some(r => r.code === uniqueCode));
  console.log('   New role present in metadata.');

  // 5. Test create estimate with dynamic role
  console.log('5. Testing POST /api/estimates with dynamic role...');
  const resCompanies = await fetch(`${BASE_URL}/api/companies`);
  const dataCompanies = await resCompanies.json();
  const companyId = dataCompanies.companies[0].id;

  const itService = dataMeta.serviceTypes.find(s => s.code === 'IT');
  const devCategory = dataMeta.categories.find(c => c.code === 'DEVELOPMENT' || c.code === 'DEV');
  const initTag = dataMeta.tags.find(t => t.code === 'INITIAL');

  const customRates = {
    PM: 39602,
    [uniqueCode]: 40000,
  };

  const payload = {
    title: `Project Test Dynamic Role ${uniqueCode}`,
    company_id: companyId,
    service_type_id: itService.id,
    category_id: devCategory.id,
    tag_id: initTag.id,
    notes: 'Testing dynamic role costing engine',
    custom_rates: customRates,
    modules: [
      {
        name: 'Modul Core & Automation',
        tasks: [
          {
            name: 'Task 1: Setup',
            hours_pm: 2,
            role_hours: {
              PM: 2,
              [uniqueCode]: 5,
            },
          },
        ],
      },
    ],
  };

  const resEstimate = await fetch(`${BASE_URL}/api/estimates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  assert.equal(resEstimate.status, 201);
  const dataEstimate = await resEstimate.json();
  assert.equal(dataEstimate.success, true);
  const estId = dataEstimate.estimate.id;

  // Expected hours: 2 (PM) + 5 (QA) = 7
  // Expected cost: 2*39602 + 5*40000 = 79204 + 200000 = 279204
  assert.equal(Number(dataEstimate.estimate.total_hours), 7);
  assert.equal(Number(dataEstimate.estimate.total_cost), 279204);
  console.log(`   Estimate #${estId} created: ${dataEstimate.estimate.total_hours}h, Rp ${dataEstimate.estimate.total_cost}.`);

  // 6. Test GET /api/estimates/[id]
  console.log(`6. Testing GET /api/estimates/${estId}...`);
  const resGetEst = await fetch(`${BASE_URL}/api/estimates/${estId}`);
  assert.equal(resGetEst.status, 200);
  const dataGetEst = await resGetEst.json();
  assert.equal(dataGetEst.success, true);
  const savedModule = dataGetEst.estimate.modules[0];
  const savedTask = savedModule.tasks[0];
  assert.equal(savedTask.role_hours[uniqueCode], 5);
  assert.equal(Number(savedTask.hours_pm), 2);
  console.log('   Estimate detail verified with dynamic role_hours.');

  // 7. Test DELETE on used role should be rejected
  console.log(`7. Testing DELETE /api/roles for used role ${uniqueCode}...`);
  const resDelUsed = await fetch(`${BASE_URL}/api/roles?code=${uniqueCode}`, {
    method: 'DELETE',
  });
  assert.equal(resDelUsed.status, 400);
  const dataDelUsed = await resDelUsed.json();
  assert.equal(dataDelUsed.success, false);
  assert.match(dataDelUsed.error, /tidak dapat dihapus karena sudah/);
  console.log('   Rejection verified: cannot delete used role.');

  // 8. Test DELETE on unused role
  console.log('8. Testing create and delete unused role...');
  const tempCode = `TEMP_${Date.now().toString().slice(-4)}`;
  const resTemp = await fetch(`${BASE_URL}/api/roles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: tempCode,
      name: 'Temporary Role',
      default_hourly_rate: 10000,
    }),
  });
  assert.equal(resTemp.status, 201);

  const resDelTemp = await fetch(`${BASE_URL}/api/roles?code=${tempCode}`, {
    method: 'DELETE',
  });
  assert.equal(resDelTemp.status, 200);
  const dataDelTemp = await resDelTemp.json();
  assert.equal(dataDelTemp.success, true);
  console.log('   Unused role deleted successfully.');

  // 9. Verify front-end pages
  console.log('9. Testing frontend pages render...');
  const resHome = await fetch(`${BASE_URL}/`);
  assert.equal(resHome.status, 200);
  const homeHtml = await resHome.text();
  assert.ok(homeHtml.includes('busdevcore'));

  const resNew = await fetch(`${BASE_URL}/estimates/new`);
  assert.equal(resNew.status, 200);
  const newHtml = await resNew.text();
  assert.ok(newHtml.includes('Master Rate Per Jam'));
  console.log('   Frontend pages OK.');

  console.log('\n--- ALL E2E VERIFICATIONS PASSED ---');
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
