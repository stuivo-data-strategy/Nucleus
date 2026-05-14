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

-- ── User profile — vehicle storage ──────────────────
DEFINE TABLE IF NOT EXISTS vehicle SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS registration ON vehicle TYPE string;
DEFINE FIELD IF NOT EXISTS make        ON vehicle TYPE string;
DEFINE FIELD IF NOT EXISTS engine_cc   ON vehicle TYPE option<int>;
DEFINE FIELD IF NOT EXISTS fuel_type   ON vehicle TYPE string
  ASSERT $value IN ['petrol','diesel','electric','hybrid'];
DEFINE FIELD IF NOT EXISTS owner       ON vehicle TYPE string|record<person>;

DEFINE TABLE IF NOT EXISTS owns_vehicle SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS in  ON owns_vehicle TYPE string|record<person>;
DEFINE FIELD IF NOT EXISTS out ON owns_vehicle TYPE string|record<vehicle>;

-- ── User profile — saved journeys ───────────────────
DEFINE TABLE IF NOT EXISTS saved_journey SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS label         ON saved_journey TYPE string;
DEFINE FIELD IF NOT EXISTS from_address  ON saved_journey TYPE string;
DEFINE FIELD IF NOT EXISTS to_address    ON saved_journey TYPE string;
DEFINE FIELD IF NOT EXISTS distance_miles ON saved_journey TYPE option<float>;
DEFINE FIELD IF NOT EXISTS owner         ON saved_journey TYPE string|record<person>;
DEFINE FIELD IF NOT EXISTS use_count     ON saved_journey TYPE int DEFAULT 0;

-- ── Cumulative mileage tracking ─────────────────────
DEFINE TABLE IF NOT EXISTS mileage_summary SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS person       ON mileage_summary TYPE string|record<person>;
DEFINE FIELD IF NOT EXISTS tax_year     ON mileage_summary TYPE string;
DEFINE FIELD IF NOT EXISTS total_miles  ON mileage_summary TYPE float DEFAULT 0.0;
DEFINE FIELD IF NOT EXISTS last_updated ON mileage_summary TYPE datetime DEFAULT time::now();

-- ── Expense claim — new fields ──────────────────────
DEFINE FIELD IF NOT EXISTS claim_type   ON expense_claim TYPE string
  ASSERT $value IN ['single','batch','group','mileage']
  DEFAULT 'single';

-- Mileage-specific
DEFINE FIELD IF NOT EXISTS journey_from    ON expense_claim TYPE option<string>;
DEFINE FIELD IF NOT EXISTS journey_to      ON expense_claim TYPE option<string>;
DEFINE FIELD IF NOT EXISTS distance_miles  ON expense_claim TYPE option<float>;
DEFINE FIELD IF NOT EXISTS vehicle         ON expense_claim TYPE option<string|record<vehicle>>;
DEFINE FIELD IF NOT EXISTS mileage_rate    ON expense_claim TYPE option<float>;
DEFINE FIELD IF NOT EXISTS return_journey  ON expense_claim TYPE option<bool>;

-- Group-specific
DEFINE FIELD IF NOT EXISTS attendees       ON expense_claim TYPE option<array<string>>;
DEFINE FIELD IF NOT EXISTS cost_split      ON expense_claim TYPE option<string>
  ASSERT $value IN ['equal','custom'] OR $value IS NONE;
DEFINE FIELD IF NOT EXISTS attendee_amounts ON expense_claim TYPE option<array>;
