export interface Workflow {
  id: string;
  type: string;
  status: string;
  requesterId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApprovalStep {
  id: string;
  workflowId: string;
  approverId: string;
  status: string;
  order: number;
}
