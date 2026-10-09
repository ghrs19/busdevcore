const assert = require('node:assert/strict');

const BASE_URL = 'http://localhost:3001';

async function run() {
  console.log('=== TEST SUITE: ROLE MANAGEMENT & EXCLUSION ===\n');

  // 1. Verify GET /api/roles returns active roles
  console.log('1. Testing GET /api/roles?active_only=true...');
  const resRoles = await fetch(`${BASE_URL}/api/roles?active_only=true`);
  assert.equal(resRoles.status, 200);
  const dataRoles = await resRoles.json();
  assert.equal(dataRoles.success, true);
  assert.ok(dataRoles.roles.length >= 1, 'At least 1 active role must exist');
  console.log(`   Found ${dataRoles.roles.length} active roles in master database.`);

  // 2. Test create a new unused role for delete verification
  console.log('\n2. Testing create unused role for delete test...');
  const testRoleCode = `ROLE_TEMP_${Date.now().toString().slice(-4)}`;
  const testRoleName = `Temp Test Role ${testRoleCode}`;
  const resCreate = await fetch(`${BASE_URL}/api/roles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: testRoleCode,
      name: testRoleName,
      default_hourly_rate: 45000,
      is_active: true,
    }),
  });
  assert.equal(resCreate.status, 201);
  const dataCreate = await resCreate.json();
  assert.equal(dataCreate.success, true);
  const newRoleId = dataCreate.role.id;
  console.log(`   Created unused role ${testRoleCode} (ID: ${newRoleId}).`);

  // 3. Test DELETE /api/roles?id=... for unused role
  console.log(`\n3. Testing DELETE /api/roles?id=${newRoleId} for unused role...`);
  const resDeleteUnused = await fetch(`${BASE_URL}/api/roles?id=${newRoleId}`, {
    method: 'DELETE',
  });
  assert.equal(resDeleteUnused.status, 200);
  const dataDeleteUnused = await resDeleteUnused.json();
  assert.equal(dataDeleteUnused.success, true);
  assert.match(dataDeleteUnused.message, /berhasil dihapus/);
  console.log(`   Delete successful: ${dataDeleteUnused.message}`);

  // Verify it is gone from /api/roles
  const resRolesAfter = await fetch(`${BASE_URL}/api/roles`);
  const dataRolesAfter = await resRolesAfter.json();
  assert.ok(!dataRolesAfter.roles.some((r) => r.id === newRoleId), 'Deleted role must not exist');
  console.log('   Confirmed role no longer in master list.');

  // 4. Test DELETE /api/roles?id=... on an existing used role (e.g. PM or WEB_DEV)
  console.log('\n4. Testing DELETE /api/roles?id=... on role used in historical estimate...');
  const pmRole = dataRoles.roles.find((r) => r.code === 'PM');
  assert.ok(pmRole, 'PM role must exist');
  const resDeleteUsed = await fetch(`${BASE_URL}/api/roles?id=${pmRole.id}`, {
    method: 'DELETE',
  });
  assert.equal(resDeleteUsed.status, 400);
  const dataDeleteUsed = await resDeleteUsed.json();
  assert.equal(dataDeleteUsed.success, false);
  assert.match(dataDeleteUsed.error, /tidak dapat dihapus karena sudah digunakan/);
  console.log(`   Guard confirmed: rejection message: "${dataDeleteUsed.error}"`);

  // 5. Test create estimate with excluded role logic
  console.log('\n5. Testing estimate creation when role is excluded...');
  const resMeta = await fetch(`${BASE_URL}/api/metadata`);
  const dataMeta = await resMeta.json();
  const resComps = await fetch(`${BASE_URL}/api/companies`);
  const dataComps = await resComps.json();

  const company = dataComps.companies[0];
  const itService = dataMeta.serviceTypes.find((s) => s.code === 'IT');
  const devCat = dataMeta.categories.find((c) => c.code === 'DEVELOPMENT' || c.code === 'DEV');
  const initTag = dataMeta.tags.find((t) => t.code === 'INITIAL');

  // We simulate project where only PM and WEB_DEV are active; UI_UX, QC_DOC, DEV_OPS excluded (0 hours)
  const payloadWithExcludedRoles = {
    title: `Estimate Project with Excluded Roles ${Date.now().toString().slice(-4)}`,
    company_id: company.id,
    service_type_id: itService.id,
    category_id: devCat.id,
    tag_id: initTag.id,
    notes: 'Testing exclude role: UI_UX, QC_DOC, DEV_OPS excluded from costing',
    custom_rates: {
      PM: 40000,
      WEB_DEV: 40000,
    },
    modules: [
      {
        name: 'Modul Core',
        tasks: [
          {
            name: 'Task 1: PM & Dev Only',
            hours_pm: 5,
            hours_web_dev: 10,
            hours_ui_ux: 0,
            hours_qc_doc: 0,
            hours_dev_ops: 0,
            role_hours: {
              PM: 5,
              WEB_DEV: 10,
              UI_UX: 0,
              QC_DOC: 0,
              DEV_OPS: 0,
            },
          },
        ],
      },
    ],
  };

  const resSaveEst = await fetch(`${BASE_URL}/api/estimates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payloadWithExcludedRoles),
  });
  assert.equal(resSaveEst.status, 201);
  const dataSaveEst = await resSaveEst.json();
  assert.equal(dataSaveEst.success, true);
  // Expected: 5h PM + 10h WEB_DEV = 15h. Cost: 5*40000 + 10*40000 = 600,000.
  assert.equal(Number(dataSaveEst.estimate.total_hours), 15);
  assert.equal(Number(dataSaveEst.estimate.total_cost), 600000);
  console.log(`   Estimate #${dataSaveEst.estimate.id} saved with 15h (Rp 600.000). Excluded roles accurately omitted.`);

  // 6. Test frontend /estimates/new page markup
  console.log('\n6. Testing /estimates/new HTML response...');
  const resNewPage = await fetch(`${BASE_URL}/estimates/new`);
  assert.equal(resNewPage.status, 200);
  const pageHtml = await resNewPage.text();
  assert.ok(pageHtml.includes('Master Rate Per Jam'), 'Must contain Master Rate Per Jam');
  assert.ok(pageHtml.includes('Aktif'), 'Must contain Aktif badge');
  assert.ok(pageHtml.includes('WBS Matrix'), 'Must contain WBS Matrix');
  console.log('   /estimates/new page verified.');

  console.log('\n=== ALL TESTS PASSED SUCCESSFULLY ===');
}

run().catch((err) => {
  console.error('\n[FAIL] Test failed:', err);
  process.exit(1);
});
