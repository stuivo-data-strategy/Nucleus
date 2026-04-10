export interface PolicyRule {
  id: string;
  category: string;
  max_amount: number;
  receipt_threshold: number;
  per_diem_rate?: number;
  gl_code?: string;
  vat_rate?: number;
  description?: string;
}

export interface PolicyCheck {
  rule_id: string;          // policy_rule record ID
  rule_name: string;        // human-readable: "Category Limit", "Receipt Required"
  category: string;
  passed: boolean;
  severity: 'pass' | 'warn' | 'fail';
  message: string;          // "Within meals limit (£75.00)" or "Exceeds meals limit of £75.00"
  details: {
    field: string;           // 'amount', 'receipt', 'duplicate'
    limit?: number;
    actual?: number;
    threshold?: number;
  };
}

export interface PolicyResult {
  passed: boolean;          // true only if zero 'fail' severity checks
  timestamp: string;        // when validation was run
  rule_version: string;     // snapshot of rule values at evaluation time
  checks: PolicyCheck[];
  summary: {
    total: number;
    passed: number;
    warnings: number;
    failures: number;
  };
}

export interface PolicyAuditEntry {
  id?: string;
  claim_id: string;
  evaluation_point: 'capture' | 'submission' | 'approval_review' | 'admin_change';
  result: PolicyResult | any;
  evaluated_by: string;     // person ID or 'system'
  created_at?: string;
}
