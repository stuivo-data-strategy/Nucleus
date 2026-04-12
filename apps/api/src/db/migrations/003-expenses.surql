-- Expense claim table
DEFINE TABLE IF NOT EXISTS expense_claim SCHEMALESS;
DEFINE FIELD IF NOT EXISTS reference ON expense_claim TYPE string;
DEFINE FIELD IF NOT EXISTS claimant ON expense_claim TYPE record<person>;
DEFINE FIELD IF NOT EXISTS category ON expense_claim TYPE string;
DEFINE FIELD IF NOT EXISTS amount ON expense_claim TYPE number;
DEFINE FIELD IF NOT EXISTS currency ON expense_claim TYPE string;
DEFINE FIELD IF NOT EXISTS description ON expense_claim TYPE string;
DEFINE FIELD IF NOT EXISTS date ON expense_claim TYPE string;
DEFINE FIELD IF NOT EXISTS has_receipt ON expense_claim TYPE bool;
DEFINE FIELD IF NOT EXISTS status ON expense_claim TYPE string;
DEFINE FIELD IF NOT EXISTS created_at ON expense_claim TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS updated_at ON expense_claim TYPE datetime DEFAULT time::now();

-- Policy audit table
DEFINE TABLE IF NOT EXISTS policy_audit SCHEMALESS;

-- Index for fast claimant lookups
DEFINE INDEX IF NOT EXISTS idx_claim_claimant ON expense_claim FIELDS claimant;
DEFINE INDEX IF NOT EXISTS idx_claim_status ON expense_claim FIELDS status;
