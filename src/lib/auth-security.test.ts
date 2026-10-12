import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getAuthSecret } from './auth-secret.ts';

describe('authentication security', () => {
  it('requires AUTH_SECRET in production', () => {
    assert.throws(() => getAuthSecret({ NODE_ENV: 'production' }), /AUTH_SECRET/);
  });

  it('uses AUTH_SECRET in production', () => {
    assert.equal(getAuthSecret({ NODE_ENV: 'production', AUTH_SECRET: 'configured-secret' }), 'configured-secret');
  });

  it('does not create default admin during login', () => {
    const route = readFileSync(resolve(import.meta.dirname, '../app/api/auth/login/route.ts'), 'utf8');
    assert.doesNotMatch(route, /ensureAdmin|admin@gherdev\.com|admin123|INSERT INTO users/);
  });
});
