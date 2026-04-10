-- ═══════════════════════════════════════════════════
-- NUCLEUS FOUNDATION SCHEMA v1.0
-- ═══════════════════════════════════════════════════

-- ── Organisation Hierarchy ──────────────────────────

DEFINE TABLE IF NOT EXISTS org_unit SCHEMALESS;
DEFINE FIELD IF NOT EXISTS type ON org_unit TYPE string ASSERT $value IN ['company', 'business_unit', 'division', 'department', 'team'];
DEFINE FIELD IF NOT EXISTS code ON org_unit TYPE string;
DEFINE FIELD IF NOT EXISTS name ON org_unit TYPE string;
DEFINE FIELD IF NOT EXISTS parent ON org_unit TYPE option<string|record<org_unit>>;
DEFINE FIELD IF NOT EXISTS head ON org_unit TYPE option<string|record<person>>;
DEFINE FIELD IF NOT EXISTS cost_centres ON org_unit TYPE option<array<record<cost_centre>>>;
DEFINE FIELD IF NOT EXISTS status ON org_unit TYPE string DEFAULT 'active' ASSERT $value IN ['active', 'inactive'];
DEFINE FIELD IF NOT EXISTS metadata ON org_unit TYPE option<object>;
DEFINE FIELD IF NOT EXISTS created_at ON org_unit TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS updated_at ON org_unit TYPE datetime DEFAULT time::now();
DEFINE INDEX IF NOT EXISTS idx_org_unit_code ON org_unit FIELDS code UNIQUE;
DEFINE INDEX IF NOT EXISTS idx_org_unit_type ON org_unit FIELDS type;
DEFINE INDEX IF NOT EXISTS idx_org_unit_parent ON org_unit FIELDS parent;

-- ── Cost Centre ─────────────────────────────────────

DEFINE TABLE IF NOT EXISTS cost_centre SCHEMALESS;
DEFINE FIELD IF NOT EXISTS code ON cost_centre TYPE string;
DEFINE FIELD IF NOT EXISTS name ON cost_centre TYPE string;
DEFINE FIELD IF NOT EXISTS owner ON cost_centre TYPE option<string|record<person>>;
DEFINE FIELD IF NOT EXISTS parent ON cost_centre TYPE option<string|record<cost_centre>>;
DEFINE FIELD IF NOT EXISTS budget_year ON cost_centre TYPE option<int>;
DEFINE FIELD IF NOT EXISTS status ON cost_centre TYPE string DEFAULT 'active' ASSERT $value IN ['active', 'inactive'];
DEFINE FIELD IF NOT EXISTS created_at ON cost_centre TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS updated_at ON cost_centre TYPE datetime DEFAULT time::now();
DEFINE INDEX IF NOT EXISTS idx_cc_code ON cost_centre FIELDS code UNIQUE;
DEFINE INDEX IF NOT EXISTS idx_cc_owner ON cost_centre FIELDS owner;

-- ── Job Classification ──────────────────────────────

DEFINE TABLE IF NOT EXISTS job_classification SCHEMALESS;
DEFINE FIELD IF NOT EXISTS family ON job_classification TYPE string;
DEFINE FIELD IF NOT EXISTS title ON job_classification TYPE string;
DEFINE FIELD IF NOT EXISTS grade ON job_classification TYPE string;
DEFINE FIELD IF NOT EXISTS standard_hours ON job_classification TYPE float DEFAULT 37.5;
DEFINE FIELD IF NOT EXISTS employee_class ON job_classification TYPE string DEFAULT 'full_time' ASSERT $value IN ['full_time', 'part_time', 'contractor', 'fixed_term'];
DEFINE FIELD IF NOT EXISTS pay_range ON job_classification TYPE object;
  -- pay_range: { min: number, mid: number, max: number, currency: string }
DEFINE FIELD IF NOT EXISTS skills ON job_classification TYPE option<array<string>>;
DEFINE FIELD IF NOT EXISTS created_at ON job_classification TYPE datetime DEFAULT time::now();
DEFINE INDEX IF NOT EXISTS idx_job_class_grade ON job_classification FIELDS grade;
DEFINE INDEX IF NOT EXISTS idx_job_class_family ON job_classification FIELDS family;

-- ── Position ────────────────────────────────────────

DEFINE TABLE IF NOT EXISTS position SCHEMALESS;
DEFINE FIELD IF NOT EXISTS position_id ON position TYPE string;
DEFINE FIELD IF NOT EXISTS title ON position TYPE string;
DEFINE FIELD IF NOT EXISTS job_classification ON position TYPE option<string|record<job_classification>>;
DEFINE FIELD IF NOT EXISTS org_unit ON position TYPE string|record<org_unit>;
DEFINE FIELD IF NOT EXISTS cost_centre ON position TYPE option<string|record<cost_centre>>;
DEFINE FIELD IF NOT EXISTS fte_capacity ON position TYPE float DEFAULT 1.0;
DEFINE FIELD IF NOT EXISTS fte_filled ON position TYPE float DEFAULT 0.0;
DEFINE FIELD IF NOT EXISTS allow_multiple_incumbents ON position TYPE bool DEFAULT false;
DEFINE FIELD IF NOT EXISTS vacancy_status ON position TYPE string DEFAULT 'vacant' ASSERT $value IN ['vacant', 'filled', 'partially_filled', 'frozen'];
DEFINE FIELD IF NOT EXISTS parent_position ON position TYPE option<string|record<position>>;
DEFINE FIELD IF NOT EXISTS status ON position TYPE string DEFAULT 'active' ASSERT $value IN ['active', 'inactive', 'frozen'];
DEFINE FIELD IF NOT EXISTS metadata ON position TYPE option<object>;
DEFINE FIELD IF NOT EXISTS created_at ON position TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS updated_at ON position TYPE datetime DEFAULT time::now();
DEFINE INDEX IF NOT EXISTS idx_position_id ON position FIELDS position_id UNIQUE;
DEFINE INDEX IF NOT EXISTS idx_position_org ON position FIELDS org_unit;
DEFINE INDEX IF NOT EXISTS idx_position_vacancy ON position FIELDS vacancy_status;
DEFINE INDEX IF NOT EXISTS idx_position_parent ON position FIELDS parent_position;

-- ── Person ──────────────────────────────────────────

DEFINE TABLE IF NOT EXISTS person SCHEMALESS;
DEFINE FIELD IF NOT EXISTS employee_id ON person TYPE string;
DEFINE FIELD IF NOT EXISTS entra_oid ON person TYPE option<string>;  -- Azure AD Object ID for SSO mapping
DEFINE FIELD IF NOT EXISTS first_name ON person TYPE string;
DEFINE FIELD IF NOT EXISTS last_name ON person TYPE string;
DEFINE FIELD IF NOT EXISTS email ON person TYPE string;
DEFINE FIELD IF NOT EXISTS position ON person TYPE option<string|record<position>>;
DEFINE FIELD IF NOT EXISTS org_unit ON person TYPE string|record<org_unit>;
DEFINE FIELD IF NOT EXISTS cost_centre ON person TYPE string|record<cost_centre>;
DEFINE FIELD IF NOT EXISTS manager ON person TYPE option<string|record<person>>;
DEFINE FIELD IF NOT EXISTS job_title ON person TYPE string;
DEFINE FIELD IF NOT EXISTS grade ON person TYPE option<string>;
DEFINE FIELD IF NOT EXISTS start_date ON person TYPE datetime;
DEFINE FIELD IF NOT EXISTS end_date ON person TYPE option<datetime>;
DEFINE FIELD IF NOT EXISTS status ON person TYPE string DEFAULT 'active' ASSERT $value IN ['active', 'on_leave', 'suspended', 'terminated'];
DEFINE FIELD IF NOT EXISTS employment_type ON person TYPE string DEFAULT 'permanent' ASSERT $value IN ['permanent', 'fixed_term', 'contractor', 'intern'];
DEFINE FIELD IF NOT EXISTS fte ON person TYPE float DEFAULT 1.0;
DEFINE FIELD IF NOT EXISTS avatar_url ON person TYPE option<string>;
DEFINE FIELD IF NOT EXISTS phone ON person TYPE option<string>;
DEFINE FIELD IF NOT EXISTS location ON person TYPE option<string>;
DEFINE FIELD IF NOT EXISTS metadata ON person TYPE option<object>;
DEFINE FIELD IF NOT EXISTS created_at ON person TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS updated_at ON person TYPE datetime DEFAULT time::now();
DEFINE INDEX IF NOT EXISTS idx_person_empid ON person FIELDS employee_id UNIQUE;
DEFINE INDEX IF NOT EXISTS idx_person_email ON person FIELDS email UNIQUE;
DEFINE INDEX IF NOT EXISTS idx_person_entra ON person FIELDS entra_oid UNIQUE;
DEFINE INDEX IF NOT EXISTS idx_person_manager ON person FIELDS manager;
DEFINE INDEX IF NOT EXISTS idx_person_org ON person FIELDS org_unit;
DEFINE INDEX IF NOT EXISTS idx_person_status ON person FIELDS status;

-- ── Employment History ──────────────────────────────
-- Immutable log of every lifecycle event

DEFINE TABLE IF NOT EXISTS employment_event SCHEMALESS;
DEFINE FIELD IF NOT EXISTS person ON employment_event TYPE string|record<person>;
DEFINE FIELD IF NOT EXISTS event_type ON employment_event TYPE string ASSERT $value IN ['hire', 'promotion', 'demotion', 'transfer', 'role_change', 'grade_change', 'cost_centre_change', 'manager_change', 'leave_start', 'leave_end', 'termination', 'rehire'];
DEFINE FIELD IF NOT EXISTS effective_date ON employment_event TYPE datetime;
DEFINE FIELD IF NOT EXISTS changes ON employment_event TYPE object;
  -- changes: { field: { from: any, to: any } }
DEFINE FIELD IF NOT EXISTS reason ON employment_event TYPE option<string>;
DEFINE FIELD IF NOT EXISTS initiated_by ON employment_event TYPE option<string|record<person>>;
DEFINE FIELD IF NOT EXISTS created_at ON employment_event TYPE datetime DEFAULT time::now();
DEFINE INDEX IF NOT EXISTS idx_event_person ON employment_event FIELDS person;
DEFINE INDEX IF NOT EXISTS idx_event_type ON employment_event FIELDS event_type;
DEFINE INDEX IF NOT EXISTS idx_event_date ON employment_event FIELDS effective_date;

-- ═══════════════════════════════════════════════════
-- GRAPH EDGES
-- ═══════════════════════════════════════════════════

-- ── REPORTS_TO: Person → Person ─────────────────────
DEFINE TABLE IF NOT EXISTS reports_to SCHEMALESS TYPE RELATION IN person OUT person;
DEFINE FIELD IF NOT EXISTS effective_from ON reports_to TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS effective_to ON reports_to TYPE option<datetime>;
DEFINE FIELD IF NOT EXISTS relationship_type ON reports_to TYPE string DEFAULT 'direct' ASSERT $value IN ['direct', 'matrix', 'dotted_line'];

-- ── HOLDS_POSITION: Person → Position ───────────────
DEFINE TABLE IF NOT EXISTS holds_position SCHEMALESS TYPE RELATION IN person OUT position;
DEFINE FIELD IF NOT EXISTS effective_from ON holds_position TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS effective_to ON holds_position TYPE option<datetime>;
DEFINE FIELD IF NOT EXISTS fte_allocation ON holds_position TYPE float DEFAULT 1.0;
DEFINE FIELD IF NOT EXISTS is_primary ON holds_position TYPE bool DEFAULT true;

-- ── OWNS_BUDGET: Person → CostCentre ────────────────
DEFINE TABLE IF NOT EXISTS owns_budget SCHEMALESS TYPE RELATION IN person OUT cost_centre;
DEFINE FIELD IF NOT EXISTS effective_from ON owns_budget TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS effective_to ON owns_budget TYPE option<datetime>;
DEFINE FIELD IF NOT EXISTS authority_level ON owns_budget TYPE string DEFAULT 'full' ASSERT $value IN ['full', 'delegate', 'view_only'];

-- ═══════════════════════════════════════════════════
-- APPROVAL WORKFLOW ENGINE
-- ═══════════════════════════════════════════════════

-- ── Workflow Template ───────────────────────────────
-- Configurable workflow definitions (e.g. "expense_approval", "leave_request")

DEFINE TABLE IF NOT EXISTS workflow_template SCHEMALESS;
DEFINE FIELD IF NOT EXISTS name ON workflow_template TYPE string;
DEFINE FIELD IF NOT EXISTS module ON workflow_template TYPE string ASSERT $value IN ['expenses', 'timesheets', 'absence', 'recruiting', 'onboarding', 'performance', 'compensation', 'general'];
DEFINE FIELD IF NOT EXISTS description ON workflow_template TYPE option<string>;
DEFINE FIELD IF NOT EXISTS steps ON workflow_template TYPE array<object>;
  -- steps: [{ order: int, resolver: string, resolver_config: object, action: string, can_delegate: bool, sla_hours: int }]
  -- resolver types: 'direct_manager', 'cost_centre_owner', 'org_unit_head', 'specific_person', 'specific_role', 'budget_threshold'
DEFINE FIELD IF NOT EXISTS conditions ON workflow_template TYPE option<object>;
  -- conditions: { min_amount: number, max_amount: number, categories: string[], org_units: string[] }
DEFINE FIELD IF NOT EXISTS status ON workflow_template TYPE string DEFAULT 'active' ASSERT $value IN ['active', 'inactive', 'draft'];
DEFINE FIELD IF NOT EXISTS created_at ON workflow_template TYPE datetime DEFAULT time::now();
DEFINE INDEX IF NOT EXISTS idx_wf_template_module ON workflow_template FIELDS module;
DEFINE INDEX IF NOT EXISTS idx_wf_template_name ON workflow_template FIELDS name UNIQUE;

-- ── Workflow Instance ───────────────────────────────
-- A specific request moving through an approval chain

DEFINE TABLE IF NOT EXISTS workflow_instance SCHEMALESS;
DEFINE FIELD IF NOT EXISTS template ON workflow_instance TYPE string|record<workflow_template>;
DEFINE FIELD IF NOT EXISTS initiator ON workflow_instance TYPE string|record<person>;
DEFINE FIELD IF NOT EXISTS subject_type ON workflow_instance TYPE string;
  -- e.g. 'expense_claim', 'absence_request', 'requisition'
DEFINE FIELD IF NOT EXISTS subject_id ON workflow_instance TYPE string;
  -- Record ID of the thing being approved
DEFINE FIELD IF NOT EXISTS current_step ON workflow_instance TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS total_steps ON workflow_instance TYPE int;
DEFINE FIELD IF NOT EXISTS status ON workflow_instance TYPE string DEFAULT 'pending' ASSERT $value IN ['pending', 'in_progress', 'approved', 'rejected', 'queried', 'cancelled', 'escalated'];
DEFINE FIELD IF NOT EXISTS steps ON workflow_instance TYPE array<object>;
  -- Resolved steps with actual approver assignments:
  -- [{ order: int, approver: record<person>, status: string, acted_at: datetime, note: string, delegated_from: record<person> }]
DEFINE FIELD IF NOT EXISTS created_at ON workflow_instance TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS updated_at ON workflow_instance TYPE datetime DEFAULT time::now();
DEFINE INDEX IF NOT EXISTS idx_wf_instance_initiator ON workflow_instance FIELDS initiator;
DEFINE INDEX IF NOT EXISTS idx_wf_instance_status ON workflow_instance FIELDS status;
DEFINE INDEX IF NOT EXISTS idx_wf_instance_subject ON workflow_instance FIELDS subject_type, subject_id;

-- ── Workflow Action Log ─────────────────────────────
-- Immutable audit trail of every action on every workflow

DEFINE TABLE IF NOT EXISTS workflow_action SCHEMALESS;
DEFINE FIELD IF NOT EXISTS instance ON workflow_action TYPE string|record<workflow_instance>;
DEFINE FIELD IF NOT EXISTS step ON workflow_action TYPE int;
DEFINE FIELD IF NOT EXISTS actor ON workflow_action TYPE string|record<person>;
DEFINE FIELD IF NOT EXISTS action ON workflow_action TYPE string ASSERT $value IN ['approve', 'reject', 'query', 'respond', 'delegate', 'escalate', 'cancel', 'resubmit'];
DEFINE FIELD IF NOT EXISTS note ON workflow_action TYPE option<string>;
DEFINE FIELD IF NOT EXISTS created_at ON workflow_action TYPE datetime DEFAULT time::now();
DEFINE INDEX IF NOT EXISTS idx_wf_action_instance ON workflow_action FIELDS instance;

-- ═══════════════════════════════════════════════════
-- BUSINESS RULES ENGINE
-- ═══════════════════════════════════════════════════

DEFINE TABLE IF NOT EXISTS business_rule SCHEMALESS;
DEFINE FIELD IF NOT EXISTS name ON business_rule TYPE string;
DEFINE FIELD IF NOT EXISTS module ON business_rule TYPE string;
DEFINE FIELD IF NOT EXISTS trigger_event ON business_rule TYPE string;
  -- e.g. 'job_classification_change', 'expense_submitted', 'absence_requested'
DEFINE FIELD IF NOT EXISTS conditions ON business_rule TYPE option<object>;
  -- JSON conditions evaluated at runtime
DEFINE FIELD IF NOT EXISTS actions ON business_rule TYPE array<object>;
  -- [{ type: 'set_field', target: string, value: any }, { type: 'route_workflow', template: string }]
DEFINE FIELD IF NOT EXISTS priority ON business_rule TYPE int DEFAULT 100;
DEFINE FIELD IF NOT EXISTS status ON business_rule TYPE string DEFAULT 'active';
DEFINE FIELD IF NOT EXISTS created_at ON business_rule TYPE datetime DEFAULT time::now();
DEFINE INDEX IF NOT EXISTS idx_rule_module ON business_rule FIELDS module;
DEFINE INDEX IF NOT EXISTS idx_rule_trigger ON business_rule FIELDS trigger_event;

-- ═══════════════════════════════════════════════════
-- NOTIFICATION SYSTEM
-- ═══════════════════════════════════════════════════

DEFINE TABLE IF NOT EXISTS notification SCHEMALESS;
DEFINE FIELD IF NOT EXISTS recipient ON notification TYPE string|record<person>;
DEFINE FIELD IF NOT EXISTS type ON notification TYPE string ASSERT $value IN ['approval_request', 'approval_result', 'query', 'info', 'reminder', 'escalation'];
DEFINE FIELD IF NOT EXISTS channel ON notification TYPE string DEFAULT 'in_app' ASSERT $value IN ['in_app', 'teams', 'email'];
DEFINE FIELD IF NOT EXISTS title ON notification TYPE string;
DEFINE FIELD IF NOT EXISTS body ON notification TYPE string;
DEFINE FIELD IF NOT EXISTS link ON notification TYPE option<string>;
DEFINE FIELD IF NOT EXISTS related_workflow ON notification TYPE option<string|record<workflow_instance>>;
DEFINE FIELD IF NOT EXISTS read ON notification TYPE bool DEFAULT false;
DEFINE FIELD IF NOT EXISTS delivered ON notification TYPE bool DEFAULT false;
DEFINE FIELD IF NOT EXISTS created_at ON notification TYPE datetime DEFAULT time::now();
DEFINE INDEX IF NOT EXISTS idx_notif_recipient ON notification FIELDS recipient;
DEFINE INDEX IF NOT EXISTS idx_notif_read ON notification FIELDS recipient, read;

-- ═══════════════════════════════════════════════════
-- RBAC
-- ═══════════════════════════════════════════════════

DEFINE TABLE IF NOT EXISTS role SCHEMALESS;
DEFINE FIELD IF NOT EXISTS name ON role TYPE string;
DEFINE FIELD IF NOT EXISTS description ON role TYPE option<string>;
DEFINE FIELD IF NOT EXISTS permissions ON role TYPE array<string>;
  -- Permission format: 'module:action:scope'
  -- e.g. 'expenses:approve:team', 'org:read:all', 'positions:write:own_department'
DEFINE INDEX IF NOT EXISTS idx_role_name ON role FIELDS name UNIQUE;

DEFINE TABLE IF NOT EXISTS has_role SCHEMALESS TYPE RELATION IN person OUT role;
DEFINE FIELD IF NOT EXISTS granted_at ON has_role TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS granted_by ON has_role TYPE option<string|record<person>>;
