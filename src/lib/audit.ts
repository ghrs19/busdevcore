import pool from '@/lib/db';

type AuditEntry = {
  userId?: number | null;
  entityType: string;
  entityId: number;
  action: string;
  details?: Record<string, unknown>;
};
type AuditQuery = Pick<typeof pool, 'query'>;

export async function writeAudit(db: AuditQuery, { userId, entityType, entityId, action, details }: AuditEntry) {
  await db.query(
    `INSERT INTO audit_logs (user_id, entity_type, entity_id, action, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId || null, entityType, entityId, action, JSON.stringify(details || {})]
  );
}

export async function logAudit(entry: AuditEntry) {
  try {
    await writeAudit(pool, entry);
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
