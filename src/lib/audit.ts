import pool from '@/lib/db';

export async function logAudit({
  userId,
  entityType,
  entityId,
  action,
  details,
}: {
  userId?: number | null;
  entityType: string;
  entityId: number;
  action: string;
  details?: Record<string, unknown>;
}) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, entity_type, entity_id, action, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId || null, entityType, entityId, action, JSON.stringify(details || {})]
    );
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
