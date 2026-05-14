-- Audit fields on expense_claim (table is SCHEMALESS so audit_flag needs no explicit definition)
DEFINE FIELD IF NOT EXISTS audit_status ON TABLE expense_claim TYPE option<string> DEFAULT 'pending_audit';
DEFINE FIELD IF NOT EXISTS audited_by   ON TABLE expense_claim TYPE option<record<person>>;
DEFINE FIELD IF NOT EXISTS audited_at   ON TABLE expense_claim TYPE option<datetime>;

-- Audit action log
DEFINE TABLE IF NOT EXISTS audit_action SCHEMALESS;
DEFINE FIELD IF NOT EXISTS claim      ON TABLE audit_action TYPE record<expense_claim>;
DEFINE FIELD IF NOT EXISTS auditor    ON TABLE audit_action TYPE record<person>;
DEFINE FIELD IF NOT EXISTS action     ON TABLE audit_action TYPE string;
DEFINE FIELD IF NOT EXISTS reason     ON TABLE audit_action TYPE option<string>;
DEFINE FIELD IF NOT EXISTS notes      ON TABLE audit_action TYPE option<string>;
DEFINE FIELD IF NOT EXISTS created_at ON TABLE audit_action TYPE datetime DEFAULT time::now();

-- Index for fast audit queue lookups
DEFINE INDEX IF NOT EXISTS idx_claim_audit_status ON TABLE expense_claim FIELDS audit_status;
