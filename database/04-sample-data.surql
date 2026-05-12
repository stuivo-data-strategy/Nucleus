-- ═══════════════════════════════════════════════════════════════════════════
-- NUCLEUS — SAMPLE DATA FOR DEMO
-- Expense claims, workflow instances, audit records
-- Creates a realistic set of claims at various stages of the approval flow
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════
-- EXPENSE CLAIMS (Sarah Chen — the demo user)
-- ═══════════════════════════════════════════════════

-- Approved claim
CREATE expense_claim CONTENT {
  reference: 'EXP-2025-0001',
  claimant: person:sarah_chen,
  category: 'meals',
  amount: 42.50,
  currency: 'GBP',
  description: 'Client lunch — Project Alpha kickoff',
  date: '2025-04-15',
  has_receipt: true,
  status: 'approved',
  claim_type: 'single',
  audit_status: 'cleared',
  vat_status: 'classified',
  vat_classification: 'standard',
  vat_reclaimable_amount: 7.08,
  vat_business_portion: 1.0,
  created_at: d'2025-04-15T09:30:00Z'
};

-- Approved claim
CREATE expense_claim CONTENT {
  reference: 'EXP-2025-0002',
  claimant: person:sarah_chen,
  category: 'travel',
  amount: 186.00,
  currency: 'GBP',
  description: 'Train to London — stakeholder workshop',
  date: '2025-04-22',
  has_receipt: true,
  status: 'approved',
  claim_type: 'single',
  audit_status: 'cleared',
  vat_status: 'classified',
  vat_classification: 'zero_rated',
  vat_reclaimable_amount: 0,
  vat_business_portion: 1.0,
  created_at: d'2025-04-22T07:15:00Z'
};

-- Pending claim
CREATE expense_claim CONTENT {
  reference: 'EXP-2025-0003',
  claimant: person:sarah_chen,
  category: 'accommodation',
  amount: 165.00,
  currency: 'GBP',
  description: 'Premier Inn Manchester — late project session',
  date: '2025-05-02',
  has_receipt: true,
  status: 'pending',
  claim_type: 'single',
  audit_status: 'pending_audit',
  vat_status: 'pending_classification',
  created_at: d'2025-05-02T18:00:00Z'
};

-- Queried claim
CREATE expense_claim CONTENT {
  reference: 'EXP-2025-0004',
  claimant: person:sarah_chen,
  category: 'meals',
  amount: 89.00,
  currency: 'GBP',
  description: 'Team dinner — sprint completion',
  date: '2025-04-28',
  has_receipt: true,
  status: 'queried',
  claim_type: 'single',
  audit_status: 'pending_audit',
  vat_status: 'pending_classification',
  created_at: d'2025-04-28T20:30:00Z'
};

-- Mileage claim
CREATE expense_claim CONTENT {
  reference: 'EXP-2025-0005',
  claimant: person:sarah_chen,
  category: 'mileage',
  amount: 14.85,
  currency: 'GBP',
  description: 'Home to Manchester Office',
  date: '2025-05-05',
  has_receipt: false,
  status: 'pending',
  claim_type: 'mileage',
  journey_from: 'WA14 2DT',
  journey_to: 'M2 3AW',
  distance_miles: 33.0,
  vehicle: 'vehicle:v1',
  mileage_rate: 0.45,
  return_journey: true,
  audit_status: 'pending_audit',
  vat_status: 'not_applicable',
  created_at: d'2025-05-05T08:00:00Z'
};


-- ═══════════════════════════════════════════════════
-- CLAIMS FROM OTHER PEOPLE (for approvals queue)
-- ═══════════════════════════════════════════════════

-- Claim pending approval by James Morton (Sarah's manager approves these)
CREATE expense_claim CONTENT {
  reference: 'EXP-2025-0010',
  claimant: person:sarah_chen,
  category: 'office_supplies',
  amount: 67.99,
  currency: 'GBP',
  description: 'USB-C hub and cables for home office',
  date: '2025-05-01',
  has_receipt: true,
  status: 'submitted',
  claim_type: 'single',
  audit_status: 'pending_audit',
  vat_status: 'pending_classification',
  created_at: d'2025-05-01T14:20:00Z'
};


-- ═══════════════════════════════════════════════════
-- WORKFLOW INSTANCES
-- ═══════════════════════════════════════════════════

-- Workflow for the approved meals claim
CREATE workflow_instance CONTENT {
  template: workflow_template:expense_approval,
  initiator: person:sarah_chen,
  subject_type: 'expense_claim',
  subject_id: 'EXP-2025-0001',
  current_step: 1,
  total_steps: 1,
  status: 'approved',
  steps: [
    { order: 1, approver: person:james_morton, approver_name: 'Stu Morris', status: 'approved', acted_at: d'2025-04-16T10:00:00Z', note: 'Looks good' }
  ],
  created_at: d'2025-04-15T09:30:00Z'
};

-- Workflow for the queried claim
CREATE workflow_instance CONTENT {
  template: workflow_template:expense_approval,
  initiator: person:sarah_chen,
  subject_type: 'expense_claim',
  subject_id: 'EXP-2025-0004',
  current_step: 1,
  total_steps: 1,
  status: 'queried',
  steps: [
    { order: 1, approver: person:james_morton, approver_name: 'Stu Morris', status: 'queried', acted_at: d'2025-04-29T09:15:00Z', note: 'Was this just your team or did it include external guests?' }
  ],
  created_at: d'2025-04-28T20:30:00Z'
};

-- Workflow for the pending accommodation claim
CREATE workflow_instance CONTENT {
  template: workflow_template:expense_approval,
  initiator: person:sarah_chen,
  subject_type: 'expense_claim',
  subject_id: 'EXP-2025-0003',
  current_step: 1,
  total_steps: 2,
  status: 'in_progress',
  steps: [
    { order: 1, approver: person:james_morton, approver_name: 'Stu Morris', status: 'pending' },
    { order: 2, approver: person:peter_blackwell, approver_name: 'Peter Passaro', status: 'pending' }
  ],
  created_at: d'2025-05-02T18:00:00Z'
};


-- ═══════════════════════════════════════════════════
-- AUDIT ACTIONS (for audit trail demo)
-- ═══════════════════════════════════════════════════

-- Note: audit_action records reference expense_claim records by their
-- auto-generated IDs. In a real run, these would be created by the
-- audit service. The sample data above gives the audit screen records
-- to display via the audit_status field on expense_claim.
