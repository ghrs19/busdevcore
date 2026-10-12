import assert from 'node:assert/strict';

const base = process.env.BASE_URL || 'http://127.0.0.1:13001';
const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;
if (!email || !password) throw new Error('TEST_EMAIL and TEST_PASSWORD are required');

const cookie = [];
async function request(path, { body, key, failure } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (key) headers['Idempotency-Key'] = key;
  if (failure) headers['X-Test-Failure'] = failure;
  if (cookie.length) headers.cookie = cookie.join('; ');
  const response = await fetch(`${base}${path}`, { method: 'POST', headers, body: body && JSON.stringify(body) });
  const setCookie = response.headers.getSetCookie?.() || [];
  cookie.push(...setCookie.map((value) => value.split(';', 1)[0]));
  return { status: response.status, body: await response.json() };
}

const login = await request('/api/auth/login', { body: { email, password } });
assert.equal(login.status, 200);
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const key = `integration-${suffix}`;
const parallelKey = `integration-parallel-${suffix}`;
const body = { title: `Idempotency integration ${suffix}`, company_id: 1, service_type_id: 1, category_id: 1, tag_id: 1, modules: [{ name: 'Probe', tasks: [{ name: 'Task', hours_pm: 1 }] }] };

const failedKey = `integration-failure-${suffix}`;
const forcedFailure = await request('/api/estimates', { body: { ...body, new_project_name: `Failure project ${suffix}` }, key: failedKey, failure: 'after_project' });
assert.equal(forcedFailure.status, 500);
const failureRetry = await request('/api/estimates', { body: { ...body, new_project_name: `Failure project ${suffix}` }, key: failedKey });
assert.equal(failureRetry.status, 201);

const first = await request('/api/estimates', { body, key });
const retry = await request('/api/estimates', { body, key });
const changed = await request('/api/estimates', { body: { ...body, title: `${body.title} changed` }, key });
assert.equal(first.status, 201);
assert.equal(retry.status, 201);
assert.equal(retry.body.estimate.id, first.body.estimate.id);
assert.equal(changed.status, 409);

const parallel = await Promise.all(Array.from({ length: 5 }, () => request('/api/estimates', { body, key: parallelKey })));
assert.deepEqual(parallel.map(({ status }) => status).sort(), [201, 201, 201, 201, 201]);
assert.equal(new Set(parallel.map(({ body: value }) => value.estimate.id)).size, 1);
console.log(JSON.stringify({ forced_failure: forcedFailure.status, failure_retry: failureRetry.body.estimate.id, single: first.body.estimate.id, retry: retry.body.estimate.id, changed: changed.status, parallel: parallel.map(({ body: value }) => value.estimate.id) }));
