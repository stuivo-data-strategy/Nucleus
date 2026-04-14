-- VAT fields on expense_claim (table is SCHEMALESS so nested objects need no explicit definition)
DEFINE FIELD IF NOT EXISTS vat_status            ON TABLE expense_claim TYPE option<string> DEFAULT 'pending_classification';
DEFINE FIELD IF NOT EXISTS vat_classification    ON TABLE expense_claim TYPE option<string>;
DEFINE FIELD IF NOT EXISTS vat_reclaimable_amount ON TABLE expense_claim TYPE option<float>;
DEFINE FIELD IF NOT EXISTS vat_business_portion  ON TABLE expense_claim TYPE option<float>;
DEFINE FIELD IF NOT EXISTS supplier_vat_number   ON TABLE expense_claim TYPE option<string>;
DEFINE FIELD IF NOT EXISTS vat_classified_by     ON TABLE expense_claim TYPE option<record<person>>;
DEFINE FIELD IF NOT EXISTS vat_classified_at     ON TABLE expense_claim TYPE option<datetime>;
DEFINE FIELD IF NOT EXISTS vat_period            ON TABLE expense_claim TYPE option<string>;

-- Index for fast VAT queue lookups
DEFINE INDEX IF NOT EXISTS idx_claim_vat_status ON TABLE expense_claim FIELDS vat_status;
DEFINE INDEX IF NOT EXISTS idx_claim_vat_period ON TABLE expense_claim FIELDS vat_period;
