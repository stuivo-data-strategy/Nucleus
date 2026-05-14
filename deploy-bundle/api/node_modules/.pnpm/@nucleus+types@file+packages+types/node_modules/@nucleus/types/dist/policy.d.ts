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
    rule_id: string;
    rule_name: string;
    category: string;
    passed: boolean;
    severity: 'pass' | 'warn' | 'fail';
    message: string;
    details: {
        field: string;
        limit?: number;
        actual?: number;
        threshold?: number;
    };
}
export interface PolicyResult {
    passed: boolean;
    timestamp: string;
    rule_version: string;
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
    evaluated_by: string;
    created_at?: string;
}
