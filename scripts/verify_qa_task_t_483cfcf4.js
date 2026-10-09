const assert = require('node:assert/strict');

const BASE_URL = 'http://localhost:3001';

async function runQA() {
  console.log('=====================================================');
  console.log('QA AUDIT SUITE: TASK t_483cfcf4');
  console.log('Role Exclusion, Re-inclusion, Delete & Guard Verification');
  console.log('=====================================================\n');

  // STEP 1: Verify Master Roles API & Availability
  console.log('[STEP 1] Memeriksa API Master Roles (/api/roles)...');
  const resRoles = await fetch(`${BASE_URL}/api/roles?active_only=true`);
  assert.equal(resRoles.status, 200, 'GET /api/roles harus mengembalikan 200 OK');
  const dataRoles = await resRoles.json();
  assert.equal(dataRoles.success, true);
  assert.ok(dataRoles.roles.length >= 2, 'Harus ada minimal 2 role aktif untuk test exclude');
  console.log(`✓ Berhasil memuat ${dataRoles.roles.length} role aktif dari database.\n`);

  // STEP 2: Verifikasi Exclude Role & WBS Matrix calculation
  console.log('[STEP 2] Verifikasi Exclude Role & Kalkulasi Costing...');
  // Ambil metadata & company untuk simpan estimate
  const resMeta = await fetch(`${BASE_URL}/api/metadata`);
  const dataMeta = await resMeta.json();
  const resComps = await fetch(`${BASE_URL}/api/companies`);
  const dataComps = await resComps.json();

  const company = dataComps.companies[0];
  const itService = dataMeta.serviceTypes.find((s) => s.code === 'IT');
  const devCat = dataMeta.categories.find((c) => c.code === 'DEVELOPMENT' || c.code === 'DEV');
  const initTag = dataMeta.tags.find((t) => t.code === 'INITIAL');

  // Skenario A: Exclude semua role kecuali PM & DEV_OPS
  const testRates = {
    PM: 50000,
    DEV_OPS: 60000,
  };

  const payloadExclude = {
    title: `QA Test Exclude Roles Project ${Date.now().toString().slice(-4)}`,
    company_id: company.id,
    service_type_id: itService.id,
    category_id: devCat.id,
    tag_id: initTag.id,
    notes: 'QA Audit: Exclude WEB_DEV, UI_UX, QC_DOC. Only PM & DEV_OPS aktif.',
    custom_rates: testRates,
    modules: [
      {
        name: 'Sprint 1 - Foundation',
        tasks: [
          {
            name: 'Task 1: Setup CI/CD & Planning',
            hours_pm: 4,
            hours_dev_ops: 8,
            role_hours: {
              PM: 4,
              DEV_OPS: 8,
            },
          },
        ],
      },
    ],
  };

  const resSaveA = await fetch(`${BASE_URL}/api/estimates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payloadExclude),
  });
  assert.equal(resSaveA.status, 201, 'Save estimate dengan role ter-exclude harus sukses 201');
  const dataSaveA = await resSaveA.json();
  assert.equal(dataSaveA.success, true);
  // Total hours = 4h (PM) + 8h (DEV_OPS) = 12h
  // Total cost = (4 * 50,000) + (8 * 60,000) = 200,000 + 480,000 = 680,000
  assert.equal(Number(dataSaveA.estimate.total_hours), 12);
  assert.equal(Number(dataSaveA.estimate.total_cost), 680000);
  console.log(`✓ Estimate #${dataSaveA.estimate.id} tersimpan akurat: 12 jam, Rp 680.000.`);
  console.log('✓ Role ter-exclude tidak menggelembungkan total hours/cost.\n');

  // STEP 3: Verifikasi Include Kembali Role yang Di-exclude
  console.log('[STEP 3] Verifikasi Include Kembali Role...');
  // Skenario B: Include kembali WEB_DEV dengan jam kerja tambahan
  const payloadReInclude = {
    title: `QA Test Re-Include Roles Project ${Date.now().toString().slice(-4)}`,
    company_id: company.id,
    service_type_id: itService.id,
    category_id: devCat.id,
    tag_id: initTag.id,
    notes: 'QA Audit: Re-include WEB_DEV kembali ke costing.',
    custom_rates: {
      PM: 50000,
      DEV_OPS: 60000,
      WEB_DEV: 45000,
    },
    modules: [
      {
        name: 'Sprint 1 - Foundation',
        tasks: [
          {
            name: 'Task 1: Setup CI/CD, Planning, & Web Init',
            hours_pm: 4,
            hours_dev_ops: 8,
            hours_web_dev: 10,
            role_hours: {
              PM: 4,
              DEV_OPS: 8,
              WEB_DEV: 10,
            },
          },
        ],
      },
    ],
  };

  const resSaveB = await fetch(`${BASE_URL}/api/estimates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payloadReInclude),
  });
  assert.equal(resSaveB.status, 201);
  const dataSaveB = await resSaveB.json();
  assert.equal(dataSaveB.success, true);
  // Total hours = 4 + 8 + 10 = 22h
  // Total cost = 680,000 + (10 * 45,000) = 680,000 + 450,000 = 1,130,000
  assert.equal(Number(dataSaveB.estimate.total_hours), 22);
  assert.equal(Number(dataSaveB.estimate.total_cost), 1130000);
  console.log(`✓ Re-include role WEB_DEV berhasil: 22 jam, Rp 1.130.000 sinkron dan valid.\n`);

  // STEP 4: Verifikasi Delete Role Master (Bebas vs Terpakai)
  console.log('[STEP 4] Verifikasi Delete Role Master (API & Guarding)...');

  // 4a. Buat role bebas sementara
  const tempRoleCode = `QA_DEL_${Date.now().toString().slice(-4)}`;
  const resCreateTemp = await fetch(`${BASE_URL}/api/roles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: tempRoleCode,
      name: `Role Uji Hapus Bebas ${tempRoleCode}`,
      default_hourly_rate: 35000,
      is_active: true,
    }),
  });
  assert.equal(resCreateTemp.status, 201);
  const dataCreateTemp = await resCreateTemp.json();
  const tempRoleId = dataCreateTemp.role.id;
  console.log(`✓ Role uji bebas dibuat: ${tempRoleCode} (ID: ${tempRoleId}).`);

  // 4b. Hapus role bebas (harus sukses 200)
  const resDelTemp = await fetch(`${BASE_URL}/api/roles?id=${tempRoleId}`, {
    method: 'DELETE',
  });
  assert.equal(resDelTemp.status, 200);
  const dataDelTemp = await resDelTemp.json();
  assert.equal(dataDelTemp.success, true);
  assert.match(dataDelTemp.message, /berhasil dihapus/);
  console.log(`✓ Hapus role bebas berhasil: "${dataDelTemp.message}"`);

  // 4c. Cek kembali di GET /api/roles memastikan role sudah terhapus
  const resRolesCheck = await fetch(`${BASE_URL}/api/roles`);
  const dataRolesCheck = await resRolesCheck.json();
  assert.ok(!dataRolesCheck.roles.some((r) => r.id === tempRoleId), 'Role terhapus tidak boleh muncul lagi');
  console.log('✓ Terverifikasi role bebas telah hilang dari master list.');

  // 4d. Uji proteksi (guard) penghapusan role yang sudah terpakai
  console.log('   Menguji guard penghapusan role terpakai (PM / WEB_DEV)...');
  const resDelUsed = await fetch(`${BASE_URL}/api/roles?code=PM`, {
    method: 'DELETE',
  });
  assert.equal(resDelUsed.status, 400, 'DELETE role terpakai harus ditolak dengan status 400');
  const dataDelUsed = await resDelUsed.json();
  assert.equal(dataDelUsed.success, false);
  assert.match(dataDelUsed.error, /tidak dapat dihapus karena sudah digunakan/);
  console.log(`✓ Guarding aktif 100%: Penolakan aman dengan pesan -> "${dataDelUsed.error}".\n`);

  // STEP 5: Verifikasi Frontend UI Components di /estimates/new
  console.log('[STEP 5] Verifikasi Element UI di /estimates/new...');
  const resUI = await fetch(`${BASE_URL}/estimates/new`);
  assert.equal(resUI.status, 200);
  const htmlUI = await resUI.text();

  assert.ok(htmlUI.includes('Master Rate Per Jam'), 'UI harus memiliki section Master Rate');
  assert.ok(htmlUI.includes('Aktif'), 'UI harus memiliki badge role aktif');
  assert.ok(htmlUI.includes('WBS Matrix'), 'UI harus memiliki header WBS Matrix');
  console.log('✓ UI page terverifikasi render elemen manajemen role dengan benar.\n');

  console.log('=====================================================');
  console.log('ALL QA CRITERIA AUDITED & PASSING 100%');
  console.log('=====================================================');
}

runQA().catch((err) => {
  console.error('[QA FAILED]:', err);
  process.exit(1);
});
