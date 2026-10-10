const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const BASE_URL = 'http://localhost:3001';

let databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('DATABASE_URL=')) {
      databaseUrl = trimmed.substring('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
      break;
    }
  }
}
const pool = new Pool({ connectionString: databaseUrl });

function parseCookie(setCookieHeader) {
  if (!setCookieHeader) return '';
  return setCookieHeader.split(';')[0];
}

async function loginUser(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.strictEqual(res.status, 200, `Login failed for ${email}`);
  const setCookie = res.headers.get('set-cookie');
  assert(setCookie && setCookie.includes('busdev_session='), 'Session cookie missing');
  return parseCookie(setCookie);
}

async function run() {
  console.log('=== TEST SUITE: QA Audit Trail Dokumen & RBAC (Admin vs Staff) ===\n');

  // STEP 1: Verify Initial Admin & Create Staff User
  console.log('--- 1. Setup & Authenticate Admin and Staff ---');
  const adminCookie = await loginUser('admin@gherdev.com', 'admin123');
  console.log('  ✓ Admin successfully logged in');

  const meAdminRes = await fetch(`${BASE_URL}/api/auth/me`, { headers: { Cookie: adminCookie } });
  const meAdminJson = await meAdminRes.json();
  const adminUser = meAdminJson.user;
  assert.strictEqual(adminUser.role, 'admin', 'Default user must be admin');
  console.log(`  ✓ Current admin user verified: ${adminUser.name} (${adminUser.email}), Role: ${adminUser.role}`);

  // Create or reset QA staff user
  const staffEmail = 'qa_staff_test@gherdev.com';
  const staffPass = 'staff12345';
  await pool.query('DELETE FROM users WHERE email = $1', [staffEmail]);

  const createStaffRes = await fetch(`${BASE_URL}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({
      name: 'QA Staff Tester',
      email: staffEmail,
      password: staffPass,
      role: 'staff',
    }),
  });
  assert.strictEqual(createStaffRes.status, 201, 'Admin must be able to create staff user');
  const createStaffJson = await createStaffRes.json();
  const staffUser = createStaffJson.user;
  assert.strictEqual(staffUser.role, 'staff', 'User role must be staff');
  console.log(`  ✓ Staff user created: ${staffUser.name} (${staffUser.email}), ID: ${staffUser.id}, Role: ${staffUser.role}`);

  const staffCookie = await loginUser(staffEmail, staffPass);
  const meStaffRes = await fetch(`${BASE_URL}/api/auth/me`, { headers: { Cookie: staffCookie } });
  const meStaffJson = await meStaffRes.json();
  assert.strictEqual(meStaffJson.user.role, 'staff', 'Staff session must report staff role');
  console.log('  ✓ Staff successfully logged in and verified via /api/auth/me');

  // STEP 2: RBAC Route & Module Protection Verification
  console.log('\n--- 2. RBAC Verification (Admin vs Staff Permissions) ---');

  // 2.1 Route /master access
  const adminMasterRoute = await fetch(`${BASE_URL}/master`, { headers: { Cookie: adminCookie }, redirect: 'manual' });
  assert.strictEqual(adminMasterRoute.status, 200, 'Admin must have access to /master page (200)');
  console.log('  ✓ Admin can access /master (Status 200)');

  const staffMasterRoute = await fetch(`${BASE_URL}/master`, { headers: { Cookie: staffCookie }, redirect: 'manual' });
  assert(staffMasterRoute.status === 307 || staffMasterRoute.status === 308 || staffMasterRoute.status === 302, 'Staff must be redirected from /master');
  const redirectLoc = staffMasterRoute.headers.get('location');
  assert(redirectLoc && redirectLoc.includes('restricted=1'), `Staff redirect location must contain restricted=1, got ${redirectLoc}`);
  console.log(`  ✓ Staff blocked from /master via middleware redirect: ${redirectLoc} (Status ${staffMasterRoute.status})`);

  // 2.2 API /api/users access
  const staffUsersGet = await fetch(`${BASE_URL}/api/users`, { headers: { Cookie: staffCookie } });
  assert.strictEqual(staffUsersGet.status, 403, 'Staff must be forbidden (403) from GET /api/users');
  console.log('  ✓ Staff blocked from GET /api/users with 403 Forbidden');

  const staffUsersPost = await fetch(`${BASE_URL}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: staffCookie },
    body: JSON.stringify({ name: 'Hacker', email: 'hacker@test.com', password: '123', role: 'admin' }),
  });
  assert.strictEqual(staffUsersPost.status, 403, 'Staff must be forbidden (403) from POST /api/users');
  console.log('  ✓ Staff blocked from POST /api/users with 403 Forbidden');

  // 2.3 API /api/roles mutation access
  const staffRoleCreate = await fetch(`${BASE_URL}/api/roles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: staffCookie },
    body: JSON.stringify({ code: 'STAFF_ROLE', name: 'Staff Role', default_hourly_rate: 10000 }),
  });
  assert.strictEqual(staffRoleCreate.status, 403, 'Staff must be forbidden (403) from POST /api/roles');
  console.log('  ✓ Staff blocked from POST /api/roles with 403 Forbidden');

  // 2.4 API /api/templates mutation access
  const staffTemplateCreate = await fetch(`${BASE_URL}/api/templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: staffCookie },
    body: JSON.stringify({ name: 'Staff Temp', category: 'DEVELOPMENT', payload: {} }),
  });
  assert.strictEqual(staffTemplateCreate.status, 403, 'Staff must be forbidden (403) from POST /api/templates');
  console.log('  ✓ Staff blocked from POST /api/templates with 403 Forbidden');

  // 2.5 Staff can read master roles for creating costing
  const staffRolesRead = await fetch(`${BASE_URL}/api/roles?active_only=true`, { headers: { Cookie: staffCookie } });
  assert.strictEqual(staffRolesRead.status, 200, 'Staff must be able to read active roles');
  const staffRolesData = await staffRolesRead.json();
  assert(Array.isArray(staffRolesData.roles) && staffRolesData.roles.length > 0, 'Roles list must be non-empty');
  console.log(`  ✓ Staff can read active master roles (Count: ${staffRolesData.roles.length})`);

  // STEP 3: Document Creation Audit Trail Attribution (Staff)
  console.log('\n--- 3. Document Creation Audit Trail Attribution ---');

  // Get metadata for creating estimate
  const metaRes = await fetch(`${BASE_URL}/api/metadata`);
  const meta = await metaRes.json();
  const companyId = meta.companies[0].id;
  const devService = meta.serviceTypes.find(s => s.code === 'APPLICATION') || meta.serviceTypes[0];
  const devCategory = meta.categories.find(c => c.code === 'DEVELOPMENT' && c.service_type_id === devService.id) || meta.categories[0];
  const webTag = meta.tags.find(t => t.code === 'WEB') || meta.tags[0];

  const postEstPayload = {
    company_id: companyId,
    service_type_id: devService.id,
    category_id: devCategory.id,
    category_ids: [devCategory.id],
    tag_id: webTag.id,
    title: 'QA Audit Trail Test Project (Staff Created)',
    notes: 'Testing audit trail attribution and RBAC',
    modules: [
      {
        name: 'Modul Autentikasi',
        tasks: [
          { name: 'Implementasi Login Audit', role_hours: { PM: 4, WEB_DEV: 16 } }
        ]
      }
    ]
  };

  const createEstRes = await fetch(`${BASE_URL}/api/estimates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: staffCookie },
    body: JSON.stringify(postEstPayload),
  });
  assert(createEstRes.status === 200 || createEstRes.status === 201, `Staff should be allowed to create estimates, got ${createEstRes.status}`);
  const createEstJson = await createEstRes.json();
  const estimateId = createEstJson.estimate.id;
  console.log(`  ✓ Estimate created by Staff with ID #${estimateId}`);

  // Fetch created estimate detail via GET /api/estimates/[id]
  const estDetailRes = await fetch(`${BASE_URL}/api/estimates/${estimateId}`, { headers: { Cookie: staffCookie } });
  assert.strictEqual(estDetailRes.status, 200, 'GET /api/estimates/[id] must return 200');
  const estDetailJson = await estDetailRes.json();
  const createdEst = estDetailJson.estimate;

  assert.strictEqual(createdEst.created_by_user_id, staffUser.id, 'created_by_user_id must match staff user ID');
  assert.strictEqual(createdEst.updated_by_user_id, staffUser.id, 'updated_by_user_id must match staff user ID on creation');
  assert.strictEqual(createdEst.creator_name, staffUser.name, 'creator_name must match staff user name');
  assert.strictEqual(createdEst.creator_email, staffUser.email, 'creator_email must match staff user email');
  assert.strictEqual(createdEst.updater_name, staffUser.name, 'updater_name must match staff user name');
  console.log(`  ✓ Initial creation attribution confirmed: Creator=${createdEst.creator_name} (${createdEst.creator_email})`);

  // Verify dashboard list /api/estimates carries creator info
  const listEstRes = await fetch(`${BASE_URL}/api/estimates`, { headers: { Cookie: staffCookie } });
  const listEstJson = await listEstRes.json();
  const foundInList = listEstJson.estimates.find(e => e.id === estimateId);
  assert(foundInList, 'Created estimate must appear in /api/estimates list');
  assert.strictEqual(foundInList.creator_name, staffUser.name, 'Creator name must be populated in /api/estimates');
  assert.strictEqual(foundInList.creator_email, staffUser.email, 'Creator email must be populated in /api/estimates');
  console.log(`  ✓ Dashboard estimate list correctly includes creator attribution: ${foundInList.creator_name}`);

  // STEP 4: Document Update / Revision Audit Trail Attribution (Admin Updates Staff Doc)
  console.log('\n--- 4. Document Update / Revision Attribution (Admin Revision of Staff Doc) ---');

  // Admin edits and creates revision (v2) of staff's estimate
  const updatePayload = {
    title: 'QA Audit Trail Test Project (Admin Revised)',
    revision_notes: 'Revisi review dan persetujuan oleh Admin',
    create_revision_on_save: true,
    modules: [
      {
        name: 'Modul Autentikasi',
        tasks: [
          { name: 'Implementasi Login Audit', role_hours: { PM: 4, WEB_DEV: 20, QC_DOC: 8 } }
        ]
      }
    ]
  };

  const updateEstRes = await fetch(`${BASE_URL}/api/estimates/${estimateId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify(updatePayload),
  });
  assert.strictEqual(updateEstRes.status, 200, 'Admin must be able to update estimate');
  const updateEstJson = await updateEstRes.json();
  const revisedEstimateId = updateEstJson.estimate_id;
  console.log(`  ✓ Revision created by Admin with ID #${revisedEstimateId}, Version: v${updateEstJson.version}`);

  // Fetch updated estimate detail
  const revisedDetailRes = await fetch(`${BASE_URL}/api/estimates/${revisedEstimateId}`, { headers: { Cookie: adminCookie } });
  const revisedDetailJson = await revisedDetailRes.json();
  const revisedEst = revisedDetailJson.estimate;

  // Verify attribution for v2
  assert.strictEqual(revisedEst.created_by_user_id, adminUser.id, 'Revision v2 creator must be Admin');
  assert.strictEqual(revisedEst.creator_name, adminUser.name, 'Revision creator name must be Admin name');
  assert.strictEqual(revisedEst.creator_email, adminUser.email, 'Revision creator email must be Admin email');
  assert.strictEqual(revisedEst.updater_name, adminUser.name, 'Revision updater name must be Admin name');
  console.log(`  ✓ Revision v2 attribution verified: Created & Revised by Admin (${revisedEst.creator_name})`);

  // Verify Version History Chain shows both versions with accurate individual creator attribution
  assert(Array.isArray(revisedEst.version_history), 'version_history must be present');
  assert.strictEqual(revisedEst.version_history.length, 2, 'Version history must have 2 versions');

  const historyV1 = revisedEst.version_history.find(v => v.version === 1);
  const historyV2 = revisedEst.version_history.find(v => v.version === 2);
  assert(historyV1 && historyV2, 'Both v1 and v2 must exist in version history');

  assert.strictEqual(historyV1.creator_name, staffUser.name, 'v1 history creator must be Staff');
  assert.strictEqual(historyV1.creator_email, staffUser.email, 'v1 history email must be Staff email');
  assert.strictEqual(historyV2.creator_name, adminUser.name, 'v2 history creator must be Admin');
  assert.strictEqual(historyV2.creator_email, adminUser.email, 'v2 history email must be Admin email');
  console.log(`  ✓ Version history audit trail chain confirmed:`);
  console.log(`      - v1 (#${historyV1.id}): Created by ${historyV1.creator_name} (${historyV1.creator_email})`);
  console.log(`      - v2 (#${historyV2.id}): Created by ${historyV2.creator_name} (${historyV2.creator_email})`);

  // STEP 5: Fork / Create Revision Endpoint Attribution
  console.log('\n--- 5. Fork / Branch Revision Endpoint Attribution ---');
  const forkRes = await fetch(`${BASE_URL}/api/estimates/${historyV1.id}/fork`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: staffCookie },
    body: JSON.stringify({ revision_notes: 'Staff branching revision' }),
  });
  assert.strictEqual(forkRes.status, 200, 'POST /fork must return 200');
  const forkJson = await forkRes.json();
  const forkedId = forkJson.new_estimate_id;
  console.log(`  ✓ Forked revision created with ID #${forkedId}, version v${forkJson.version}`);

  const forkedDetailRes = await fetch(`${BASE_URL}/api/estimates/${forkedId}`, { headers: { Cookie: staffCookie } });
  const forkedDetail = (await forkedDetailRes.json()).estimate;
  assert.strictEqual(forkedDetail.created_by_user_id, staffUser.id, 'Fork creator must match staff ID');
  assert.strictEqual(forkedDetail.creator_name, staffUser.name, 'Fork creator name must match staff name');
  console.log(`  ✓ Fork audit trail verified: Created by ${forkedDetail.creator_name}`);

  // Cleanup test records
  console.log('\n--- 6. Cleanup QA Test Records ---');
  await pool.query('DELETE FROM project_estimates WHERE id IN ($1, $2, $3) OR parent_id IN ($1, $2, $3)', [estimateId, revisedEstimateId, forkedId]);
  await pool.query('DELETE FROM users WHERE email = $1', [staffEmail]);
  console.log('  ✓ Test estimates and QA staff user cleaned up successfully');

  console.log('\n========================================================================');
  console.log('ALL QA AUDIT TRAIL & RBAC (ADMIN VS STAFF) CHECKS PASSED 100%');
  console.log('========================================================================\n');
}

run()
  .catch(err => {
    console.error('QA Test Suite Failed:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
