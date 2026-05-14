import { PolicyResult } from './policy';
import { WorkflowInstance } from './workflow';
export type ExpenseStatus = 'submitted' | 'pending' | 'in_progress' | 'queried' | 'approved' | 'rejected' | 'posted';
export interface ExpenseClaim {
    id: string;
    reference: string;
    claimant: string;
    category: string;
    amount: number;
    currency: string;
    description: string;
    date: string;
    has_receipt: boolean;
    receipt_url?: string;
    status: ExpenseStatus;
    policy_result?: PolicyResult;
    policy_result_approval?: PolicyResult;
    workflow_instance?: string;
    created_at: string;
    updated_at: string;
}
export interface ExpenseClaimEnriched extends ExpenseClaim {
    claimant_name: string;
    claimant_initials: string;
    claimant_job_title?: string;
    claimant_department?: string;
    workflow?: WorkflowInstance;
}
export interface OcrResult {
    vendor: string;
    date: string;
    amount: number;
    currency: string;
    category_suggestion: string;
    confidence: number;
}
export interface ExportRow {
    ClaimID: string;
    EmployeeID: string;
    EmployeeName: string;
    CostCentre: string;
    GLCode: string;
    AmountNet: string;
    VATRate: string;
    VATAmount: string;
    AmountGross: string;
    Currency: string;
    Category: string;
    Description: string;
    Date: string;
    ApprovedBy: string;
    ApprovedDate: string;
}
