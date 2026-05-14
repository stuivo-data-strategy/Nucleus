-- ═══════════════════════════════════════════════════
-- FIX POLICY_RULE SCHEMA
-- Allow rules with different field structures (e.g. group meals, mileage)
-- ═══════════════════════════════════════════════════

-- Make max_amount and receipt_threshold optional so rules like mileage_rate can omit them
DEFINE FIELD OVERWRITE max_amount ON policy_rule TYPE option<float>;
DEFINE FIELD OVERWRITE receipt_threshold ON policy_rule TYPE option<float>;

-- Add fields used by advanced policy rules (group meals, mileage, etc.)
DEFINE FIELD OVERWRITE name ON policy_rule TYPE option<string>;
DEFINE FIELD OVERWRITE field ON policy_rule TYPE option<string>;
DEFINE FIELD OVERWRITE operator ON policy_rule TYPE option<string>;
DEFINE FIELD OVERWRITE value ON policy_rule TYPE option<float>;
DEFINE FIELD OVERWRITE severity ON policy_rule TYPE option<string>;
DEFINE FIELD OVERWRITE message ON policy_rule TYPE option<string>;

-- Remove UNIQUE constraint on category — multiple rules can share a category
REMOVE INDEX IF EXISTS idx_policy_cat ON policy_rule;
DEFINE INDEX IF NOT EXISTS idx_policy_cat ON policy_rule FIELDS category;

-- Fix owns_vehicle: was SCHEMAFULL without TYPE RELATION, preventing RELATE statements
REMOVE TABLE IF EXISTS owns_vehicle;
DEFINE TABLE owns_vehicle SCHEMALESS TYPE RELATION IN person OUT vehicle;
