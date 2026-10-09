const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const BASE_URL = 'http://localhost:3001';

let databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  try {
    const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('DATABASE_URL=')) {
        databaseUrl = trimmed.substring('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
        break;
      }
    }
  } catch (err) {
    console.warn('Could not read .env file:', err.message);
  }
}

const pool = new Pool({
  connectionString: databaseUrl || 'postgresql://postgres:postgres@localhost:5432/busdevcore',
});

async function run() {
  console.log('===============================================================');
  console.log('QA VERIFIKASI: PEMISAHAN WBS MATRIX & FULL RATE SNAPSHOT');
  console.log('===============================================================\n');

  // Load basic reference data from DB
  const compRes = await pool.query('SELECT id, name FROM companies LIMIT 1');
  assert(compRes.rows.length > 0, 'Harus ada data company di database');
  const companyId = compRes.rows[0].id;

  const stRes = await pool.query("SELECT id, code FROM service_types WHERE code = 'IT'");
  assert(stRes.rows.length > 0, 'Service type IT harus ada');
  const serviceTypeId = stRes.rows[0].id;

  const catRes = await pool.query("SELECT id, code, name FROM categories WHERE service_type_id = $1", [serviceTypeId]);
  const catMap = {};
  catRes.rows.forEach(c => { catMap[c.code] = c.id; });
  assert(catMap.DEVELOPMENT, 'Kategori DEVELOPMENT harus ada');
  assert(catMap.MAINTENANCE, 'Kategori MAINTENANCE harus ada');
  assert(catMap.INFRASTRUCTURE, 'Kategori INFRASTRUCTURE harus ada');

  const tagRes = await pool.query("SELECT id, code FROM tags WHERE code = 'INITIAL'");
  assert(tagRes.rows.length > 0, 'Tag INITIAL harus ada');
  const tagInitialId = tagRes.rows[0].id;

  const createdEstimateIds = [];

  try {
    // -------------------------------------------------------------------------
    // TEST 1: FULL SNAPSHOT (Nama Role + Kode + Rate tersimpan di snapshot;
    // hapus role master tidak merusak detail historis)
    // -------------------------------------------------------------------------
    console.log('TEST 1: Verifikasi Full Snapshot & Isolasi Histori...');
    const testRoleCode = `QA_ROLE_${Date.now().toString().slice(-4)}`;
    const testRoleName = 'QA Independent Specialist';
    const testRoleRate = 52500;

    // 1a. Insert new role in role_masters
    await pool.query(
      `INSERT INTO role_masters (code, name, default_hourly_rate, is_active) VALUES ($1, $2, $3, true)`,
      [testRoleCode, testRoleName, testRoleRate]
    );
    console.log(`   ✓ Role master baru dibuat: ${testRoleName} (${testRoleCode}) @ Rp ${testRoleRate}`);

    // 1b. Create estimate with this role
    const snapEstPayload = {
      title: `QA Snapshot Test ${Date.now()}`,
      company_id: companyId,
      service_type_id: serviceTypeId,
      category_ids: [catMap.DEVELOPMENT],
      tag_id: tagInitialId,
      custom_rates: {
        [testRoleCode]: testRoleRate,
        PM: 40000,
      },
      modules: [
        {
          name: 'Core Module',
          tasks: [
            {
              name: 'Snapshot Task',
              role_hours: {
                [testRoleCode]: 10,
                PM: 5,
              },
            },
          ],
        },
      ],
    };

    const snapCreateRes = await fetch(`${BASE_URL}/api/estimates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapEstPayload),
    });
    const snapCreateData = await snapCreateRes.json();
    assert(snapCreateData.success === true, `Create snapshot estimate failed: ${snapCreateData.error}`);
    const snapEstId = snapCreateData.estimate.id;
    createdEstimateIds.push(snapEstId);
    console.log(`   ✓ Estimate #${snapEstId} berhasil dibuat`);

    // 1c. Inspect estimate before role deletion
    const snapGet1Res = await fetch(`${BASE_URL}/api/estimates/${snapEstId}`);
    const snapGet1Data = await snapGet1Res.json();
    assert(snapGet1Data.success === true, 'GET estimate detail harus sukses');
    const snap1Obj = snapGet1Data.estimate.rate_snapshots;
    assert(snap1Obj[testRoleCode], `Role ${testRoleCode} harus ada di rate_snapshots`);
    assert.strictEqual(snap1Obj[testRoleCode].name, testRoleName, 'Nama role di snapshot harus tersimpan lengkap');
    assert.strictEqual(snap1Obj[testRoleCode].code, testRoleCode, 'Kode role di snapshot harus tersimpan');
    assert.strictEqual(Number(snap1Obj[testRoleCode].rate), testRoleRate, 'Rate role di snapshot harus tersimpan');
    console.log(`   ✓ Full Snapshot terverifikasi di JSON: code="${snap1Obj[testRoleCode].code}", name="${snap1Obj[testRoleCode].name}", rate=${snap1Obj[testRoleCode].rate}`);

    // 1d. Hapus role master langsung dari database (simulasi master role deleted)
    await pool.query('DELETE FROM role_masters WHERE code = $1', [testRoleCode]);
    console.log(`   ✓ Master role ${testRoleCode} dihapus permanen dari tabel role_masters`);

    // 1e. Verifikasi detail historis estimate tetap utuh dan valid
    const snapGet2Res = await fetch(`${BASE_URL}/api/estimates/${snapEstId}`);
    const snapGet2Data = await snapGet2Res.json();
    assert(snapGet2Data.success === true, 'GET estimate harus tetap sukses setelah role master dihapus');
    const snap2Obj = snapGet2Data.estimate.rate_snapshots;
    assert(snap2Obj[testRoleCode], `Role ${testRoleCode} harus tetap ada di rate_snapshots historis`);
    assert.strictEqual(snap2Obj[testRoleCode].name, testRoleName, 'Nama role historis harus tetap utuh');
    assert.strictEqual(Number(snap2Obj[testRoleCode].rate), testRoleRate, 'Rate role historis harus tetap utuh');
    const taskCostExpected = 10 * testRoleRate + 5 * 40000; // 525000 + 200000 = 725000
    assert.strictEqual(Number(snapGet2Data.estimate.total_cost), taskCostExpected, `Total cost historis harus tetap Rp ${taskCostExpected}`);
    console.log(`   ✓ Histori detail estimate #${snapEstId} terbukti 100% independen dari tabel master role.`);

    // -------------------------------------------------------------------------
    // TEST 2: VERIFIKASI WBS DEVELOPMENT (Matrix kalkulasi one-time akurat)
    // -------------------------------------------------------------------------
    console.log('\nTEST 2: Verifikasi WBS Development (One-Time Matrix Calculation)...');
    const devPayload = {
      title: `QA Dev Matrix Test ${Date.now()}`,
      company_id: companyId,
      service_type_id: serviceTypeId,
      category_ids: [catMap.DEVELOPMENT],
      tag_id: tagInitialId,
      custom_rates: {
        PM: 39602,
        WEB_DEV: 39602,
        UI_UX: 33113,
        QC_DOC: 33101,
        DEV_OPS: 43760,
      },
      modules: [
        {
          name: 'Modul Frontend & Backend',
          tasks: [
            {
              name: 'Arsitektur & API',
              hours_pm: 12,
              hours_web_dev: 40,
              hours_ui_ux: 16,
              hours_qc_doc: 8,
              hours_dev_ops: 8,
            },
            {
              name: 'Testing & Deploy',
              hours_pm: 4,
              hours_web_dev: 16,
              hours_ui_ux: 0,
              hours_qc_doc: 12,
              hours_dev_ops: 8,
            },
          ],
        },
      ],
    };

    const devCreateRes = await fetch(`${BASE_URL}/api/estimates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(devPayload),
    });
    const devCreateData = await devCreateRes.json();
    assert(devCreateData.success === true, `Create Dev estimate failed: ${devCreateData.error}`);
    const devEstId = devCreateData.estimate.id;
    createdEstimateIds.push(devEstId);

    // Verify Dev calculation accuracy
    // Task 1: 12*39602 (475224) + 40*39602 (1584080) + 16*33113 (529808) + 8*33101 (264808) + 8*43760 (350080) = 3204000
    // Task 2: 4*39602 (158408) + 16*39602 (633632) + 0 + 12*33101 (397212) + 8*43760 (350080) = 1539332
    // Total Hours: (12+40+16+8+8) + (4+16+0+12+8) = 84 + 40 = 124 jam
    // Total Cost: 3204000 + 1539332 = 4743332
    const expDevHours = 124;
    const expDevCost = 4743332;

    const devGetRes = await fetch(`${BASE_URL}/api/estimates/${devEstId}`);
    const devGetData = await devGetRes.json();
    const devEst = devGetData.estimate;
    assert.strictEqual(Number(devEst.total_hours), expDevHours, `Total hours Dev harus ${expDevHours}`);
    assert.strictEqual(Number(devEst.total_cost), expDevCost, `Total cost Dev harus Rp ${expDevCost}`);
    assert(devEst.billing_summary, 'Billing summary harus ada pada response Dev');
    assert.strictEqual(Number(devEst.billing_summary.one_time_dev), expDevCost, 'one_time_dev harus presisi');
    assert.strictEqual(Number(devEst.billing_summary.total_one_time), expDevCost, 'total_one_time harus presisi');
    assert.strictEqual(Number(devEst.billing_summary.monthly_maintenance), 0, 'monthly_maintenance harus 0');
    assert.strictEqual(Number(devEst.billing_summary.recurring_infra), 0, 'recurring_infra harus 0');
    assert.strictEqual(Number(devEst.billing_summary.grand_total), expDevCost, 'grand_total harus sama dengan one-time dev');
    console.log(`   ✓ WBS Development kalkulasi akurat: ${devEst.total_hours} jam, Rp ${devEst.total_cost} (One-Time: Rp ${devEst.billing_summary.total_one_time})`);

    // -------------------------------------------------------------------------
    // TEST 3: VERIFIKASI WBS MAINTENANCE (Monthly rate & Total kontrak akurat)
    // -------------------------------------------------------------------------
    console.log('\nTEST 3: Verifikasi WBS Maintenance (Monthly Rate x Durasi Bulan)...');
    const maintDuration = 6;
    const maintPayload = {
      title: `QA Maintenance Test ${Date.now()}`,
      company_id: companyId,
      service_type_id: serviceTypeId,
      category_ids: [catMap.MAINTENANCE],
      // No tag allowed for Maintenance
      maintenance_config: {
        duration_months: maintDuration,
        tasks: [
          {
            name: 'Pemeliharaan Server & Security Patching',
            hours_dev_ops: 10,
            hours_qc_doc: 4,
          },
          {
            name: 'Bug Fixing & Monitoring SLA',
            hours_web_dev: 15,
            hours_pm: 5,
          },
        ],
      },
    };

    const maintCreateRes = await fetch(`${BASE_URL}/api/estimates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(maintPayload),
    });
    const maintCreateData = await maintCreateRes.json();
    assert(maintCreateData.success === true, `Create Maint estimate failed: ${maintCreateData.error}`);
    const maintEstId = maintCreateData.estimate.id;
    createdEstimateIds.push(maintEstId);

    // Maintenance calculation check:
    // Rates default: DEV_OPS = 43760, QC_DOC = 33101, WEB_DEV = 39602, PM = 39602
    // Task 1 monthly: 10*43760 (437600) + 4*33101 (132404) = 570004
    // Task 2 monthly: 15*39602 (594030) + 5*39602 (198010) = 792040
    // Total monthly cost: 570004 + 792040 = 1362044
    // Monthly hours: (10 + 4) + (15 + 5) = 34 jam / bulan
    // Total contract cost: 1362044 * 6 = 8172264
    // Total hours over contract: 34 * 6 = 204 jam
    const expMonthlyMaintCost = 1362044;
    const expTotalMaintCost = 8172264;
    const expMaintHours = 204;

    const maintGetRes = await fetch(`${BASE_URL}/api/estimates/${maintEstId}`);
    const maintGetData = await maintGetRes.json();
    const maintEst = maintGetData.estimate;
    assert.strictEqual(Number(maintEst.total_cost), expTotalMaintCost, `Total contract cost Maintenance harus Rp ${expTotalMaintCost}`);
    assert.strictEqual(Number(maintEst.total_hours), expMaintHours, `Total hours Maintenance (6 bulan) harus ${expMaintHours}`);
    assert(maintEst.maintenance_config, 'maintenance_config harus tersimpan');
    assert.strictEqual(Number(maintEst.maintenance_config.duration_months), maintDuration, 'duration_months harus 6');
    assert.strictEqual(Number(maintEst.maintenance_config.monthly_cost), expMonthlyMaintCost, `Monthly cost harus Rp ${expMonthlyMaintCost}`);
    assert.strictEqual(Number(maintEst.maintenance_config.total_cost), expTotalMaintCost, `Total cost harus Rp ${expTotalMaintCost}`);
    assert.strictEqual(Number(maintEst.billing_summary.monthly_maintenance), expMonthlyMaintCost, 'billing_summary.monthly_maintenance harus presisi');
    assert.strictEqual(Number(maintEst.billing_summary.total_maintenance), expTotalMaintCost, 'billing_summary.total_maintenance harus presisi');
    assert.strictEqual(Number(maintEst.billing_summary.total_one_time), 0, 'total_one_time harus 0');
    console.log(`   ✓ WBS Maintenance kalkulasi akurat: Rp ${maintEst.maintenance_config.monthly_cost}/bln x ${maintDuration} bln = Total Kontrak Rp ${maintEst.total_cost}`);

    // Also verify rule: Maintenance with Tag must be rejected
    const invalidTagMaint = await fetch(`${BASE_URL}/api/estimates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...maintPayload,
        title: 'Should Fail Maint with Tag',
        tag_id: tagInitialId,
      }),
    });
    const invalidTagMaintData = await invalidTagMaint.json();
    assert(invalidTagMaintData.success === false, 'Maintenance dengan Tag harus ditolak');
    console.log('   ✓ Rule terverifikasi: Maintenance dengan Tag berhasil ditolak');

    // -------------------------------------------------------------------------
    // TEST 4: VERIFIKASI WBS INFRASTRUCTURE (Setup One-Time & Recurring Presisi)
    // -------------------------------------------------------------------------
    console.log('\nTEST 4: Verifikasi WBS Infrastructure (One-Time Setup vs Monthly/Yearly Recurring)...');
    const infraPayload = {
      title: `QA Infrastructure Test ${Date.now()}`,
      company_id: companyId,
      service_type_id: serviceTypeId,
      category_ids: [catMap.INFRASTRUCTURE],
      infrastructure_items: [
        {
          name: 'Mikrotik RB4011 & Instalasi Jaringan',
          billing_type: 'ONE_TIME',
          quantity: 2,
          unit_cost: 3500000,
          period_count: 1,
          notes: 'Hardware + jasa pasang',
        },
        {
          name: 'Cloud VPS Production (4 vCPU / 8 GB RAM)',
          billing_type: 'MONTHLY',
          quantity: 3,
          unit_cost: 450000,
          period_count: 12,
          notes: 'Alokasi 12 bulan',
        },
        {
          name: 'Domain .co.id Corporate',
          billing_type: 'YEARLY',
          quantity: 2,
          unit_cost: 300000,
          period_count: 2,
          notes: 'Pendaftaran 2 tahun',
        },
      ],
    };

    const infraCreateRes = await fetch(`${BASE_URL}/api/estimates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(infraPayload),
    });
    const infraCreateData = await infraCreateRes.json();
    assert(infraCreateData.success === true, `Create Infra estimate failed: ${infraCreateData.error}`);
    const infraEstId = infraCreateData.estimate.id;
    createdEstimateIds.push(infraEstId);

    // Infra calculation check:
    // Item 1 (ONE_TIME): 2 * 3500000 = 7000000
    // Item 2 (MONTHLY): 3 * 450000 * 12 = 16200000 (Monthly recurring = 3 * 450000 = 1350000)
    // Item 3 (YEARLY): 2 * 300000 * 2 = 1200000 (Monthly recurring = (2 * 300000 * 2) / (12 * 2) = 50000)
    // One-Time subtotal = 7000000
    // Recurring subtotal = 16200000 + 1200000 = 17400000
    // Monthly recurring subtotal = 1350000 + 50000 = 1400000
    // Grand Total Infra = 7000000 + 17400000 = 24400000
    const expInfraOneTime = 7000000;
    const expInfraRecurring = 17400000;
    const expInfraMonthlyRecurring = 1400000;
    const expInfraGrandTotal = 24400000;

    const infraGetRes = await fetch(`${BASE_URL}/api/estimates/${infraEstId}`);
    const infraGetData = await infraGetRes.json();
    const infraEst = infraGetData.estimate;
    assert.strictEqual(Number(infraEst.total_cost), expInfraGrandTotal, `Total cost Infra harus Rp ${expInfraGrandTotal}`);
    assert(Array.isArray(infraEst.infrastructure_items), 'infrastructure_items harus berupa array');
    assert.strictEqual(infraEst.infrastructure_items.length, 3, 'Harus ada 3 infrastructure items');

    const bInfra = infraEst.billing_summary;
    assert.strictEqual(Number(bInfra.one_time_infra), expInfraOneTime, 'one_time_infra harus Rp 7.000.000');
    assert.strictEqual(Number(bInfra.total_one_time), expInfraOneTime, 'total_one_time harus Rp 7.000.000');
    assert.strictEqual(Number(bInfra.recurring_infra), expInfraRecurring, 'recurring_infra harus Rp 17.400.000');
    assert.strictEqual(Number(bInfra.monthly_infra), expInfraMonthlyRecurring, 'monthly_infra harus Rp 1.400.000');
    assert.strictEqual(Number(bInfra.total_monthly_recurring), expInfraMonthlyRecurring, 'total_monthly_recurring harus Rp 1.400.000');
    assert.strictEqual(Number(bInfra.grand_total), expInfraGrandTotal, 'grand_total harus Rp 24.400.000');
    console.log(`   ✓ WBS Infrastructure kalkulasi presisi: One-time Rp ${bInfra.one_time_infra}, Recurring Rp ${bInfra.recurring_infra} (Rp ${bInfra.monthly_infra}/bln), Grand Total Rp ${bInfra.grand_total}`);

    // -------------------------------------------------------------------------
    // TEST 5: VERIFIKASI KOMBINASI MULTI-KATEGORI & RINGKASAN MULTI-BILLING
    // -------------------------------------------------------------------------
    console.log('\nTEST 5: Verifikasi Kombinasi Multi-Kategori & Ringkasan Multi-Billing...');
    const multiPayload = {
      title: `QA Multi-Category Full Contract ${Date.now()}`,
      company_id: companyId,
      service_type_id: serviceTypeId,
      category_ids: [catMap.DEVELOPMENT, catMap.MAINTENANCE, catMap.INFRASTRUCTURE],
      tag_id: tagInitialId, // Dev included, so tag required
      modules: [
        {
          name: 'Portal Enterprise',
          tasks: [
            {
              name: 'Core System Development',
              hours_pm: 10,
              hours_web_dev: 30,
            },
          ],
        },
      ],
      maintenance_config: {
        duration_months: 12,
        tasks: [
          {
            name: 'Managed SLA Support',
            hours_web_dev: 10,
            hours_dev_ops: 5,
          },
        ],
      },
      infrastructure_items: [
        {
          name: 'Instalasi & Konfigurasi Server Awal',
          billing_type: 'ONE_TIME',
          quantity: 1,
          unit_cost: 2500000,
        },
        {
          name: 'Dedicated Cloud Server',
          billing_type: 'MONTHLY',
          quantity: 1,
          unit_cost: 1500000,
          period_count: 12,
        },
      ],
    };

    const multiCreateRes = await fetch(`${BASE_URL}/api/estimates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(multiPayload),
    });
    const multiCreateData = await multiCreateRes.json();
    assert(multiCreateData.success === true, `Create Multi-category estimate failed: ${multiCreateData.error}`);
    const multiEstId = multiCreateData.estimate.id;
    createdEstimateIds.push(multiEstId);

    // Multi-category breakdown calculation:
    // 1. Dev: 10*39602 + 30*39602 = 40 * 39602 = 1584080 (one_time_dev)
    // 2. Infra One-Time: 1 * 2500000 = 2500000 (one_time_infra)
    // -> Total One-Time = 1584080 + 2500000 = 4084080
    // 3. Maint Monthly: 10*39602 + 5*43760 = 396020 + 218800 = 614820/bln
    // -> Total Maint Kontrak (12 bln) = 614820 * 12 = 7377840
    // 4. Infra Recurring: 1 * 1500000 * 12 = 18000000 (monthly = 1500000/bln)
    // -> Total Monthly Recurring = 614820 + 1500000 = 2114820/bln
    // 5. Grand Total = Total One-Time (4084080) + Total Maint (7377840) + Recurring Infra (18000000) = 29461920
    const expOneTimeDev = 1584080;
    const expOneTimeInfra = 2500000;
    const expTotalOneTime = 4084080;
    const expMonthlyMaint = 614820;
    const expTotalMaint = 7377840;
    const expRecurringInfra = 18000000;
    const expMonthlyInfra = 1500000;
    const expTotalMonthlyRec = 2114820;
    const expGrandTotal = 29461920;

    const multiGetRes = await fetch(`${BASE_URL}/api/estimates/${multiEstId}`);
    const multiGetData = await multiGetRes.json();
    const multiEst = multiGetData.estimate;

    assert.strictEqual(Number(multiEst.total_cost), expGrandTotal, `Grand total harus Rp ${expGrandTotal}`);
    const bSummary = multiEst.billing_summary;
    assert.strictEqual(Number(bSummary.one_time_dev), expOneTimeDev, 'one_time_dev multi akurat');
    assert.strictEqual(Number(bSummary.one_time_infra), expOneTimeInfra, 'one_time_infra multi akurat');
    assert.strictEqual(Number(bSummary.total_one_time), expTotalOneTime, 'total_one_time multi akurat');
    assert.strictEqual(Number(bSummary.monthly_maintenance), expMonthlyMaint, 'monthly_maintenance multi akurat');
    assert.strictEqual(Number(bSummary.total_maintenance), expTotalMaint, 'total_maintenance multi akurat');
    assert.strictEqual(Number(bSummary.recurring_infra), expRecurringInfra, 'recurring_infra multi akurat');
    assert.strictEqual(Number(bSummary.monthly_infra), expMonthlyInfra, 'monthly_infra multi akurat');
    assert.strictEqual(Number(bSummary.total_monthly_recurring), expTotalMonthlyRec, 'total_monthly_recurring multi akurat');
    assert.strictEqual(Number(bSummary.grand_total), expGrandTotal, 'grand_total multi akurat');

    console.log(`   ✓ Multi-Billing Summary Terverifikasi:`);
    console.log(`     - Total One-Time Charge: Rp ${bSummary.total_one_time} (Dev: Rp ${bSummary.one_time_dev} + Infra Setup: Rp ${bSummary.one_time_infra})`);
    console.log(`     - Total Recurring / Bulan: Rp ${bSummary.total_monthly_recurring}/bln (Maint: Rp ${bSummary.monthly_maintenance}/bln + Infra: Rp ${bSummary.monthly_infra}/bln)`);
    console.log(`     - Total Maintenance Kontrak: Rp ${bSummary.total_maintenance}`);
    console.log(`     - Grand Total Kontrak: Rp ${bSummary.grand_total}`);

    // Verify GET /api/estimates list contains categories and billing_summary
    const listRes = await fetch(`${BASE_URL}/api/estimates`);
    const listData = await listRes.json();
    assert(listData.success === true, 'GET /api/estimates list harus sukses');
    const targetInList = listData.estimates.find(e => e.id === multiEstId);
    assert(targetInList, 'Estimate multi-kategori harus ada di list');
    assert.strictEqual(targetInList.categories.length, 3, 'Harus memiliki 3 kategori di list');
    assert(targetInList.billing_summary, 'billing_summary harus ada di list');
    console.log(`   ✓ Listing /api/estimates memuat 3 kategori dan billing_summary dengan tepat`);

    // Verify UI pages render without 500 error
    const uiHomeRes = await fetch(`${BASE_URL}/`);
    assert(uiHomeRes.status === 200, 'Halaman dashboard / harus HTTP 200');
    const uiNewRes = await fetch(`${BASE_URL}/estimates/new`);
    assert(uiNewRes.status === 200, 'Halaman form /estimates/new harus HTTP 200');
    console.log('   ✓ Halaman Dashboard (/) dan Form (/estimates/new) berhasil dirender (HTTP 200)');

  } finally {
    // Clean up created test estimates
    console.log('\nMembersihkan data pengujian...');
    for (const estId of createdEstimateIds) {
      await fetch(`${BASE_URL}/api/estimates/${estId}`, { method: 'DELETE' });
    }
    console.log(`✓ ${createdEstimateIds.length} data test estimates dibersihkan.`);
    await pool.end();
  }

  console.log('\n===============================================================');
  console.log('SEMUA 5 KRITERIA VERIFIKASI FUNGSIONAL LULUS 100%!');
  console.log('===============================================================');
}

run().catch((err) => {
  console.error('\n❌ VERIFIKASI GAGAL:', err);
  process.exit(1);
});
