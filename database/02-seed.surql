-- ═══════════════════════════════════════════════════════════════════════════
-- NUCLEUS — SEED DATA
-- Org units, cost centres, job classifications, people, graph edges, roles
-- Safe to re-run: uses UPSERT and DELETEs edges before re-creating
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════
-- JOB CLASSIFICATIONS
-- ═══════════════════════════════════════════════════

UPSERT job_classification:x3 MERGE {
  family: 'Executive', title: 'C-Suite', grade: 'X3',
  employee_class: 'full_time',
  pay_range: { min: 150000, mid: 200000, max: 250000, currency: 'GBP' }
};
UPSERT job_classification:m4 MERGE {
  family: 'Management', title: 'Director', grade: 'M4',
  employee_class: 'full_time',
  pay_range: { min: 100000, mid: 120000, max: 150000, currency: 'GBP' }
};
UPSERT job_classification:m3 MERGE {
  family: 'Management', title: 'Head of Department', grade: 'M3',
  employee_class: 'full_time',
  pay_range: { min: 80000, mid: 95000, max: 110000, currency: 'GBP' }
};
UPSERT job_classification:m1 MERGE {
  family: 'Management', title: 'Team Lead', grade: 'M1',
  employee_class: 'full_time',
  pay_range: { min: 70000, mid: 80000, max: 90000, currency: 'GBP' }
};
UPSERT job_classification:t4 MERGE {
  family: 'Technical', title: 'Senior Technical', grade: 'T4',
  employee_class: 'full_time',
  pay_range: { min: 60000, mid: 70000, max: 80000, currency: 'GBP' }
};
UPSERT job_classification:t3 MERGE {
  family: 'Technical', title: 'Mid Technical', grade: 'T3',
  employee_class: 'full_time',
  pay_range: { min: 45000, mid: 55000, max: 65000, currency: 'GBP' }
};
UPSERT job_classification:e4 MERGE {
  family: 'Engineering', title: 'Senior Engineer', grade: 'E4',
  employee_class: 'full_time',
  pay_range: { min: 65000, mid: 75000, max: 85000, currency: 'GBP' }
};
UPSERT job_classification:e3 MERGE {
  family: 'Engineering', title: 'Engineer', grade: 'E3',
  employee_class: 'full_time',
  pay_range: { min: 50000, mid: 60000, max: 70000, currency: 'GBP' }
};


-- ═══════════════════════════════════════════════════
-- ORG UNITS
-- ═══════════════════════════════════════════════════

-- Company
UPSERT org_unit:meridian MERGE { type: 'company', code: 'MEG', name: 'Meridian Engineering Group', status: 'active', head: 'person:margaret_thornton' };

-- Business Units
UPSERT org_unit:tech_data MERGE { type: 'business_unit', code: 'BU-TD', name: 'Technology & Data', parent: 'org_unit:meridian', status: 'active', head: 'person:richard_keane' };
UPSERT org_unit:ops MERGE { type: 'business_unit', code: 'BU-OP', name: 'Operations', parent: 'org_unit:meridian', status: 'active', head: 'person:david_hargreaves' };
UPSERT org_unit:corp_services MERGE { type: 'business_unit', code: 'BU-CS', name: 'Corporate Services', parent: 'org_unit:meridian', status: 'active', head: 'person:amara_okafor' };
UPSERT org_unit:commercial MERGE { type: 'business_unit', code: 'BU-CM', name: 'Commercial', parent: 'org_unit:meridian', status: 'active' };

-- Divisions
UPSERT org_unit:ai_data MERGE { type: 'division', code: 'DIV-AID', name: 'Digital Delivery', parent: 'org_unit:tech_data', status: 'active', head: 'person:peter_blackwell' };
UPSERT org_unit:it_ops MERGE { type: 'division', code: 'DIV-ITO', name: 'IT Operations', parent: 'org_unit:tech_data', status: 'active' };
UPSERT org_unit:sw_dev MERGE { type: 'division', code: 'DIV-SWD', name: 'Software Development', parent: 'org_unit:tech_data', status: 'active' };
UPSERT org_unit:project_del MERGE { type: 'division', code: 'DIV-PRD', name: 'Project Delivery', parent: 'org_unit:ops', status: 'active' };
UPSERT org_unit:health_safety MERGE { type: 'division', code: 'DIV-HSE', name: 'Health & Safety', parent: 'org_unit:ops', status: 'active' };
UPSERT org_unit:finance_div MERGE { type: 'division', code: 'DIV-FIN', name: 'Finance', parent: 'org_unit:corp_services', status: 'active' };
UPSERT org_unit:hr_div MERGE { type: 'division', code: 'DIV-HR', name: 'HR', parent: 'org_unit:corp_services', status: 'active' };
UPSERT org_unit:bus_dev MERGE { type: 'division', code: 'DIV-BD', name: 'Business Development', parent: 'org_unit:commercial', status: 'active' };

-- Departments
UPSERT org_unit:data_analytics MERGE { type: 'department', code: 'DEP-DA', name: 'Digital Delivery', parent: 'org_unit:ai_data', status: 'active', head: 'person:james_morton' };
UPSERT org_unit:ai_engineering MERGE { type: 'department', code: 'DEP-AIE', name: 'AI Engineering', parent: 'org_unit:ai_data', status: 'active' };
UPSERT org_unit:data_engineering MERGE { type: 'department', code: 'DEP-DE', name: 'Data Engineering', parent: 'org_unit:ai_data', status: 'active' };
UPSERT org_unit:civil_eng MERGE { type: 'department', code: 'DEP-CIV', name: 'Civil Engineering', parent: 'org_unit:project_del', status: 'active' };
UPSERT org_unit:mech_eng MERGE { type: 'department', code: 'DEP-MEC', name: 'Mechanical Engineering', parent: 'org_unit:project_del', status: 'active' };
UPSERT org_unit:people_ops MERGE { type: 'department', code: 'DEP-POP', name: 'People Operations', parent: 'org_unit:hr_div', status: 'active' };
UPSERT org_unit:talent_acq MERGE { type: 'department', code: 'DEP-TA', name: 'Talent Acquisition', parent: 'org_unit:hr_div', status: 'active' };


-- ═══════════════════════════════════════════════════
-- COST CENTRES
-- ═══════════════════════════════════════════════════

UPSERT cost_centre:cc1000 MERGE { code: 'CC-1000', name: 'Technology & Data General', owner: 'person:richard_keane' };
UPSERT cost_centre:cc1010 MERGE { code: 'CC-1010', name: 'Digital Delivery Division', parent: 'cost_centre:cc1000', owner: 'person:peter_blackwell' };
UPSERT cost_centre:cc1011 MERGE { code: 'CC-1011', name: 'Digital Delivery', parent: 'cost_centre:cc1010', owner: 'person:james_morton' };
UPSERT cost_centre:cc1012 MERGE { code: 'CC-1012', name: 'AI Engineering', parent: 'cost_centre:cc1010' };
UPSERT cost_centre:cc2000 MERGE { code: 'CC-2000', name: 'Operations General', owner: 'person:david_hargreaves' };
UPSERT cost_centre:cc3000 MERGE { code: 'CC-3000', name: 'Corporate Services General', owner: 'person:amara_okafor' };
UPSERT cost_centre:cc4000 MERGE { code: 'CC-4000', name: 'Commercial General' };


-- ═══════════════════════════════════════════════════
-- RBAC ROLES
-- ═══════════════════════════════════════════════════

UPSERT role:employee MERGE { name: 'employee', permissions: ['expenses:create:own', 'expenses:read:own', 'org:read:all', 'people:read:basic'] };
UPSERT role:manager MERGE { name: 'manager', permissions: ['expenses:approve:team', 'people:read:team'] };
UPSERT role:hr_admin MERGE { name: 'hr_admin', permissions: ['people:read:all', 'people:write:all'] };
UPSERT role:finance_approver MERGE { name: 'finance_approver', permissions: ['expenses:approve:all', 'expenses:read:all'] };
UPSERT role:expenses_auditor MERGE { name: 'expenses_auditor', permissions: ['expenses:audit:all', 'expenses:read:all'] };
UPSERT role:vat_officer MERGE { name: 'vat_officer', permissions: ['vat:classify:all', 'vat:read:all', 'expenses:read:all'] };
UPSERT role:system_admin MERGE { name: 'system_admin', permissions: ['*:*:*'] };


-- ═══════════════════════════════════════════════════
-- PEOPLE (named personas used by the demo)
-- Note: ~50 additional random people are created by seed.ts
-- Only the named personas are included here
-- ═══════════════════════════════════════════════════

-- Executives
UPSERT person:margaret_thornton MERGE { employee_id: 'EMP-1001', first_name: 'Margaret', last_name: 'Thornton', email: 'margaret.thornton@meridian.local', org_unit: 'org_unit:meridian', cost_centre: 'cost_centre:cc1000', job_title: 'CEO', start_date: d'2022-01-01T00:00:00Z', status: 'active', employment_type: 'permanent', fte: 1.0 };
UPSERT person:david_hargreaves MERGE { employee_id: 'EMP-1002', first_name: 'David', last_name: 'Hargreaves', email: 'david.hargreaves@meridian.local', org_unit: 'org_unit:ops', cost_centre: 'cost_centre:cc2000', manager: 'person:margaret_thornton', job_title: 'COO', start_date: d'2022-01-01T00:00:00Z', status: 'active', employment_type: 'permanent', fte: 1.0 };
UPSERT person:amara_okafor MERGE { employee_id: 'EMP-1003', first_name: 'Amara', last_name: 'Okafor', email: 'amara.okafor@meridian.local', org_unit: 'org_unit:corp_services', cost_centre: 'cost_centre:cc3000', manager: 'person:margaret_thornton', job_title: 'CFO', start_date: d'2022-01-01T00:00:00Z', status: 'active', employment_type: 'permanent', fte: 1.0 };
UPSERT person:richard_keane MERGE { employee_id: 'EMP-1004', first_name: 'Richard', last_name: 'Keane', email: 'richard.keane@meridian.local', org_unit: 'org_unit:tech_data', cost_centre: 'cost_centre:cc1000', manager: 'person:margaret_thornton', job_title: 'CTO', start_date: d'2022-01-01T00:00:00Z', status: 'active', employment_type: 'permanent', fte: 1.0 };

-- Tech & Data Leadership
UPSERT person:peter_diciacca MERGE { employee_id: 'EMP-1005', first_name: 'Peter', last_name: 'DiCiacca', email: 'peter.diciacca@meridian.local', org_unit: 'org_unit:tech_data', cost_centre: 'cost_centre:cc1000', manager: 'person:margaret_thornton', job_title: 'Global IT Director', start_date: d'2022-01-01T00:00:00Z', status: 'active', employment_type: 'permanent', fte: 1.0 };
UPSERT person:peter_blackwell MERGE { employee_id: 'EMP-1006', first_name: 'Peter', last_name: 'Passaro', email: 'peter.passaro@meridian.local', org_unit: 'org_unit:ai_data', cost_centre: 'cost_centre:cc1010', manager: 'person:peter_diciacca', job_title: 'Global Director of AI and Data', start_date: d'2022-01-01T00:00:00Z', status: 'active', employment_type: 'permanent', fte: 1.0 };
UPSERT person:james_morton MERGE { employee_id: 'EMP-1007', first_name: 'Stu', last_name: 'Morris', email: 'stu.morris@meridian.local', org_unit: 'org_unit:data_analytics', cost_centre: 'cost_centre:cc1011', manager: 'person:peter_blackwell', job_title: 'Head of Digital Delivery', start_date: d'2022-01-01T00:00:00Z', status: 'active', employment_type: 'permanent', fte: 1.0 };

-- Demo user (Sarah Chen)
UPSERT person:sarah_chen MERGE { employee_id: 'EMP-1008', first_name: 'Sarah', last_name: 'Chen', email: 'sarah.chen@meridian.local', org_unit: 'org_unit:data_analytics', cost_centre: 'cost_centre:cc1011', manager: 'person:james_morton', job_title: 'Senior Developer', start_date: d'2022-01-01T00:00:00Z', status: 'active', employment_type: 'permanent', fte: 1.0 };

-- Finance team
UPSERT person:lisa_thornton MERGE { employee_id: 'EMP-1009', first_name: 'Lisa', last_name: 'Thornton', email: 'lisa.thornton@meridian.local', org_unit: 'org_unit:finance_div', cost_centre: 'cost_centre:cc3000', manager: 'person:amara_okafor', job_title: 'Expenses Officer', start_date: d'2022-01-01T00:00:00Z', status: 'active', employment_type: 'permanent', fte: 1.0 };
UPSERT person:daniel_frost MERGE { employee_id: 'EMP-1010', first_name: 'Daniel', last_name: 'Frost', email: 'daniel.frost@meridian.local', org_unit: 'org_unit:finance_div', cost_centre: 'cost_centre:cc3000', manager: 'person:amara_okafor', job_title: 'Management Accountant', start_date: d'2022-01-01T00:00:00Z', status: 'active', employment_type: 'permanent', fte: 1.0 };


-- ═══════════════════════════════════════════════════
-- GRAPH EDGES — DELETE FIRST TO PREVENT DUPLICATES
-- ═══════════════════════════════════════════════════

DELETE reports_to;
DELETE holds_position;
DELETE owns_budget;
DELETE has_role;
DELETE owns_vehicle;

-- ── reports_to edges ────────────────────────────────
RELATE person:david_hargreaves->reports_to->person:margaret_thornton SET relationship_type = 'direct';
RELATE person:amara_okafor->reports_to->person:margaret_thornton SET relationship_type = 'direct';
RELATE person:richard_keane->reports_to->person:margaret_thornton SET relationship_type = 'direct';
RELATE person:peter_diciacca->reports_to->person:margaret_thornton SET relationship_type = 'direct';
RELATE person:peter_blackwell->reports_to->person:peter_diciacca SET relationship_type = 'direct';
RELATE person:james_morton->reports_to->person:peter_blackwell SET relationship_type = 'direct';
RELATE person:sarah_chen->reports_to->person:james_morton SET relationship_type = 'direct';
RELATE person:lisa_thornton->reports_to->person:amara_okafor SET relationship_type = 'direct';
RELATE person:daniel_frost->reports_to->person:amara_okafor SET relationship_type = 'direct';

-- ── owns_budget edges ───────────────────────────────
RELATE person:richard_keane->owns_budget->cost_centre:cc1000 SET authority_level = 'full';
RELATE person:peter_blackwell->owns_budget->cost_centre:cc1010 SET authority_level = 'full';
RELATE person:james_morton->owns_budget->cost_centre:cc1011 SET authority_level = 'full';

-- ── has_role edges ──────────────────────────────────
RELATE person:sarah_chen->has_role->role:employee;
RELATE person:james_morton->has_role->role:manager;
RELATE person:margaret_thornton->has_role->role:system_admin;
RELATE person:amara_okafor->has_role->role:finance_approver;
RELATE person:lisa_thornton->has_role->role:expenses_auditor;
RELATE person:daniel_frost->has_role->role:vat_officer;


-- ═══════════════════════════════════════════════════
-- VEHICLES & JOURNEYS (Sarah Chen demo data)
-- ═══════════════════════════════════════════════════

UPSERT vehicle:v1 MERGE { registration: 'LD68 XBY', make: 'Volkswagen Golf', engine_cc: 1400, fuel_type: 'petrol', owner: 'person:sarah_chen' };
UPSERT vehicle:v2 MERGE { registration: 'EA71 KWT', make: 'Tesla Model 3', engine_cc: 0, fuel_type: 'electric', owner: 'person:sarah_chen' };

RELATE person:sarah_chen->owns_vehicle->vehicle:v1;
RELATE person:sarah_chen->owns_vehicle->vehicle:v2;

UPSERT saved_journey:j1 MERGE { label: 'Home to Manchester Office', from_address: 'WA14 2DT', to_address: 'M2 3AW', distance_miles: 16.5, owner: 'person:sarah_chen' };
UPSERT saved_journey:j2 MERGE { label: 'Office to Client Site (Leeds)', from_address: 'M2 3AW', to_address: 'LS1 1UR', distance_miles: 44.2, owner: 'person:sarah_chen' };
UPSERT saved_journey:j3 MERGE { label: 'Home to London Office', from_address: 'WA14 2DT', to_address: 'EC2V 7RS', distance_miles: 198.5, owner: 'person:sarah_chen' };

UPSERT mileage_summary:sarah_2025 MERGE { person: 'person:sarah_chen', tax_year: '2025-26', total_miles: 8750.0 };
