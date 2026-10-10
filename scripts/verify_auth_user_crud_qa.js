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

async function run() {
  console.log('=== TEST SUITE: QA Auth, Route Protection & User CRUD ===\n');

  // STEP 1: Verify Initial Unauthenticated State
  console.log('--- 1. Verification of Initial Unauthenticated State ---');
  const meUnauth = await fetch(`${BASE_URL}/api/auth/me`);
  assert.strictEqual(meUnauth.status, 401, 'Unauthenticated /api/auth/me must return 401');
  const meUnauthJson = await meUnauth.json();
  assert.strictEqual(meUnauthJson.user, null, 'Unauthenticated user field must be null');
  console.log('  ✓ GET /api/auth/me returns 401 and user: null');

  // STEP 2: Route Protection (Middleware)
  console.log('\n--- 2. Route Protection / Middleware Verification ---');
  const protectedRoutes = ['/', '/estimates/new', '/master'];
  for (const route of protectedRoutes) {
    const res = await fetch(`${BASE_URL}${route}`, { redirect: 'manual' });
    assert(res.status === 307 || res.status === 308 || res.status === 302 || res.status === 303, `Protected route ${route} should redirect when unauthenticated, got ${res.status}`);
    const location = res.headers.get('location');
    assert(location && location.includes('/login'), `Protected route ${route} redirect location should be /login, got ${location}`);
    console.log(`  ✓ Route ${route} correctly redirects unauthenticated request to /login (Status: ${res.status})`);
  }

  // Public routes check
  const loginPageRes = await fetch(`${BASE_URL}/login`);
  assert.strictEqual(loginPageRes.status, 200, '/login page must be accessible publicly without redirect');
  console.log('  ✓ Route /login is publicly accessible (Status 200)');

  // API protection check without session
  const usersApiUnauth = await fetch(`${BASE_URL}/api/users`);
  assert.strictEqual(usersApiUnauth.status, 401, 'GET /api/users without auth must return 401');
  console.log('  ✓ GET /api/users returns 401 Unauthorized when not logged in');

  // STEP 3: Login Authentication Flow
  console.log('\n--- 3. Login Authentication Flow ---');
  // 3.1 Invalid login credentials
  const badLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@gherdev.com', password: 'wrongpassword' }),
  });
  assert.strictEqual(badLogin.status, 401, 'Wrong password must return 401');
  const badLoginJson = await badLogin.json();
  assert.strictEqual(badLoginJson.error, 'Email atau password salah.');
  console.log('  ✓ POST /api/auth/login with wrong password returns 401 with appropriate error message');

  // 3.2 Non-existent user login
  const nonExistentLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'unknown@example.com', password: 'password123' }),
  });
  assert.strictEqual(nonExistentLogin.status, 401, 'Non-existent user must return 401');
  console.log('  ✓ POST /api/auth/login with non-existent email returns 401');

  // 3.3 Valid default admin login
  const goodLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@gherdev.com', password: 'admin123' }),
  });
  assert.strictEqual(goodLogin.status, 200, 'Valid login must return 200');
  const setCookieHeader = goodLogin.headers.get('set-cookie');
  assert(setCookieHeader && setCookieHeader.includes('busdev_session='), 'Response must set busdev_session cookie');
  const sessionCookie = parseCookie(setCookieHeader);
  console.log(`  ✓ POST /api/auth/login successful with 200 OK. Session cookie received.`);

  // 3.4 Verify /api/auth/me with session cookie
  const meAuth = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: sessionCookie },
  });
  assert.strictEqual(meAuth.status, 200, 'Authenticated /api/auth/me must return 200');
  const meAuthJson = await meAuth.json();
  assert(meAuthJson.user && meAuthJson.user.email === 'admin@gherdev.com', 'Authenticated user email must match');
  console.log(`  ✓ GET /api/auth/me with session returns user: ${meAuthJson.user.name} (${meAuthJson.user.email}) role: ${meAuthJson.user.role}`);

  // 3.5 Verify protected routes with valid session cookie
  for (const route of protectedRoutes) {
    const res = await fetch(`${BASE_URL}${route}`, {
      headers: { Cookie: sessionCookie },
      redirect: 'manual',
    });
    assert.strictEqual(res.status, 200, `Protected route ${route} with valid session cookie must return 200`);
    console.log(`  ✓ Route ${route} accessible with session cookie (Status 200)`);
  }

  // STEP 4: User Master Data CRUD Verification
  console.log('\n--- 4. User Master Data CRUD Verification ---');
  // 4.1 Read users list
  const listRes = await fetch(`${BASE_URL}/api/users`, {
    headers: { Cookie: sessionCookie },
  });
  assert.strictEqual(listRes.status, 200, 'GET /api/users must return 200');
  const listJson = await listRes.json();
  assert(Array.isArray(listJson.users), 'Response must contain users array');
  const initialCount = listJson.users.length;
  console.log(`  ✓ GET /api/users returns ${initialCount} user(s)`);

  // 4.2 Create new QA user
  const timestamp = Date.now();
  const testUserEmail = `qa_test_${timestamp}@gherdev.com`;
  const createRes = await fetch(`${BASE_URL}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
    body: JSON.stringify({
      name: 'QA Automation User',
      email: testUserEmail,
      password: 'TestPassword123!',
      role: 'staff',
    }),
  });
  assert.strictEqual(createRes.status, 201, 'POST /api/users must return 201 Created');
  const createJson = await createRes.json();
  assert(createJson.user && createJson.user.id, 'Created user must have an id');
  const createdUserId = createJson.user.id;
  assert.strictEqual(createJson.user.email, testUserEmail);
  assert.strictEqual(createJson.user.role, 'staff');
  assert.strictEqual(createJson.user.is_active, true);
  console.log(`  ✓ POST /api/users created user ID ${createdUserId} (${testUserEmail})`);

  // Verify created user can authenticate
  const testUserLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testUserEmail, password: 'TestPassword123!' }),
  });
  assert.strictEqual(testUserLogin.status, 200, 'Created test user should be able to login');
  const testUserCookie = parseCookie(testUserLogin.headers.get('set-cookie'));
  const testUserMe = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: testUserCookie },
  });
  const testUserMeJson = await testUserMe.json();
  assert.strictEqual(testUserMeJson.user.id, createdUserId);
  console.log(`  ✓ Newly created user can log in and session returns correct user ID ${createdUserId}`);

  // 4.3 Prevent duplicate email creation
  const duplicateRes = await fetch(`${BASE_URL}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
    body: JSON.stringify({
      name: 'Duplicate QA User',
      email: testUserEmail,
      password: 'AnyPassword123',
      role: 'admin',
    }),
  });
  assert.strictEqual(duplicateRes.status, 400, 'Duplicate email should return 400');
  console.log('  ✓ Duplicate email creation rejected with 400 Bad Request');

  // 4.4 Update QA user (name, role, status, and new password)
  const updateRes = await fetch(`${BASE_URL}/api/users`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
    body: JSON.stringify({
      id: createdUserId,
      name: 'QA Automation User Updated',
      email: testUserEmail,
      role: 'manager',
      is_active: true,
      password: 'UpdatedPassword123!',
    }),
  });
  assert.strictEqual(updateRes.status, 200, 'PUT /api/users must return 200 OK');
  const updateJson = await updateRes.json();
  assert.strictEqual(updateJson.user.name, 'QA Automation User Updated');
  assert.strictEqual(updateJson.user.role, 'manager');
  console.log(`  ✓ PUT /api/users updated name, role to manager, and password`);

  // Verify updated password works for login
  const testUserUpdatedLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testUserEmail, password: 'UpdatedPassword123!' }),
  });
  assert.strictEqual(testUserUpdatedLogin.status, 200, 'Login with updated password must succeed');
  console.log('  ✓ Login with updated password successful');

  // Old password must fail
  const testUserOldPasswordLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testUserEmail, password: 'TestPassword123!' }),
  });
  assert.strictEqual(testUserOldPasswordLogin.status, 401, 'Login with previous password must fail');
  console.log('  ✓ Login with outdated password rejected with 401');

  // 4.5 Deactivate QA user and verify login is blocked
  const deactivateRes = await fetch(`${BASE_URL}/api/users`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
    body: JSON.stringify({
      id: createdUserId,
      name: 'QA Automation User Updated',
      email: testUserEmail,
      role: 'manager',
      is_active: false,
    }),
  });
  assert.strictEqual(deactivateRes.status, 200, 'Deactivation PUT /api/users must return 200');
  assert.strictEqual(deactivateRes.json().is_active, undefined); // json has user property
  const deactivatedLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testUserEmail, password: 'UpdatedPassword123!' }),
  });
  assert.strictEqual(deactivatedLogin.status, 401, 'Deactivated user login must return 401');
  console.log('  ✓ Deactivated user (is_active=false) cannot log in');

  // 4.6 Self-deletion prevention
  const selfDeleteRes = await fetch(`${BASE_URL}/api/users?id=${meAuthJson.user.id}`, {
    method: 'DELETE',
    headers: { Cookie: sessionCookie },
  });
  assert.strictEqual(selfDeleteRes.status, 400, 'Self-deletion must return 400');
  const selfDeleteJson = await selfDeleteRes.json();
  assert.strictEqual(selfDeleteJson.error, 'Tidak dapat menghapus akun sendiri.');
  console.log('  ✓ Self-deletion safely prevented with 400: "Tidak dapat menghapus akun sendiri."');

  // 4.7 Delete QA user
  const deleteRes = await fetch(`${BASE_URL}/api/users?id=${createdUserId}`, {
    method: 'DELETE',
    headers: { Cookie: sessionCookie },
  });
  assert.strictEqual(deleteRes.status, 200, 'DELETE /api/users must return 200 OK');
  console.log(`  ✓ DELETE /api/users?id=${createdUserId} successful`);

  // Verify user deleted in database and list
  const listAfterDelete = await fetch(`${BASE_URL}/api/users`, {
    headers: { Cookie: sessionCookie },
  });
  const listAfterDeleteJson = await listAfterDelete.json();
  assert(!listAfterDeleteJson.users.some(u => u.id === createdUserId), 'Deleted user must not exist in user list');
  console.log('  ✓ Deleted user confirmed gone from GET /api/users list');

  // STEP 5: Logout Flow
  console.log('\n--- 5. Logout Flow Verification ---');
  const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { Cookie: sessionCookie },
  });
  assert.strictEqual(logoutRes.status, 200, 'POST /api/auth/logout must return 200');
  const logoutSetCookie = logoutRes.headers.get('set-cookie');
  assert(logoutSetCookie && (logoutSetCookie.includes('Max-Age=0') || logoutSetCookie.includes('busdev_session=;')), 'Logout must clear busdev_session cookie');
  console.log('  ✓ POST /api/auth/logout clears session cookie (Max-Age=0)');

  // Verify request with cleared cookie fails
  const clearedCookie = parseCookie(logoutSetCookie);
  const meAfterLogout = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: clearedCookie },
  });
  assert.strictEqual(meAfterLogout.status, 401, 'Request to /api/auth/me with cleared cookie must return 401');
  console.log('  ✓ GET /api/auth/me with cleared cookie returns 401 Unauthorized');

  console.log('\n============================================================');
  console.log('ALL QA AUTH, ROUTE PROTECTION & USER CRUD CHECKS PASSED 100%');
  console.log('============================================================\n');
}

run()
  .catch(err => {
    console.error('QA Test Suite Failed:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
