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

async function runQAAudit() {
  console.log('===============================================================');
  console.log('       QA AUDIT: DELETE HISTORICAL ESTIMATE & REFRESH METRICS  ');
  console.log('===============================================================\n');

  // --------------------------------------------------------------------------
  // TEST SECTION 1: DELETE /api/estimates/[id] & CASCADE DATABASE VERIFICATION
  // --------------------------------------------------------------------------
  console.log('[SECTION 1] API & Cascade Database Verification');

  // 1.1 Validasi format ID tidak valid (400)
  const invalidCases = ['abc', '0', '-5', 'NaN', 'null'];
  for (const inv of invalidCases) {
    const res = await fetch(`${BASE_URL}/api/estimates/${inv}`, { method: 'DELETE' });
    const json = await res.json();
    assert(res.status === 400 || res.status === 404, `Input '${inv}' harus return 400 atau 404, got: ${res.status}`);
    assert.strictEqual(json.success, false);
  }
  console.log('  ✓ 1.1 Input ID invalid ditolak dengan response error yang benar');

  // 1.2 Non-existent ID (404)
  const notFoundRes = await fetch(`${BASE_URL}/api/estimates/99999999`, { method: 'DELETE' });
  const notFoundJson = await notFoundRes.json();
  assert.strictEqual(notFoundRes.status, 404, 'ID non-existent harus return 404');
  assert.strictEqual(notFoundJson.success, false);
  console.log('  ✓ 1.2 ID non-existent return 404 Not Found');

  // 1.3 Create multi-module, multi-task estimate for cascade verification
  const auditEstimate = {
    title: 'QA Audit Cascade Test - ' + Date.now(),
    company_id: 1,
    service_type_id: 1,
    category_id: 1,
    tag_id: 1,
    custom_rates: { PM: 39602, WEB_DEV: 39602, UI_UX: 33113, QC_DOC: 33101, DEV_OPS: 43760 },
    notes: 'Estimasi khusus verifikasi audit cascade dan metric recalculation',
    modules: [
      {
        name: 'Modul Arsitektur & Core',
        order_index: 0,
        tasks: [
          { name: 'Schema DB & Migrations', order_index: 0, hours_pm: 4, hours_web_dev: 12, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 6 },
          { name: 'Backend API Service', order_index: 1, hours_pm: 2, hours_web_dev: 16, hours_ui_ux: 0, hours_qc_doc: 4, hours_dev_ops: 2 },
        ],
      },
      {
        name: 'Modul User Interface & QA',
        order_index: 1,
        tasks: [
          { name: 'Dashboard Component', order_index: 0, hours_pm: 0, hours_web_dev: 10, hours_ui_ux: 8, hours_qc_doc: 2, hours_dev_ops: 0 },
          { name: 'End-to-End Testing', order_index: 1, hours_pm: 2, hours_web_dev: 4, hours_ui_ux: 0, hours_qc_doc: 8, hours_dev_ops: 2 },
        ],
      },
    ],
  };

  const createRes = await fetch(`${BASE_URL}/api/estimates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(auditEstimate),
  });
  const createJson = await createRes.json();
  assert.strictEqual(createRes.status, 201, 'Pembuatan estimasi harus return status 201');
  const targetId = createJson.estimate.id;
  const targetCost = parseFloat(createJson.estimate.total_cost);
  const targetHours = parseFloat(createJson.estimate.total_hours);
  console.log(`  ✓ 1.3 Estimasi #${targetId} berhasil dibuat (Biaya: Rp ${targetCost.toLocaleString('id-ID')}, Jam: ${targetHours})`);

  // 1.4 Verifikasi eksistensi record di database
  const dbEst = await pool.query('SELECT id, title, total_cost, total_hours FROM project_estimates WHERE id = $1', [targetId]);
  const dbMods = await pool.query('SELECT id, name FROM estimate_modules WHERE estimate_id = $1 ORDER BY order_index ASC', [targetId]);
  assert.strictEqual(dbEst.rows.length, 1);
  assert.strictEqual(dbMods.rows.length, 2);
  const modIds = dbMods.rows.map((m) => m.id);
  const dbTasks = await pool.query('SELECT id, name, module_id FROM estimate_tasks WHERE module_id = ANY($1::int[])', [modIds]);
  assert.strictEqual(dbTasks.rows.length, 4);
  console.log(`  ✓ 1.4 Database terverifikasi: 1 estimate, 2 modules, 4 tasks`);

  // 1.5 Eksekusi DELETE /api/estimates/:id
  const delRes = await fetch(`${BASE_URL}/api/estimates/${targetId}`, { method: 'DELETE' });
  const delJson = await delRes.json();
  assert.strictEqual(delRes.status, 200, 'DELETE harus return status 200');
  assert.strictEqual(delJson.success, true);
  console.log(`  ✓ 1.5 DELETE /api/estimates/${targetId} berhasil (${delJson.message})`);

  // 1.6 Verifikasi DB Cascade Clean
  const dbEstAfter = await pool.query('SELECT id FROM project_estimates WHERE id = $1', [targetId]);
  const dbModsAfter = await pool.query('SELECT id FROM estimate_modules WHERE estimate_id = $1', [targetId]);
  const dbTasksAfter = await pool.query('SELECT id FROM estimate_tasks WHERE module_id = ANY($1::int[])', [modIds]);
  assert.strictEqual(dbEstAfter.rows.length, 0, 'Record project_estimates harus terhapus bersih');
  assert.strictEqual(dbModsAfter.rows.length, 0, 'Record estimate_modules harus terhapus bersih (CASCADE)');
  assert.strictEqual(dbTasksAfter.rows.length, 0, 'Record estimate_tasks harus terhapus bersih (CASCADE)');
  console.log('  ✓ 1.6 DB Cascade terverifikasi bersih: 0 estimate, 0 modules, 0 tasks tersisa');

  // 1.7 Verifikasi GET & DELETE ulang setelah dihapus
  const getAfter = await fetch(`${BASE_URL}/api/estimates/${targetId}`);
  assert.strictEqual(getAfter.status, 404, 'GET estimasi terhapus harus return 404');
  const delAgain = await fetch(`${BASE_URL}/api/estimates/${targetId}`, { method: 'DELETE' });
  assert.strictEqual(delAgain.status, 404, 'DELETE ulang estimasi terhapus harus return 404');
  console.log('  ✓ 1.7 GET dan DELETE berikutnya return 404');

  // --------------------------------------------------------------------------
  // TEST SECTION 2: UI CODE VERIFICATION & CONFIRMATION FLOW
  // --------------------------------------------------------------------------
  console.log('\n[SECTION 2] UI Code Verification & Confirmation Modal Flow');

  const pageFile = path.join(__dirname, '../src/app/page.tsx');
  const pageSrc = fs.readFileSync(pageFile, 'utf-8');

  // 2.1 Table Row Delete Button
  assert(pageSrc.includes('🗑️ Hapus'), 'Tabel harus memiliki tombol Hapus');
  assert(pageSrc.includes('setDeleteTarget(est)'), 'Tombol tabel harus memanggil setDeleteTarget');
  console.log('  ✓ 2.1 Tombol hapus pada setiap baris tabel terverifikasi');

  // 2.2 Modal Inspect Detail Delete Button
  assert(pageSrc.includes('🗑️ Hapus Estimasi'), 'Modal inspect harus memiliki tombol Hapus Estimasi');
  assert(pageSrc.includes('setDeleteTarget(inspectDetail)'), 'Tombol inspect modal harus memanggil setDeleteTarget');
  console.log('  ✓ 2.2 Tombol hapus di modal inspect detail terverifikasi');

  // 2.3 Confirmation Dialog Component
  assert(pageSrc.includes('Konfirmasi Hapus Estimasi'), 'Judul modal konfirmasi hapus harus ada');
  assert(pageSrc.includes('Seluruh modul dan task pada estimasi ini akan dihapus secara permanen'), 'Peringatan cascade harus ada di modal');
  assert(pageSrc.includes('handleDeleteEstimate'), 'Action handler handleDeleteEstimate terverifikasi');
  assert(pageSrc.includes('isDeleting'), 'Loading state isDeleting terverifikasi');
  assert(pageSrc.includes('deleteError'), 'Error message state deleteError terverifikasi');
  console.log('  ✓ 2.3 Dialog modal konfirmasi & state handling terverifikasi lengkap');

  // 2.4 Toast Notification & Instant UI Refresh
  assert(pageSrc.includes('setEstimates((prev) => prev.filter((e) => e.id !== targetId))'), 'State update instan tanpa reload halaman');
  assert(pageSrc.includes('showToast('), 'Pemanggilan toast notification terverifikasi');
  assert(pageSrc.includes('toastMessage'), 'Toast message rendering terverifikasi');
  console.log('  ✓ 2.4 State update instan & toast feedback terverifikasi');

  // --------------------------------------------------------------------------
  // TEST SECTION 3: AUTOMATIC SUMMARY METRIC CARDS RECALCULATION
  // --------------------------------------------------------------------------
  console.log('\n[SECTION 3] Automatic Summary Metric Cards Recalculation');

  // 3.1 Verifikasi binding metrics di UI
  assert(pageSrc.includes('metrics.totalCount'), 'Metric card Total Estimasi terikat ke metrics.totalCount');
  assert(pageSrc.includes('formatIDR(metrics.totalCost)'), 'Metric card Total Nilai terikat ke metrics.totalCost');
  assert(pageSrc.includes('formatIDR(metrics.avgCost)'), 'Metric card Rata-rata terikat ke metrics.avgCost');
  assert(pageSrc.includes('metrics.totalHours'), 'Metric card Total Jam Kerja terikat ke metrics.totalHours');
  console.log('  ✓ 3.1 Komponen 4 kartu metrik dashboard terikat langsung ke state metrics dinamis');

  // 3.2 Simulasi Kalkulasi Metrik (sebelum add, sesudah add, sesudah delete)
  const initialEstRes = await fetch(`${BASE_URL}/api/estimates`);
  const initialEstData = await initialEstRes.json();
  const initialList = initialEstData.estimates;

  function calcMetrics(list) {
    const totalCount = list.length;
    const totalCost = list.reduce((sum, est) => sum + (parseFloat(String(est.total_cost)) || 0), 0);
    const totalHours = list.reduce((sum, est) => sum + (parseFloat(String(est.total_hours)) || 0), 0);
    const avgCost = totalCount > 0 ? totalCost / totalCount : 0;
    return { totalCount, totalCost, avgCost, totalHours };
  }

  const initialMetrics = calcMetrics(initialList);
  console.log(`  ✓ 3.2 Metrik Baseline: ${initialMetrics.totalCount} estimasi | Total: Rp ${initialMetrics.totalCost.toLocaleString('id-ID')} | Jam: ${initialMetrics.totalHours}`);

  // Buat estimasi baru untuk melihat metrik bertambah
  const simRes = await fetch(`${BASE_URL}/api/estimates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'QA Metrics Dynamic Shift Test',
      company_id: 1,
      service_type_id: 1,
      category_id: 1,
      tag_id: 1,
      custom_rates: { PM: 39602, WEB_DEV: 39602, UI_UX: 33113, QC_DOC: 33101, DEV_OPS: 43760 },
      notes: 'Testing dynamic metric shift',
      modules: [
        {
          name: 'Modul Metrik',
          order_index: 0,
          tasks: [
            { name: 'Task Metrik', order_index: 0, hours_pm: 10, hours_web_dev: 10, hours_ui_ux: 10, hours_qc_doc: 10, hours_dev_ops: 10 },
          ],
        },
      ],
    }),
  });
  const simData = await simRes.json();
  const addedId = simData.estimate.id;
  const addedCost = parseFloat(simData.estimate.total_cost);
  const addedHours = parseFloat(simData.estimate.total_hours);

  // Ambil list baru
  const afterAddRes = await fetch(`${BASE_URL}/api/estimates`);
  const afterAddData = await afterAddRes.json();
  const metricsAfterAdd = calcMetrics(afterAddData.estimates);

  assert.strictEqual(metricsAfterAdd.totalCount, initialMetrics.totalCount + 1);
  assert.strictEqual(metricsAfterAdd.totalHours, initialMetrics.totalHours + addedHours);
  assert(Math.abs(metricsAfterAdd.totalCost - (initialMetrics.totalCost + addedCost)) < 0.01);
  console.log(`  ✓ 3.3 Metrik setelah penambahan: ${metricsAfterAdd.totalCount} estimasi (+1) | Total bertambah Rp ${addedCost.toLocaleString('id-ID')}`);

  // Hapus estimasi via DELETE
  const simDelRes = await fetch(`${BASE_URL}/api/estimates/${addedId}`, { method: 'DELETE' });
  assert.strictEqual(simDelRes.status, 200);

  // Ambil list setelah delete
  const afterDelRes = await fetch(`${BASE_URL}/api/estimates`);
  const afterDelData = await afterDelRes.json();
  const metricsAfterDel = calcMetrics(afterDelData.estimates);

  assert.strictEqual(metricsAfterDel.totalCount, initialMetrics.totalCount);
  assert.strictEqual(metricsAfterDel.totalHours, initialMetrics.totalHours);
  assert(Math.abs(metricsAfterDel.totalCost - initialMetrics.totalCost) < 0.01);
  assert(Math.abs(metricsAfterDel.avgCost - initialMetrics.avgCost) < 0.01);
  console.log(`  ✓ 3.4 Metrik setelah penghapusan: kembali presisi ke baseline (${metricsAfterDel.totalCount} estimasi, Rp ${metricsAfterDel.totalCost.toLocaleString('id-ID')})`);

  console.log('\n===============================================================');
  console.log('       QA AUDIT SELESAI: SEMUA KRITERIA TERVERIFIKASI LULUS!   ');
  console.log('===============================================================');

  await pool.end();
}

runQAAudit().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
