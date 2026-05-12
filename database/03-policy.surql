-- ═══════════════════════════════════════════════════════════════════════════
-- NUCLEUS — POLICY RULES & WORKFLOW TEMPLATES
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════
-- POLICY RULES
-- ═══════════════════════════════════════════════════

UPSERT policy_rule:meals MERGE {
  category: 'meals',
  max_amount: 75,
  receipt_threshold: 15,
  description: 'Meals limit'
};

UPSERT policy_rule:travel MERGE {
  category: 'travel',
  max_amount: 250,
  receipt_threshold: 10,
  description: 'Travel limits including taxis and rail fares'
};

UPSERT policy_rule:accommodation MERGE {
  category: 'accommodation',
  max_amount: 200,
  receipt_threshold: 0,
  description: 'Hotel stay limits per night'
};

UPSERT policy_rule:supplies MERGE {
  category: 'supplies',
  max_amount: 150,
  receipt_threshold: 20,
  description: 'Office supplies'
};

UPSERT policy_rule:group_meals MERGE {
  name: 'Group Meals — Per Head Limit',
  category: 'meals',
  field: 'amount_per_head',
  operator: 'lte',
  value: 75.00,
  severity: 'fail',
  message: 'Group meals must not exceed £75.00 per person'
};

UPSERT policy_rule:mileage_rate MERGE {
  name: 'HMRC Mileage Rate 2025-26',
  category: 'mileage',
  field: 'mileage_rate',
  operator: 'lte',
  value: 0.45,
  severity: 'fail',
  message: 'Mileage rate must not exceed the HMRC approved rate of 45p/mile (25p above 10,000 miles)'
};


-- ═══════════════════════════════════════════════════
-- WORKFLOW TEMPLATES
-- ═══════════════════════════════════════════════════

UPSERT workflow_template:expense_approval MERGE {
  name: 'expense_approval',
  module: 'expenses',
  status: 'active',
  steps: [
    { order: 1, label: 'Direct Manager', resolver: 'direct_manager', action: 'approve' },
    { order: 2, label: 'Cost Centre Owner', resolver: 'cost_centre_owner', action: 'approve', condition: { min_amount: 100 } },
    { order: 3, label: 'Finance Head', resolver: 'role_based', role: 'finance_approver', action: 'approve', condition: { min_amount: 500 } }
  ]
};

UPSERT workflow_template:absence_request MERGE {
  name: 'absence_request',
  module: 'absence',
  status: 'active',
  steps: [
    { order: 1, resolver: 'direct_manager', action: 'approve' }
  ]
};

UPSERT workflow_template:expense_approval_exception MERGE {
  name: 'expense_approval_exception',
  module: 'expenses',
  status: 'active',
  steps: [
    { order: 1, label: 'Senior Manager (Exception)', resolver: 'skip_level_manager', action: 'approve' },
    { order: 2, label: 'Line Manager', resolver: 'direct_manager', action: 'approve' },
    { order: 3, label: 'Cost Centre Owner', resolver: 'cost_centre_owner', action: 'approve', condition: { min_amount: 100 } },
    { order: 4, label: 'Finance', resolver: 'role_based', role: 'finance_approver', action: 'approve', condition: { min_amount: 500 } }
  ]
};


-- ═══════════════════════════════════════════════════
-- BUSINESS RULES
-- ═══════════════════════════════════════════════════

UPSERT business_rule:br1 MERGE {
  name: 'expense_receipt_required',
  module: 'expenses',
  trigger_event: 'expense_submitted',
  priority: 100,
  actions: []
};

UPSERT business_rule:br2 MERGE {
  name: 'absence_manager_approval',
  module: 'absence',
  trigger_event: 'absence_requested',
  priority: 100,
  actions: [{ type: 'route_workflow', template: 'absence_request' }]
};
