-- Rollback 015: remove only migration 015's table; preserve all other objects.
DROP TABLE IF EXISTS public.estimate_idempotency_keys;
