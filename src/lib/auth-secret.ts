export function getAuthSecret(env: Record<string, string | undefined> = process.env) {
  if (env.NODE_ENV === 'production' && !env.AUTH_SECRET) {
    throw new Error('AUTH_SECRET is required in production');
  }
  return env.AUTH_SECRET || env.DATABASE_URL || 'busdevcore-local-session-secret-change-me';
}
