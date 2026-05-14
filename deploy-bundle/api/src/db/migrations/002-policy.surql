-- ═══════════════════════════════════════════════════
-- NUCLEUS POLICY SCHEMA v1.0
-- ═══════════════════════════════════════════════════

-- ── Policy Rule ─────────────────────────────────────
-- Configures PBAC enforcement values for expense categories
DEFINE TABLE IF NOT EXISTS policy_rule SCHEMALESS;
DEFINE FIELD IF NOT EXISTS category ON policy_rule TYPE string;
DEFINE FIELD IF NOT EXISTS max_amount ON policy_rule TYPE float;
DEFINE FIELD IF NOT EXISTS receipt_threshold ON policy_rule TYPE float;
DEFINE FIELD IF NOT EXISTS per_diem_rate ON policy_rule TYPE option<float>;
DEFINE FIELD IF NOT EXISTS gl_code ON policy_rule TYPE option<string>;
DEFINE FIELD IF NOT EXISTS vat_rate ON policy_rule TYPE option<float>;
DEFINE FIELD IF NOT EXISTS description ON policy_rule TYPE option<string>;
DEFINE INDEX IF NOT EXISTS idx_policy_cat ON policy_rule FIELDS category UNIQUE;

-- ── Policy Audit ────────────────────────────────────
-- Immutable log of every policy check run
DEFINE TABLE IF NOT EXISTS policy_audit SCHEMALESS;
DEFINE FIELD IF NOT EXISTS claim_id ON policy_audit TYPE string;
DEFINE FIELD IF NOT EXISTS evaluation_point ON policy_audit TYPE string ASSERT $value IN ['capture', 'submission', 'approval_review', 'admin_change'];
DEFINE FIELD IF NOT EXISTS result ON policy_audit TYPE option<object>; -- Stores the validation snapshot
DEFINE FIELD IF NOT EXISTS evaluated_by ON policy_audit TYPE string;
DEFINE FIELD IF NOT EXISTS created_at ON policy_audit TYPE datetime DEFAULT time::now();
DEFINE INDEX IF NOT EXISTS idx_audit_claim ON policy_audit FIELDS claim_id;
