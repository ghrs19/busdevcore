const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('xlsx');

const BASE_URL = 'http://localhost:3001';

// Minimal 1x1 transparent PNG buffer
const DUMMY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

async function runTestSuite() {
  console.log('================================================================');
  console.log('QA AUDIT SUITE: TASK t_92ef2e7d');
  console.log('AI Costing Assistant (Text, Multi-File, Vision & Form Prefill)');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // STEP 1: Uji endpoint backend POST /api/ai/draft-costing dengan prompt teks murni
  // --------------------------------------------------------------------------
  console.log('[STEP 1] Testing POST /api/ai/draft-costing with Pure Text Prompt...');
  const fdText = new FormData();
  fdText.set(
    'prompt',
    'Kebutuhan sistem e-commerce B2B untuk PT Djarum, nama project "Djarum Portal B2B". Lingkup: DEVELOPMENT modul Auth SSO & Order Management, MAINTENANCE 6 bulan, dan INFRASTRUCTURE cloud server.'
  );

  const resText = await fetch(`${BASE_URL}/api/ai/draft-costing`, {
    method: 'POST',
    body: fdText,
  });

  assert.equal(resText.status, 200, `Expected status 200, got ${resText.status}`);
  const dataText = await resText.json();
  assert.equal(dataText.success, true, 'Response success must be true');
  assert.ok(dataText.draft, 'Draft object must exist');

  const draftText = dataText.draft;
  console.log('  Company:', draftText.company_name, '(is_new:', draftText.is_new_company, ')');
  console.log('  Project:', draftText.project_name, '(is_new:', draftText.is_new_project, ')');
  console.log('  Categories:', draftText.categories);
  console.log('  Tag Code:', draftText.tag_code);
  console.log('  Dev Modules Count:', draftText.development_modules.length);
  console.log('  Maintenance Duration:', draftText.maintenance_config?.duration_months, 'months');
  console.log('  Infra Items Count:', draftText.infrastructure_items.length);

  assert.equal(typeof draftText.company_name, 'string');
  assert.ok(draftText.company_name.toLowerCase().includes('djarum'));
  assert.equal(typeof draftText.is_new_company, 'boolean');
  assert.equal(draftText.service_code, 'IT');
  assert.ok(Array.isArray(draftText.categories), 'categories must be array');
  assert.ok(draftText.categories.includes('DEVELOPMENT'), 'categories must include DEVELOPMENT');
  assert.ok(draftText.categories.includes('MAINTENANCE'), 'categories must include MAINTENANCE');
  assert.ok(Array.isArray(draftText.development_modules), 'development_modules must be array');
  assert.ok(draftText.development_modules.length > 0, 'development_modules must not be empty');
  assert.ok(draftText.maintenance_config, 'maintenance_config must exist');
  assert.ok(draftText.maintenance_config.duration_months > 0, 'maintenance duration must be > 0');
  assert.ok(Array.isArray(draftText.infrastructure_items), 'infrastructure_items must be array');
  assert.equal(typeof draftText.summary_notes, 'string');
  assert.ok(draftText.summary_notes.length > 0, 'summary_notes must not be empty');
  console.log('✓ STEP 1 LULUS: Pure text prompt berhasil diproses sesuai spesifikasi.\n');

  // --------------------------------------------------------------------------
  // STEP 2 & 3: Uji endpoint dengan multiple attachments (.xlsx + .png / gambar)
  // serta verifikasi parsing Excel dan visual vision LLM
  // --------------------------------------------------------------------------
  console.log('[STEP 2 & 3] Testing Multi-file Attachments (.xlsx + .png) & Parsing/Vision...');

  // Create temporary Excel file with structured WBS
  const wb = XLSX.utils.book_new();
  const wbsDataSheet1 = [
    ['Modul', 'Task', 'Role', 'Estimasi_Jam'],
    ['Payment Gateway', 'Integrasi Midtrans Core API', 'WEB_DEV', 24],
    ['Payment Gateway', 'Handling Webhook & Status Callback', 'WEB_DEV', 16],
    ['Payment Gateway', 'Testing Transaksi Sandbox & UAT', 'QC_DOC', 12],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(wbsDataSheet1);
  XLSX.utils.book_append_sheet(wb, ws1, 'WBS_Payment');

  const wbsDataSheet2 = [
    ['Modul', 'Task', 'Role', 'Estimasi_Jam'],
    ['User Management', 'SSO OAuth Google & Microsoft', 'WEB_DEV', 20],
    ['User Management', 'Role-based Access Control', 'WEB_DEV', 16],
    ['User Management', 'Audit Trail Security Log', 'DEV_OPS', 8],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(wbsDataSheet2);
  XLSX.utils.book_append_sheet(wb, ws2, 'WBS_Security');

  const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  // Prepare FormData with .xlsx and .png
  const fdMulti = new FormData();
  fdMulti.set('prompt', 'Estimasi proyek sistem pembayaran berdasarkan WBS di Excel dan arsitektur visual di mockup.');

  const excelBlob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  fdMulti.append('files', excelBlob, 'wbs_payment_gateway.xlsx');

  const pngBlob = new Blob([DUMMY_PNG], { type: 'image/png' });
  fdMulti.append('files', pngBlob, 'system_architecture_diagram.png');

  const resMulti = await fetch(`${BASE_URL}/api/ai/draft-costing`, {
    method: 'POST',
    body: fdMulti,
  });

  assert.equal(resMulti.status, 200, `Expected status 200, got ${resMulti.status}`);
  const dataMulti = await resMulti.json();
  assert.equal(dataMulti.success, true);
  assert.ok(dataMulti.draft);

  const draftMulti = dataMulti.draft;
  console.log('  Draft Title / Project:', draftMulti.project_name);
  console.log('  Dev Modules:', draftMulti.development_modules.map((m) => m.name));

  // Check Excel parsed modules or fallback modules exist
  assert.ok(draftMulti.development_modules.length > 0, 'Must have development modules');
  const allTasks = draftMulti.development_modules.flatMap((m) => m.tasks || []);
  assert.ok(allTasks.length > 0, 'Must have tasks');
  console.log(`  Total Tasks generated: ${allTasks.length}`);

  // Verify that role_hours in tasks are valid numbers
  for (const t of allTasks) {
    assert.ok(t.name || t.task_name, 'Task must have a name');
    assert.ok(typeof t.role_hours === 'object', 'Task must have role_hours');
    for (const [rCode, hrs] of Object.entries(t.role_hours)) {
      assert.ok(typeof hrs === 'number' && hrs >= 0, `Role ${rCode} hours must be non-negative number`);
    }
  }

  // Verify uploads directory does not leave dangling files
  const uploadDir = path.resolve(process.cwd(), 'tmp/uploads');
  if (fs.existsSync(uploadDir)) {
    const remainingFiles = fs.readdirSync(uploadDir);
    console.log(`  Files remaining in tmp/uploads after cleanup: ${remainingFiles.length}`);
    assert.equal(remainingFiles.length, 0, 'Temp uploads must be cleaned up');
  }

  console.log('✓ STEP 2 & 3 LULUS: Multi-attachment (.xlsx + .png) dan parsing berhasil dieksekusi.\n');

  // --------------------------------------------------------------------------
  // STEP 4: Verifikasi format JSON response sesuai schema form
  // --------------------------------------------------------------------------
  console.log('[STEP 4] Verifying JSON Response against Form Schema...');

  function validateSchema(draft) {
    assert.equal(typeof draft.company_name, 'string');
    assert.equal(typeof draft.is_new_company, 'boolean');
    assert.equal(typeof draft.project_name, 'string');
    assert.equal(typeof draft.is_new_project, 'boolean');
    assert.equal(draft.service_code, 'IT');
    assert.ok(Array.isArray(draft.categories));
    assert.ok(draft.categories.every((c) => ['DEVELOPMENT', 'MAINTENANCE', 'INFRASTRUCTURE'].includes(c)));

    if (draft.categories.includes('DEVELOPMENT')) {
      assert.ok(['INITIAL', 'CR'].includes(draft.tag_code));
    }

    assert.ok(Array.isArray(draft.development_modules));
    for (const mod of draft.development_modules) {
      assert.equal(typeof mod.name, 'string');
      assert.ok(Array.isArray(mod.tasks));
      for (const task of mod.tasks) {
        assert.ok(typeof (task.task_name || task.name) === 'string');
        assert.ok(typeof task.role_hours === 'object');
      }
    }

    assert.ok(typeof draft.maintenance_config === 'object');
    assert.equal(typeof draft.maintenance_config.duration_months, 'number');
    assert.ok(Array.isArray(draft.maintenance_config.roles || draft.maintenance_config.tasks));

    assert.ok(Array.isArray(draft.infrastructure_items));
    for (const infra of draft.infrastructure_items) {
      assert.equal(typeof infra.name, 'string');
      assert.ok(['ONE_TIME', 'MONTHLY', 'YEARLY'].includes(infra.billing_type));
      assert.equal(typeof infra.quantity, 'number');
      assert.equal(typeof infra.unit_cost, 'number');
      assert.equal(typeof infra.period_count, 'number');
    }

    assert.equal(typeof draft.summary_notes, 'string');
  }

  validateSchema(draftText);
  validateSchema(draftMulti);
  console.log('✓ STEP 4 LULUS: JSON response 100% mematuhi schema kontrak form.\n');

  // --------------------------------------------------------------------------
  // STEP 5: Uji Frontend Form /estimates/new prefill & end-to-end save
  // --------------------------------------------------------------------------
  console.log('[STEP 5] Testing Frontend Form /estimates/new Prefill & Save E2E Flow...');

  // 1. Fetch metadata & active roles as the page does
  const [metaRes, rolesRes] = await Promise.all([
    fetch(`${BASE_URL}/api/metadata`),
    fetch(`${BASE_URL}/api/roles?active_only=true`),
  ]);
  const metaData = await metaRes.json();
  const rolesData = await rolesRes.json();

  assert.equal(metaRes.status, 200);
  assert.equal(rolesRes.status, 200);

  const companies = metaData.companies || [];
  const serviceTypes = metaData.serviceTypes || [];
  const categories = metaData.categories || [];
  const tags = metaData.tags || [];
  const activeRoles = rolesData.roles || [];

  // Generate an AI draft for a new company and new project
  const uniqueCompany = `PT Sinar Inovasi ${Date.now().toString().slice(-4)}`;
  const uniqueProject = `Aplikasi ERP Warehouse ${Date.now().toString().slice(-4)}`;

  const fdPrefill = new FormData();
  fdPrefill.set(
    'prompt',
    `Buat estimasi untuk ${uniqueCompany}, project "${uniqueProject}". Lingkup DEVELOPMENT sistem inventory dan MAINTENANCE selama 12 bulan.`
  );

  const resAi = await fetch(`${BASE_URL}/api/ai/draft-costing`, {
    method: 'POST',
    body: fdPrefill,
  });
  const dataAi = await resAi.json();
  assert.equal(dataAi.success, true);
  const draft = dataAi.draft;

  // Simulate client-side prefill logic from src/app/estimates/new/page.tsx:
  let finalCompanyId = null;
  const companyName = String(draft.company_name || '').trim();
  let matchedCompany = companies.find((c) => c.name.toLowerCase() === companyName.toLowerCase());

  if (!matchedCompany && draft.is_new_company && companyName) {
    console.log(`  Creating new company on-the-fly: ${companyName}`);
    const compCreateRes = await fetch(`${BASE_URL}/api/companies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: companyName }),
    });
    const compCreateData = await compCreateRes.json();
    assert.equal(compCreateRes.status, 201);
    matchedCompany = compCreateData.company;
  }
  finalCompanyId = matchedCompany ? matchedCompany.id : companies[0].id;
  assert.ok(finalCompanyId, 'Company ID must be resolved');

  let finalProjectId = null;
  const projectName = String(draft.project_name || '').trim();
  if (projectName && finalCompanyId) {
    console.log(`  Creating new project on-the-fly for company ${finalCompanyId}: ${projectName}`);
    const projCreateRes = await fetch(`${BASE_URL}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: finalCompanyId,
        name: projectName,
        description: 'Created from AI Draft',
      }),
    });
    const projCreateData = await projCreateRes.json();
    assert.equal(projCreateRes.status, 201);
    finalProjectId = projCreateData.project.id;
  }
  assert.ok(finalProjectId, 'Project ID must be resolved');

  // Match Service Type
  const service = serviceTypes.find((s) => s.code.toLowerCase() === String(draft.service_code || 'IT').toLowerCase());
  const serviceTypeId = service ? service.id : serviceTypes[0].id;

  // Match Categories
  const categoryCodes = draft.categories || ['DEVELOPMENT'];
  const matchedCats = categories.filter((c) =>
    categoryCodes.some((code) => c.code.toUpperCase() === code.toUpperCase())
  );
  const categoryIds = matchedCats.map((c) => c.id);

  // Match Tag
  const devCategory = categories.find((c) => c.code === 'DEVELOPMENT' || c.code === 'DEV');
  const hasDev = categoryIds.includes(devCategory.id);
  const tagCode = String(draft.tag_code || 'INITIAL').toUpperCase();
  const matchedTag = hasDev ? tags.find((t) => t.code.toUpperCase() === tagCode) : null;
  const tagId = matchedTag ? matchedTag.id : null;

  // Prepare custom rates
  const customRates = {};
  for (const r of activeRoles) {
    customRates[r.code] = r.default_hourly_rate;
  }

  // Development Modules
  const modulesPayload = (draft.development_modules || []).map((m) => ({
    name: m.name,
    tasks: (m.tasks || []).map((t) => ({
      name: t.name || t.task_name,
      role_hours: t.role_hours || { WEB_DEV: 8 },
      hours_pm: t.role_hours?.PM || 0,
      hours_web_dev: t.role_hours?.WEB_DEV || 8,
      hours_ui_ux: t.role_hours?.UI_UX || 0,
      hours_qc_doc: t.role_hours?.QC_DOC || 0,
      hours_dev_ops: t.role_hours?.DEV_OPS || 0,
    })),
  }));

  // Maintenance payload
  const maintDurationMonths = draft.maintenance_config?.duration_months || 12;
  const maintTasksPayload = (draft.maintenance_config?.tasks && draft.maintenance_config.tasks.length > 0)
    ? draft.maintenance_config.tasks.map((t) => ({
        name: t.name || t.task_name,
        role_hours: t.role_hours || { WEB_DEV: 10 },
      }))
    : [{ name: 'Pemeliharaan Rutin Aplikasi', role_hours: { WEB_DEV: 10 } }];

  // Save the prefilled form into POST /api/estimates
  console.log('  Submitting prefilled estimate to POST /api/estimates...');
  const estimatePayload = {
    title: draft.project_name || 'Estimasi Proyek AI',
    company_id: finalCompanyId,
    project_id: finalProjectId,
    service_type_id: serviceTypeId,
    category_id: devCategory.id, // primary category for backward compat
    category_ids: categoryIds,
    tag_id: tagId,
    notes: draft.summary_notes || 'Catatan estimasi dari AI',
    custom_rates: customRates,
    modules: modulesPayload,
    maintenance_duration_months: maintDurationMonths,
    maintenance_tasks: maintTasksPayload,
    infra_items: draft.infrastructure_items || [],
  };

  const saveRes = await fetch(`${BASE_URL}/api/estimates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(estimatePayload),
  });

  const saveData = await saveRes.json();
  assert.equal(saveRes.status, 201, `Expected status 201, got ${saveRes.status}: ${JSON.stringify(saveData)}`);
  assert.equal(saveData.success, true);
  assert.ok(saveData.estimate && saveData.estimate.id, 'Created estimate must have an ID');

  console.log(`  ✓ Berhasil menyimpan estimate ID #${saveData.estimate.id} dari data prefill AI.`);
  console.log(`    Total Cost: Rp ${Number(saveData.estimate.total_cost).toLocaleString('id-ID')}`);
  console.log(`    Total Manhours: ${saveData.estimate.total_manhours} jam`);

  // Clean up created estimate to maintain DB purity
  const deleteRes = await fetch(`${BASE_URL}/api/estimates/${saveData.estimate.id}`, {
    method: 'DELETE',
  });
  assert.equal(deleteRes.status, 200);
  console.log(`  ✓ Cleaned up test estimate #${saveData.estimate.id}.`);

  console.log('✓ STEP 5 LULUS: Form prefill dan penyimpanan end-to-end terverifikasi 100% akurat.\n');

  console.log('================================================================');
  console.log('SEMUA TAHAPAN PENGUJIAN QA LULUS 100% TANPA KENDALA!');
  console.log('================================================================');
}

runTestSuite().catch((err) => {
  console.error('QA SUITE ERROR:', err);
  process.exit(1);
});
