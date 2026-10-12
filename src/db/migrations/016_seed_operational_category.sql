-- Add the Operational WBS category expected by the costing API/UI.
INSERT INTO categories(service_type_id, code, name)
SELECT id, 'OPERATION', 'Operational'
FROM service_types
WHERE code = 'IT'
ON CONFLICT (service_type_id, code) DO NOTHING;
