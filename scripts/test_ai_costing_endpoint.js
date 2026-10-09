const assert = require('assert');

async function testAiCostingEndpoint() {
  console.log('Testing AI Costing Endpoint POST /api/ai/draft-costing...');

  const baseUrl = 'http://localhost:3001/api/ai/draft-costing';

  // 1. Test Text Prompt
  const fd1 = new FormData();
  fd1.set('prompt', 'Estimasi pembuatan sistem e-commerce untuk PT Djarum, project Djarum Online Store. Kategori DEVELOPMENT dan MAINTENANCE 6 bulan.');

  const res1 = await fetch(baseUrl, {
    method: 'POST',
    body: fd1,
  });

  assert.strictEqual(res1.status, 200, `Expected status 200, got ${res1.status}`);
  const data1 = await res1.json();
  assert.strictEqual(data1.success, true, 'Expected success: true');
  assert.ok(data1.draft, 'Expected draft object');

  const draft = data1.draft;
  assert.strictEqual(typeof draft.company_name, 'string');
  assert.strictEqual(typeof draft.is_new_company, 'boolean');
  assert.strictEqual(typeof draft.project_name, 'string');
  assert.strictEqual(typeof draft.is_new_project, 'boolean');
  assert.strictEqual(draft.service_code, 'IT');
  assert.ok(Array.isArray(draft.categories), 'categories must be array');
  assert.ok(draft.categories.includes('DEVELOPMENT'), 'categories should include DEVELOPMENT');
  assert.ok(Array.isArray(draft.development_modules), 'development_modules must be array');
  assert.ok(draft.development_modules.length > 0, 'development_modules should not be empty');
  assert.ok(draft.maintenance_config, 'maintenance_config should exist');
  assert.ok(Array.isArray(draft.infrastructure_items), 'infrastructure_items must be array');
  assert.strictEqual(typeof draft.summary_notes, 'string');

  console.log('✔ Text prompt test passed:', {
    company: draft.company_name,
    project: draft.project_name,
    categories: draft.categories,
    moduleCount: draft.development_modules.length,
  });

  // 2. Test Multi-file Attachment
  const fd2 = new FormData();
  fd2.set('prompt', 'Estimasi berdasarkan file attachment berikut:');
  const dummyCsv = 'Modul,Fitur,Role,Jam\nAuth,Login OTP,WEB_DEV,16\nCatalog,Product List,WEB_DEV,24\n';
  const csvBlob = new Blob([dummyCsv], { type: 'text/csv' });
  fd2.append('files', csvBlob, 'wbs_fitur.csv');

  const res2 = await fetch(baseUrl, {
    method: 'POST',
    body: fd2,
  });

  assert.strictEqual(res2.status, 200);
  const data2 = await res2.json();
  assert.strictEqual(data2.success, true);
  assert.ok(data2.draft);
  assert.ok(data2.draft.development_modules.length > 0);

  console.log('✔ File attachment test passed:', {
    company: data2.draft.company_name,
    project: data2.draft.project_name,
    categories: data2.draft.categories,
    modules: data2.draft.development_modules.map(m => m.name),
  });

  console.log('\nAll AI Costing Endpoint tests passed successfully!');
}

testAiCostingEndpoint().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
