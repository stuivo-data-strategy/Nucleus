export interface ResolvedApprover {
    person_id: string;
    first_name: string;
    last_name: string;
    avatar_initials: string;
    job_title: string;
    resolution_method: string;
    resolution_path: string;
}
export interface WorkflowTemplateStep {
    order: number;
    label: string;
    resolver: string;
    role?: string;
    condition?: {
        min_amount?: number;
    };
    action: string;
}
export interface WorkflowTemplate {
    id: string;
    name: string;
    description: string;
    steps: WorkflowTemplateStep[];
}
export interface WorkflowInstanceStep {
    order: number;
    approver_id: string;
    approver_name: string;
    resolution_path: string;
    status: 'pending' | 'approved' | 'rejected' | 'queried' | 'waiting';
    acted_at?: string;
    note?: string;
}
export interface WorkflowInstance {
    id: string;
    template_name: string;
    initiator: string;
    subject_type: string;
    subject_id: string;
    current_step: number;
    total_steps: number;
    status: 'pending' | 'in_progress' | 'approved' | 'rejected' | 'queried';
    steps: WorkflowInstanceStep[];
    resolution_log: string[];
    skipped_steps: {
        step: number;
        reason: string;
    }[];
    created_at: string;
    updated_at: string;
}
export interface WorkflowAction {
    id: string;
    instance: string;
    step: number;
    actor: string;
    action: 'created' | 'approve' | 'reject' | 'query' | 'respond';
    note?: string;
    created_at: string;
}
