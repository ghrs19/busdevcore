-- Migration 019: seed Master Worker from the staff rate table (rate = 2027 column).
-- Only name + hourly rate. NPWP, Employee ID and tax status are intentionally NOT stored.
-- Idempotent: existing names (case-insensitive) are left untouched.

INSERT INTO workers (name, hourly_rate) VALUES
  ('Ade Isman Aji', 42771),
  ('Alvin Aditya Chandra', 42784),
  ('Ardhi Aprianto', 43054),
  ('Bain', 35818),
  ('Ellfahmie', 35749),
  ('Fathur Lambang Hartadi', 29252),
  ('Hisman Nata Saputra', 24774),
  ('Kenny Andrian Waluyo', 38271),
  ('Louis Cahya Yanuar', 33113),
  ('Muhammad Faisal Al Fauzi', 38702),
  ('Mochammad Irfandi Susanto', 41765),
  ('Nico Ari Novriantoro', 32661),
  ('Siddiq Mustofa', 51041),
  ('Ai Sri Astuti', 35291)
ON CONFLICT (LOWER(name)) DO NOTHING;
