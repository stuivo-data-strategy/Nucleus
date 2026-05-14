-- ═══════════════════════════════════════════════════
-- FIX DUPLICATE POLICY RULES
-- Remove max_amount from validation-only rules (e.g. group_meals, mileage_rate)
-- that accidentally received it from the admin edit flow.
-- Also re-seed the canonical spending-limit rules to ensure correct data.
-- ═══════════════════════════════════════════════════

-- Strip spending-limit fields from validation-only rules
UPDATE policy_rule:group_meals SET max_amount = NONE, receipt_threshold = NONE, per_diem_rate = NONE;
UPDATE policy_rule:mileage_rate SET max_amount = NONE, receipt_threshold = NONE, per_diem_rate = NONE;

-- Re-seed the canonical meals spending-limit rule to ensure it has all fields
UPSERT policy_rule:meals MERGE {
  category: 'meals',
  max_amount: 75,
  receipt_threshold: 15,
  per_diem_rate: 30,
  gl_code: '6100',
  vat_rate: 0.20,
  description: 'Meals limit'
};
