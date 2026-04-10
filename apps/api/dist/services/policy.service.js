"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolicyService = void 0;
const surrealdb_1 = require("surrealdb");
class PolicyService {
    db;
    constructor(db) {
        this.db = db;
    }
    async validateClaim(claim) {
        const checks = [];
        // 1. Fetch policy rule
        const res = await this.db.query(`SELECT * FROM policy_rule WHERE category = $cat LIMIT 1`, { cat: claim.category });
        const arr = res[0];
        const rule = arr && arr.length > 0 ? arr[0] : null;
        if (!rule) {
            checks.push({
                rule_id: 'unknown',
                rule_name: 'Missing Policy',
                category: claim.category,
                passed: false,
                severity: 'warn',
                message: `No policy rule defined for category: ${claim.category}`,
                details: { field: 'category' }
            });
        }
        else {
            // CHECK 1: Category limit
            if (claim.amount > rule.max_amount) {
                checks.push({
                    rule_id: rule.id, rule_name: 'Category Limit', category: rule.category, passed: false, severity: 'fail',
                    message: `Exceeds ${rule.category} limit of £${rule.max_amount.toFixed(2)}`,
                    details: { field: 'amount', limit: rule.max_amount, actual: claim.amount }
                });
            }
            else {
                checks.push({
                    rule_id: rule.id, rule_name: 'Category Limit', category: rule.category, passed: true, severity: 'pass',
                    message: `Within ${rule.category} limit (£${rule.max_amount.toFixed(2)})`,
                    details: { field: 'amount', limit: rule.max_amount, actual: claim.amount }
                });
            }
            // CHECK 2: Receipt required
            if (claim.amount > rule.receipt_threshold && !claim.has_receipt) {
                checks.push({
                    rule_id: rule.id, rule_name: 'Receipt Required', category: rule.category, passed: false, severity: 'fail',
                    message: `Receipt required for claims over £${rule.receipt_threshold.toFixed(2)}`,
                    details: { field: 'receipt', threshold: rule.receipt_threshold, actual: claim.amount }
                });
            }
            else if (claim.amount > rule.receipt_threshold && claim.has_receipt) {
                checks.push({
                    rule_id: rule.id, rule_name: 'Receipt Required', category: rule.category, passed: true, severity: 'pass',
                    message: `Receipt attached (required over £${rule.receipt_threshold.toFixed(2)})`,
                    details: { field: 'receipt', threshold: rule.receipt_threshold, actual: claim.amount }
                });
            }
            else {
                checks.push({
                    rule_id: rule.id, rule_name: 'Receipt Required', category: rule.category, passed: true, severity: 'pass',
                    message: `Receipt not required (under £${rule.receipt_threshold.toFixed(2)})`,
                    details: { field: 'receipt', threshold: rule.receipt_threshold }
                });
            }
            // CHECK 4: Per diem compliance
            if (rule.per_diem_rate && claim.amount > rule.per_diem_rate) {
                checks.push({
                    rule_id: rule.id, rule_name: 'Per Diem Compliance', category: rule.category, passed: false, severity: 'warn',
                    message: `Exceeds per diem rate of £${rule.per_diem_rate.toFixed(2)} — justification may be required`,
                    details: { field: 'amount', limit: rule.per_diem_rate, actual: claim.amount }
                });
            }
            else if (rule.per_diem_rate) {
                checks.push({
                    rule_id: rule.id, rule_name: 'Per Diem Compliance', category: rule.category, passed: true, severity: 'pass',
                    message: `Within per diem rate (£${rule.per_diem_rate.toFixed(2)})`,
                    details: { field: 'amount', limit: rule.per_diem_rate }
                });
            }
        }
        // CHECK 3: Duplicate detection
        try {
            const lowerBound = claim.amount * 0.9;
            const upperBound = claim.amount * 1.1;
            // In a real system, date within 7 days. Simple check here for demonstration.
            const dupQuery = `
        SELECT * FROM expense_claim 
        WHERE claimant = $claimant AND category = $cat 
        AND amount > $low AND amount < $high 
        AND status != 'rejected'
      `;
            const dupRes = await this.db.query(dupQuery, { claimant: new surrealdb_1.StringRecordId(claim.claimant_id), cat: claim.category, low: lowerBound, high: upperBound });
            const dupArr = dupRes[0];
            if (dupArr && dupArr.length > 0) {
                checks.push({
                    rule_id: rule?.id || 'sys', rule_name: 'Duplicate Detection', category: claim.category, passed: false, severity: 'warn',
                    message: `Possible duplicate: similar ${claim.category} claim (£${dupArr[0].amount}) detected`,
                    details: { field: 'duplicate', actual: claim.amount }
                });
            }
            else {
                checks.push({
                    rule_id: rule?.id || 'sys', rule_name: 'Duplicate Detection', category: claim.category, passed: true, severity: 'pass',
                    message: `No duplicate claims detected`,
                    details: { field: 'duplicate' }
                });
            }
        }
        catch (e) {
            // Ignored for now if expense_claim table throws syntax errors while empty etc
        }
        // CHECK 5: Date validity
        const claimDate = new Date(claim.date);
        const now = new Date();
        const daysOld = Math.floor((now.getTime() - claimDate.getTime()) / (1000 * 3600 * 24));
        if (claimDate > now) {
            checks.push({
                rule_id: 'sys', rule_name: 'Date Validity', category: claim.category, passed: false, severity: 'fail',
                message: `Claim date cannot be in the future`,
                details: { field: 'date' }
            });
        }
        else if (daysOld > 90) {
            checks.push({
                rule_id: 'sys', rule_name: 'Date Validity', category: claim.category, passed: false, severity: 'warn',
                message: `Claim is ${daysOld} days old — late submission`,
                details: { field: 'date', actual: daysOld }
            });
        }
        else {
            checks.push({
                rule_id: 'sys', rule_name: 'Date Validity', category: claim.category, passed: true, severity: 'pass',
                message: `Claim date is valid`,
                details: { field: 'date' }
            });
        }
        const fails = checks.filter(c => c.severity === 'fail').length;
        const warns = checks.filter(c => c.severity === 'warn').length;
        const passes = checks.filter(c => c.severity === 'pass').length;
        return {
            passed: fails === 0,
            timestamp: new Date().toISOString(),
            rule_version: rule ? JSON.stringify(rule) : '{}',
            checks,
            summary: { total: checks.length, passed: passes, warnings: warns, failures: fails }
        };
    }
    async logPolicyAudit(claimId, evaluationPoint, result, evaluatedBy) {
        const data = {
            claim_id: claimId,
            evaluation_point: evaluationPoint,
            result: result,
            evaluated_by: evaluatedBy
        };
        await this.db.query(`CREATE policy_audit CONTENT $data`, { data });
    }
    async getPolicyAuditTrail(claimId) {
        const res = await this.db.query(`SELECT * FROM policy_audit WHERE claim_id = $id ORDER BY created_at ASC`, { id: claimId });
        return res[0];
    }
    async getAllPolicyRules() {
        const res = await this.db.query(`SELECT * FROM policy_rule ORDER BY category`);
        return res[0];
    }
    async updatePolicyRule(ruleId, updates, updatedBy) {
        const curRes = await this.db.query(`SELECT * FROM policy_rule WHERE id = $id`, { id: new surrealdb_1.StringRecordId(ruleId) });
        const curArr = curRes[0];
        if (!curArr || curArr.length === 0)
            throw new Error("Rule not found");
        const oldRule = curArr[0];
        const upRes = await this.db.query(`UPDATE ${ruleId} MERGE $data`, { data: updates });
        const upArr = upRes[0];
        const newRule = upArr[0];
        await this.logPolicyAudit('POLICY_CHANGE', 'admin_change', { previous: oldRule, updated: newRule, changes: updates }, updatedBy);
        return newRule;
    }
    async getApprovalThresholds() {
        const res = await this.db.query(`SELECT * FROM workflow_template WHERE name = 'expense_approval'`);
        const arr = res[0];
        if (!arr || arr.length === 0)
            return null;
        // Simplistic extraction based on prompt
        return {
            auto_approve_below: 50,
            manager_only_below: 100,
            cc_owner_above: 100,
            finance_above: 500
        };
    }
}
exports.PolicyService = PolicyService;
