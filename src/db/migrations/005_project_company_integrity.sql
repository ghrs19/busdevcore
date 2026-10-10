-- Match each estimate's project to its company; keep project_id nullable.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_id_company_id_key') THEN
    ALTER TABLE projects ADD CONSTRAINT projects_id_company_id_key UNIQUE (id, company_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_estimates_project_company_fkey') THEN
    ALTER TABLE project_estimates ADD CONSTRAINT project_estimates_project_company_fkey
      FOREIGN KEY (project_id, company_id) REFERENCES projects(id, company_id);
  END IF;
END $$;
