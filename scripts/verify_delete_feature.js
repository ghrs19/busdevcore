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

async function verify() {
  console.log('=== VERIFIKASI FITUR HAPUS HISTORICAL ESTIMATE ===\n');

  // 1. Verifikasi Kode Frontend di src/app/page.tsx
  console.log('1. Memeriksa komponen frontend (src/app/page.tsx)...');
  const pageSource = fs.readFileSync(path.join(__dirname, '../src/app/page.tsx'), 'utf-8');

  // Tombol Hapus di baris tabel
  assert(pageSource.includes('🗑️ Hapus'), 'Tabel harus memiliki tombol 🗑️ Hapus');
  assert(pageSource.includes('setDeleteTarget(est)'), 'Tombol hapus baris tabel harus men-trigger setDeleteTarget');

  // Tombol Hapus Estimasi di Modal Inspect Detail
  assert(pageSource.includes('🗑️ Hapus Estimasi'), 'Modal inspect harus memiliki tombol 🗑️ Hapus Estimasi');
  assert(pageSource.includes('setDeleteTarget(inspectDetail)'), 'Tombol hapus modal inspect harus men-trigger setDeleteTarget');

  // Modal Dialog Konfirmasi
  assert(pageSource.includes('Konfirmasi Hapus Estimasi'), 'Harus terdapat modal dialog Konfirmasi Hapus Estimasi');
  assert(pageSource.includes('handleDeleteEstimate'), 'Harus terdapat handler handleDeleteEstimate');

  // Toast Notification
  assert(pageSource.includes('toastMessage'), 'Harus terdapat state toastMessage untuk notifikasi');
  assert(pageSource.includes('showToast'), 'Harus terdapat fungsi showToast');

  // Refresh state seketika
  assert(pageSource.includes('setEstimates((prev) => prev.filter'), 'State estimates harus di-filter seketika setelah hapus');
  console.log('✓ Seluruh elemen UI dan state logic frontend terverifikasi lengkap!');

  // 2. Verifikasi API DELETE /api/estimates/[id]
  console.log('\n2. Memeriksa API DELETE /api/estimates/[id]...');
  
  // Validasi ID format tidak valid -> 400
  const invalidRes = await fetch(`${BASE_URL}/api/estimates/notanumber`, { method: 'DELETE' });
  assert.strictEqual(invalidRes.status, 400, 'ID tidak valid harus return status 400');
  const invalidJson = await invalidRes.json();
  assert.strictEqual(invalidJson.success, false);
  console.log('✓ Validasi ID non-numerik return status 400 dengan pesan error:', invalidJson.error);

  // Buat estimasi dummy untuk pengujian penghapusan
  const testEstimatePayload = {
    title: 'Estimasi Verifikasi Fitur Hapus QA-' + Math.floor(Math.random() * 10000),
    company_id: 1,
    service_type_id: 1,
    category_id: 1,
    tag_id: 1,
    custom_rates: { PM: 39602, WEB_DEV: 39602, UI_UX: 33113, QC_DOC: 33101, DEV_OPS: 43760 },
    notes: 'Catatan uji hapus dan cascade',
    modules: [
      {
        name: 'Modul Frontend & Backend',
        order_index: 0,
        tasks: [
          { name: 'Setup DB', order_index: 0, hours_pm: 2, hours_web_dev: 8, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 2 },
          { name: 'Testing', order_index: 1, hours_pm: 1, hours_web_dev: 0, hours_ui_ux: 0, hours_qc_doc: 4, hours_dev_ops: 0 },
        ],
      },
    ],
  };

  const createRes = await fetch(`${BASE_URL}/api/estimates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testEstimatePayload),
  });
  const createJson = await createRes.json();
  assert.strictEqual(createRes.status, 201);
  const createdId = createJson.estimate.id;
  console.log(`✓ Berhasil membuat estimasi uji coba #${createdId} via API`);

  // Pastikan ada di database sebelum dihapus
  const dbEstBefore = await pool.query('SELECT id FROM project_estimates WHERE id = $1', [createdId]);
  const dbModBefore = await pool.query('SELECT id FROM estimate_modules WHERE estimate_id = $1', [createdId]);
  const modId = dbModBefore.rows[0].id;
  const dbTaskBefore = await pool.query('SELECT id FROM estimate_tasks WHERE module_id = $1', [modId]);
  assert.strictEqual(dbEstBefore.rows.length, 1);
  assert.strictEqual(dbModBefore.rows.length, 1);
  assert.strictEqual(dbTaskBefore.rows.length, 2);
  console.log(`✓ Database terverifikasi: 1 estimate, 1 module (id: ${modId}), 2 tasks`);

  // Eksekusi DELETE /api/estimates/[id]
  const deleteRes = await fetch(`${BASE_URL}/api/estimates/${createdId}`, { method: 'DELETE' });
  assert.strictEqual(deleteRes.status, 200, 'DELETE harus return status 200');
  const deleteJson = await deleteRes.json();
  assert.strictEqual(deleteJson.success, true);
  console.log(`✓ DELETE /api/estimates/${createdId} sukses:`, deleteJson.message);

  // Verifikasi database bersih (CASCADE)
  const dbEstAfter = await pool.query('SELECT id FROM project_estimates WHERE id = $1', [createdId]);
  const dbModAfter = await pool.query('SELECT id FROM estimate_modules WHERE estimate_id = $1', [createdId]);
  const dbTaskAfter = await pool.query('SELECT id FROM estimate_tasks WHERE module_id = $1', [modId]);
  assert.strictEqual(dbEstAfter.rows.length, 0, 'Record project_estimates harus terhapus');
  assert.strictEqual(dbModAfter.rows.length, 0, 'Record estimate_modules harus terhapus secara CASCADE');
  assert.strictEqual(dbTaskAfter.rows.length, 0, 'Record estimate_tasks harus terhapus secara CASCADE');
  console.log('✓ Verifikasi DB: Semua relasi anak (modules & tasks) terhapus bersih via CASCADE!');

  // Verifikasi DELETE ulang return 404
  const delAgainRes = await fetch(`${BASE_URL}/api/estimates/${createdId}`, { method: 'DELETE' });
  assert.strictEqual(delAgainRes.status, 404, 'DELETE record yang sudah dihapus harus return 404');
  console.log('✓ DELETE ulang return 404 (Not Found) seperti yang diharapkan.');

  // 3. Verifikasi HTTP Status server container port 3001
  console.log('\n3. Memeriksa respon HTTP port 3001...');
  const rootRes = await fetch(`${BASE_URL}/`);
  assert.strictEqual(rootRes.status, 200);
  console.log('✓ HTTP GET / return 200 OK');

  await pool.end();
  console.log('\n=== SEMUA VERIFIKASI SELESAI & LULUS 100% ===');
}

verify().catch((err) => {
  console.error('Verifikasi gagal:', err);
  process.exit(1);
});
