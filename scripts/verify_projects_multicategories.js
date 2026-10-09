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
  connectionString: databaseUrl || 'postgresql://postgres:***@localhost:5432/busdevcore',
});

async function run() {
  console.log('=== VERIFIKASI PROJECTS & MULTI-CATEGORIES ===\n');

  // 1. Verify DB
  console.log('1. Memeriksa Skema Database & Migrasi...');
  const tablesRes = await pool.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name IN ('projects', 'estimate_categories', 'categories');
  `);
  const foundTables = tablesRes.rows.map(r => r.table_name);
  assert(foundTables.includes('projects'), 'Tabel projects harus ada');
  assert(foundTables.includes('estimate_categories'), 'Tabel estimate_categories harus ada');
  console.log('   ✓ Tabel projects dan estimate_categories terverifikasi di PostgreSQL');

  const infraRes = await pool.query("SELECT * FROM categories WHERE code = 'INFRASTRUCTURE'");
  assert(infraRes.rows.length > 0, "Kategori INFRASTRUCTURE harus ada di tabel categories");
  console.log('   ✓ Kategori INFRASTRUCTURE terdaftar di DB (id: ' + infraRes.rows[0].id + ')');

  // 2. Verify /api/metadata
  console.log('\n2. Memeriksa API /api/metadata...');
  const metaRes = await fetch(`${BASE_URL}/api/metadata`);
  const metaData = await metaRes.json();
  assert(metaData.success === true, 'API metadata harus sukses');
  const hasInfraMeta = metaData.categories.some(c => c.code === 'INFRASTRUCTURE');
  assert(hasInfraMeta, 'Kategori INFRASTRUCTURE harus ada pada response /api/metadata');
  console.log('   ✓ /api/metadata memuat kategori INFRASTRUCTURE');

  // 3. Verify /api/projects
  console.log('\n3. Memeriksa API /api/projects...');
  const compRes = await pool.query('SELECT id, name FROM companies LIMIT 1');
  assert(compRes.rows.length > 0, 'Perusahaan harus ada');
  const testCompanyId = compRes.rows[0].id;

  // POST create project
  const testProjName = `Test Proj ${Date.now()}`;
  const createProjRes = await fetch(`${BASE_URL}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      company_id: testCompanyId,
      name: testProjName,
      description: 'Automated test project',
    }),
  });
  const createProjData = await createProjRes.json();
  assert(createProjData.success === true, 'Create project harus sukses');
  assert(createProjData.project.name === testProjName, 'Nama project harus sesuai');
  const createdProjectId = createProjData.project.id;
  console.log(`   ✓ POST /api/projects berhasil membuat project #${createdProjectId} (${testProjName})`);

  // GET filter by company_id
  const getProjRes = await fetch(`${BASE_URL}/api/projects?company_id=${testCompanyId}`);
  const getProjData = await getProjRes.json();
  assert(getProjData.success === true, 'GET projects harus sukses');
  const foundInFilter = getProjData.projects.some(p => p.id === createdProjectId);
  assert(foundInFilter, 'Project baru harus muncul di filter per company_id');
  console.log(`   ✓ GET /api/projects?company_id=${testCompanyId} terfilter dengan benar`);

  // 4. Verify /api/estimates Multi-Category & Tag Rules
  console.log('\n4. Memeriksa Aturan Tag & Multi-Category pada /api/estimates...');
  const devCat = metaData.categories.find(c => c.code === 'DEVELOPMENT');
  const maintCat = metaData.categories.find(c => c.code === 'MAINTENANCE');
  const infraCat = metaData.categories.find(c => c.code === 'INFRASTRUCTURE');
  const tagInitial = metaData.tags.find(t => t.code === 'INITIAL');

  // 4a. Development + Infrastructure TANPA Tag (harus gagal)
  const failTagRes = await fetch(`${BASE_URL}/api/estimates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Dev + Infra tanpa Tag',
      company_id: testCompanyId,
      project_id: createdProjectId,
      service_type_id: 1,
      category_ids: [devCat.id, infraCat.id],
      tag_id: null,
      modules: [{ name: 'M1', tasks: [{ name: 'T1', hours_pm: 2 }] }],
    }),
  });
  const failTagData = await failTagRes.json();
  assert(failTagData.success === false, 'Dev + Infra tanpa tag harus ditolak');
  console.log('   ✓ Dev + Infra tanpa Tag berhasil ditolak validasi');

  // 4b. Maintenance + Infrastructure DENGAN Tag (harus gagal)
  const failMaintTagRes = await fetch(`${BASE_URL}/api/estimates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Maint + Infra dengan Tag',
      company_id: testCompanyId,
      project_id: createdProjectId,
      service_type_id: 1,
      category_ids: [maintCat.id, infraCat.id],
      tag_id: tagInitial.id,
      modules: [{ name: 'M1', tasks: [{ name: 'T1', hours_pm: 2 }] }],
    }),
  });
  const failMaintTagData = await failMaintTagRes.json();
  assert(failMaintTagData.success === false, 'Maint + Infra dengan tag harus ditolak');
  console.log('   ✓ Maint + Infra dengan Tag berhasil ditolak validasi');

  // 4c. Development + Infrastructure DENGAN Tag (harus sukses)
  const successDevInfraRes = await fetch(`${BASE_URL}/api/estimates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Dev + Infra Sukses',
      company_id: testCompanyId,
      project_id: createdProjectId,
      service_type_id: 1,
      category_ids: [devCat.id, infraCat.id],
      tag_id: tagInitial.id,
      modules: [{ name: 'M1', tasks: [{ name: 'T1', hours_pm: 2 }] }],
    }),
  });
  const successDevInfraData = await successDevInfraRes.json();
  assert(successDevInfraData.success === true, 'Dev + Infra dengan tag harus sukses');
  const estId1 = successDevInfraData.estimate.id;
  console.log(`   ✓ Dev + Infra dengan Tag INITIAL berhasil disimpan (Estimate #${estId1})`);

  // 4d. Maintenance + Infrastructure TANPA Tag (harus sukses)
  const successMaintInfraRes = await fetch(`${BASE_URL}/api/estimates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Maint + Infra Sukses',
      company_id: testCompanyId,
      project_id: createdProjectId,
      service_type_id: 1,
      category_ids: [maintCat.id, infraCat.id],
      tag_id: null,
      modules: [{ name: 'M1', tasks: [{ name: 'T1', hours_dev_ops: 4 }] }],
    }),
  });
  const successMaintInfraData = await successMaintInfraRes.json();
  assert(successMaintInfraData.success === true, 'Maint + Infra tanpa tag harus sukses');
  const estId2 = successMaintInfraData.estimate.id;
  console.log(`   ✓ Maint + Infra tanpa Tag berhasil disimpan (Estimate #${estId2})`);

  // 5. Verify GET estimates & inspect detail
  console.log('\n5. Memeriksa GET /api/estimates dan GET /api/estimates/[id]...');
  const listRes = await fetch(`${BASE_URL}/api/estimates`);
  const listData = await listRes.json();
  assert(listData.success === true, 'GET estimates harus sukses');
  const target1 = listData.estimates.find(e => e.id === estId1);
  assert(target1, `Estimate #${estId1} harus ada dalam list`);
  assert(target1.project_id === createdProjectId, 'Project id harus sesuai');
  assert(target1.project_name === testProjName, 'Project name harus sesuai');
  assert(Array.isArray(target1.categories), 'categories harus array');
  assert(target1.categories.length === 2, 'categories harus memiliki 2 item');
  console.log('   ✓ GET /api/estimates mengembalikan project_id, project_name, dan badges categories');

  const detailRes = await fetch(`${BASE_URL}/api/estimates/${estId1}`);
  const detailData = await detailRes.json();
  assert(detailData.success === true, 'GET detail harus sukses');
  assert(detailData.estimate.project_name === testProjName, 'Detail harus memuat project_name');
  assert(detailData.estimate.categories.length === 2, 'Detail harus memuat semua kategori terpilih');
  console.log('   ✓ GET /api/estimates/[id] mengembalikan project_name dan array multi-categories');

  console.log('\n=== SELURUH VERIFIKASI SELESAI DAN LULUS 100% ===');
  await pool.end();
}

run().catch((err) => {
  console.error('\n❌ Verifikasi gagal:', err);
  pool.end();
  process.exit(1);
});
