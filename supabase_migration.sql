-- ============================================================
-- PipeGuard — Supabase Migration
-- Run this SQL in your Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Maintenance Logs — completed repair records
CREATE TABLE IF NOT EXISTS maintenance_logs (
  id TEXT PRIMARY KEY,
  watmainid TEXT NOT NULL,
  object_id TEXT,
  material TEXT,
  pipe_size TEXT,
  pressure_zone TEXT,
  old_risk TEXT,
  new_risk TEXT,
  old_condition TEXT,
  new_condition TEXT,
  repair_type TEXT NOT NULL,
  cost NUMERIC DEFAULT 0,
  note TEXT,
  completed_by TEXT DEFAULT 'Engineer',
  completed_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Maintenance Status — per-pipeline workflow tracking
CREATE TABLE IF NOT EXISTS maintenance_status (
  watmainid TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'PENDING',
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by TEXT DEFAULT 'Engineer'
);

-- 3. Incidents — manual field incident reports
CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  pipeline_id TEXT NOT NULL,
  type TEXT NOT NULL,
  risk TEXT,
  material TEXT,
  pipe_size TEXT,
  pressure_zone TEXT,
  note TEXT,
  status TEXT DEFAULT 'OPEN',
  created_by TEXT DEFAULT 'Engineer',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Engineers — engineer management records
CREATE TABLE IF NOT EXISTS engineers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  image TEXT,
  nic TEXT,
  address TEXT,
  area TEXT,
  department TEXT DEFAULT 'Pipeline Inspection',
  designation TEXT DEFAULT 'Field Engineer',
  experience INT DEFAULT 0,
  shift TEXT DEFAULT 'Morning',
  emergency_contact TEXT,
  join_date DATE,
  status TEXT DEFAULT 'Active',
  assigned_pipelines INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Audit Logs — system activity tracking
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_name TEXT NOT NULL,
  role TEXT,
  action TEXT NOT NULL,
  module TEXT,
  status TEXT DEFAULT 'Success',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. System Issues — admin issue tickets
CREATE TABLE IF NOT EXISTS system_issues (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT,
  priority TEXT DEFAULT 'Medium',
  status TEXT DEFAULT 'Open',
  reported_by TEXT,
  reported_date DATE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Enable Row Level Security (RLS) — allow all for anon key
-- ============================================================

ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE engineers ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_issues ENABLE ROW LEVEL SECURITY;

-- Allow full access for anon role (demo project)
CREATE POLICY "Allow all on maintenance_logs" ON maintenance_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on maintenance_status" ON maintenance_status FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on incidents" ON incidents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on engineers" ON engineers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on audit_logs" ON audit_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on system_issues" ON system_issues FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- Seed Data — Initial records
-- ============================================================

-- Seed engineers
INSERT INTO engineers (id, name, email, phone, nic, address, area, department, designation, experience, shift, emergency_contact, join_date, status, assigned_pipelines)
VALUES
  ('ENG-001', 'Kasun Perera', 'kasun@pipeguard.com', '0771234567', '982345678V', 'Colombo 05', 'Colombo North', 'Pipeline Inspection', 'Field Engineer', 4, 'Morning', '0712223334', '2024-01-15', 'Active', 24),
  ('ENG-002', 'Nimal Silva', 'nimal@pipeguard.com', '0779876543', '950112233V', 'Panadura', 'Colombo South', 'Maintenance', 'Maintenance Engineer', 6, 'Evening', '0704445556', '2023-08-10', 'Active', 18)
ON CONFLICT (id) DO NOTHING;

-- Seed audit logs
INSERT INTO audit_logs (id, user_name, role, action, module, status, created_at)
VALUES
  ('LOG-001', 'System Admin', 'Administrator', 'Logged into system', 'Authentication', 'Success', '2026-04-25 09:10:00+00'),
  ('LOG-002', 'System Admin', 'Administrator', 'Created engineer account', 'Engineer Management', 'Success', '2026-04-25 09:25:00+00'),
  ('LOG-003', 'Field Engineer', 'Engineer', 'Updated pipeline data', 'Pipelines', 'Success', '2026-04-25 10:05:00+00'),
  ('LOG-004', 'System Admin', 'Administrator', 'Resolved system issue', 'System Issues', 'Success', '2026-04-25 10:30:00+00'),
  ('LOG-005', 'Unknown User', 'Unknown', 'Failed login attempt', 'Authentication', 'Failed', '2026-04-25 11:02:00+00')
ON CONFLICT (id) DO NOTHING;

-- Seed system issues
INSERT INTO system_issues (id, title, type, priority, status, reported_by, reported_date, description)
VALUES
  ('ISS-001', 'Engineer login delay', 'Authentication', 'High', 'Open', 'Kasun Perera', '2026-04-20', 'Engineer portal takes too long to redirect after login.'),
  ('ISS-002', 'Risk chart not loading', 'Dashboard', 'Medium', 'In Progress', 'System Monitor', '2026-04-22', 'Analytics chart sometimes fails to render on dashboard.'),
  ('ISS-003', 'Email reset alert not received', 'Email Service', 'Low', 'Resolved', 'Admin', '2026-04-23', 'Forgot password verification email was delayed.')
ON CONFLICT (id) DO NOTHING;

-- Done!
