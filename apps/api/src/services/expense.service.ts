import { Surreal, StringRecordId } from 'surrealdb';
import { ExpenseClaim, ExpenseClaimEnriched, ExportRow } from '@nucleus/types';
import { PolicyService } from './policy.service';
import { WorkflowService } from './workflow.service';

export class ExpenseService {
  private policySvc: PolicyService;
  private workflowSvc: WorkflowService;

  constructor(private db: Surreal) {
    this.policySvc = new PolicyService(db);
    this.workflowSvc = new WorkflowService(db);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private initials(p: any): string {
    return `${(p?.first_name || '')[0] || ''}${(p?.last_name || '')[0] || ''}`.toUpperCase();
  }

  private personName(p: any): string {
    return `${p?.first_name || ''} ${p?.last_name || ''}`.trim();
  }

  /** Fetch a single person record; returns null if not found */
  private async fetchPerson(personId: string): Promise<any | null> {
    try {
      const res = await this.db.query(`SELECT * FROM type::record($id)`, { id: personId });
      const arr = res[0] as any[];
      return arr && arr.length > 0 ? arr[0] : null;
    } catch {
      return null;
    }
  }

  /** Generate next EXP-NNN reference */
  private async nextReference(): Promise<string> {
    const res = await this.db.query(`SELECT count() AS n FROM expense_claim GROUP ALL`);
    const arr = res[0] as any[];
    const count = (arr && arr[0]?.n) ? Number(arr[0].n) : 0;
    return `EXP-${String(count + 1).padStart(3, '0')}`;
  }

  /** Enrich a raw claim with person data and workflow instance */
  private async enrichClaim(raw: any): Promise<ExpenseClaimEnriched> {
    const claimantId = raw.claimant?.toString ? raw.claimant.toString() : raw.claimant;
    const person = await this.fetchPerson(claimantId);

    let workflow = undefined;
    if (raw.workflow_instance) {
      try {
        const wiId = raw.workflow_instance?.toString ? raw.workflow_instance.toString() : raw.workflow_instance;
        const wRes = await this.db.query(`SELECT * FROM type::record($id)`, { id: wiId });
        const wArr = wRes[0] as any[];
        workflow = wArr && wArr.length > 0 ? wArr[0] : undefined;
      } catch { /* ignore */ }
    }

    return {
      ...raw,
      id: raw.id?.toString ? raw.id.toString() : raw.id,
      claimant: claimantId,
      claimant_name: person ? this.personName(person) : claimantId,
      claimant_initials: person ? this.initials(person) : '?',
      claimant_job_title: person?.job_title,
      claimant_department: person?.department,
      workflow,
    };
  }

  // ─── GET /expenses (claimant mode) ─────────────────────────────────────────

  async getClaimsForClaimant(claimantId: string): Promise<ExpenseClaimEnriched[]> {
    try {
      const res = await this.db.query(
        `SELECT * FROM expense_claim WHERE claimant = type::record($id) ORDER BY created_at DESC`,
        { id: claimantId }
      );
      const raws = res[0] as any[];
      if (!raws || raws.length === 0) return [];
      return Promise.all(raws.map(r => this.enrichClaim(r)));
    } catch (err: any) {
      if (err.message?.includes('does not exist')) return [];
      throw err;
    }
  }

  // ─── GET /expenses (approver mode) ─────────────────────────────────────────

  async getClaimsForApprover(approverId: string): Promise<ExpenseClaimEnriched[]> {
    const pendingInstances = await this.workflowSvc.getPendingApprovals(approverId);

    const enriched: ExpenseClaimEnriched[] = [];
    for (const instance of pendingInstances) {
      const subjectId = instance.subject_id?.toString ? instance.subject_id.toString() : instance.subject_id;
      try {
        const cRes = await this.db.query(`SELECT * FROM type::record($id)`, { id: subjectId });
        const cArr = cRes[0] as any[];
        if (cArr && cArr.length > 0) {
          const raw = { ...cArr[0], workflow_instance: instance.id };
          const ec = await this.enrichClaim(raw);
          ec.workflow = instance as any;
          enriched.push(ec);
        }
      } catch { /* skip broken refs */ }
    }
    return enriched;
  }

  // ─── GET /expenses/:id ──────────────────────────────────────────────────────

  async getClaimDetail(claimId: string): Promise<{
    claim: ExpenseClaimEnriched;
    timeline: any;
    policy_audit: any[];
  }> {
    const res = await this.db.query(`SELECT * FROM type::record($id)`, { id: claimId });
    const arr = res[0] as any[];
    if (!arr || arr.length === 0) throw Object.assign(new Error('Claim not found'), { statusCode: 404 });

    const raw = arr[0];
    const claim = await this.enrichClaim(raw);

    // Workflow timeline
    let timeline = null;
    if (raw.workflow_instance) {
      try {
        const wiId = raw.workflow_instance?.toString ? raw.workflow_instance.toString() : raw.workflow_instance;
        timeline = await this.workflowSvc.getWorkflowTimeline(wiId);
      } catch { /* no timeline yet */ }
    }

    // Policy audit trail
    const policy_audit = await this.policySvc.getPolicyAuditTrail(claimId);

    return { claim, timeline, policy_audit };
  }

  // ─── POST /expenses ─────────────────────────────────────────────────────────

  async submitClaim(
    claimantId: string,
    body: {
      category: string;
      amount: number;
      date: string;
      has_receipt: boolean;
      description: string;
      currency?: string;
      receipt_url?: string;
      // Partial claim fields
      receipt_amount?: number;
      claim_amount?: number;
      partial_claim?: boolean;
      partial_reason?: string;
      // Exception fields
      exception_requested?: boolean;
      exception_justification?: string;
    }
  ): Promise<{ claim: ExpenseClaimEnriched; workflow: any; policy_result: any }> {
    const {
      category, date, has_receipt, description, currency = 'GBP', receipt_url,
      receipt_amount, claim_amount, partial_claim, partial_reason,
      exception_requested, exception_justification,
    } = body;

    // Resolve the actual claim amount (partial claims use claim_amount, otherwise use amount)
    const claimAmount = claim_amount ?? body.amount;
    const receiptAmount = receipt_amount ?? claimAmount;

    // 1. Input validation
    if (!category || claimAmount == null || !date || has_receipt == null) {
      throw Object.assign(new Error('category, amount, date and has_receipt are required'), { statusCode: 400 });
    }

    if (partial_claim && (!partial_reason || partial_reason.trim() === '')) {
      throw Object.assign(new Error('A reason is required for partial claims'), { statusCode: 400 });
    }

    if (exception_requested && (!exception_justification || exception_justification.trim() === '')) {
      throw Object.assign(new Error('A justification is required for policy exception requests'), { statusCode: 400 });
    }

    // 2. Policy validation — validates against claim_amount
    const policy_result = await this.policySvc.validateClaim({
      category, amount: claimAmount, has_receipt, date, claimant_id: claimantId,
    });

    // Block on policy failure unless the claimant has explicitly requested an exception
    if (!policy_result.passed && !exception_requested) {
      throw Object.assign(new Error('Policy validation failed'), { statusCode: 400, policy_result });
    }

    // 3. Generate reference
    const reference = await this.nextReference();

    // 4. Determine status and workflow template
    const initialStatus = exception_requested ? 'exception_requested' : 'submitted';
    const workflowTemplate = exception_requested ? 'expense_approval_exception' : 'expense_approval';

    // 5. Create the expense_claim record
    const claimData: Record<string, any> = {
      reference,
      claimant: new StringRecordId(claimantId),
      category,
      amount: claimAmount,
      currency,
      description,
      date,
      has_receipt,
      receipt_url: receipt_url || null,
      status: initialStatus,
      policy_result,
    };

    if (partial_claim) {
      claimData.receipt_amount = receiptAmount;
      claimData.claim_amount = claimAmount;
      claimData.partial_claim = true;
      claimData.partial_reason = partial_reason;
    }

    if (exception_requested) {
      claimData.exception_requested = true;
      claimData.exception_justification = exception_justification;
    }

    const cRes = await this.db.query(`CREATE expense_claim CONTENT $data`, { data: claimData });
    const cArr = cRes[0] as any[];
    const newClaim = cArr[0];
    const claimId = newClaim.id?.toString ? newClaim.id.toString() : newClaim.id;

    // 6. Log policy audit
    await this.policySvc.logPolicyAudit(claimId, 'submission', policy_result, claimantId);

    // 7. Create workflow instance (graph traversal happens here)
    const workflow = await this.workflowSvc.createInstance(
      workflowTemplate,
      claimantId,
      'expense_claim',
      claimId,
      { amount: claimAmount, category }
    );

    const workflowId = workflow.id?.toString ? workflow.id.toString() : workflow.id;

    // 8. Link workflow to claim and advance status to pending
    const pendingStatus = exception_requested ? 'exception_requested' : 'pending';
    await this.db.query(
      `UPDATE type::record($id) MERGE { workflow_instance: type::record($wi), status: $status }`,
      { id: claimId, wi: workflowId, status: pendingStatus }
    );

    const enriched = await this.enrichClaim({ ...newClaim, status: pendingStatus, workflow_instance: workflowId });
    enriched.workflow = workflow as any;

    return { claim: enriched, workflow, policy_result };
  }

  // ─── POST /expenses/:id/action ──────────────────────────────────────────────

  async processAction(
    claimId: string,
    actorId: string,
    action: 'approve' | 'reject' | 'query' | 'respond',
    note?: string
  ): Promise<{ claim: ExpenseClaimEnriched; workflow: any }> {
    // 1. Fetch the claim
    const cRes = await this.db.query(`SELECT * FROM type::record($id)`, { id: claimId });
    const cArr = cRes[0] as any[];
    if (!cArr || cArr.length === 0) throw Object.assign(new Error('Claim not found'), { statusCode: 404 });
    const rawClaim = cArr[0];

    if (!rawClaim.workflow_instance) {
      throw Object.assign(new Error('No workflow instance linked to this claim'), { statusCode: 409 });
    }

    const workflowId = rawClaim.workflow_instance?.toString
      ? rawClaim.workflow_instance.toString()
      : rawClaim.workflow_instance;

    // 2. For final-step approvals, re-evaluate policy
    if (action === 'approve') {
      const wRes = await this.db.query(`SELECT * FROM type::record($id)`, { id: workflowId });
      const wArr = wRes[0] as any[];
      const instance = wArr && wArr[0];
      const isFinalStep = instance && instance.current_step === instance.total_steps;

      if (isFinalStep) {
        const claimantId = rawClaim.claimant?.toString ? rawClaim.claimant.toString() : rawClaim.claimant;
        const approvalPolicyResult = await this.policySvc.validateClaim({
          category: rawClaim.category,
          amount: rawClaim.amount,
          has_receipt: rawClaim.has_receipt,
          date: rawClaim.date,
          claimant_id: claimantId,
        });
        await this.policySvc.logPolicyAudit(claimId, 'approval_review', approvalPolicyResult, actorId);
        // Store approval-time policy result on the claim
        await this.db.query(
          `UPDATE type::record($id) MERGE { policy_result_approval: $pr }`,
          { id: claimId, pr: approvalPolicyResult }
        );
      }
    }

    // 3. Process workflow action (state machine)
    const updatedWorkflow = await this.workflowSvc.processAction(workflowId, actorId, action, note);

    // 4. Sync claim status from workflow
    const statusMap: Record<string, string> = {
      approved: 'approved',
      rejected: 'rejected',
      queried: 'queried',
      in_progress: 'pending',
      pending: 'pending',
    };
    const newClaimStatus = statusMap[updatedWorkflow.status] || rawClaim.status;

    await this.db.query(
      `UPDATE type::record($id) MERGE { status: $status }`,
      { id: claimId, status: newClaimStatus }
    );

    // 5. Re-fetch enriched claim
    const updatedCRes = await this.db.query(`SELECT * FROM type::record($id)`, { id: claimId });
    const updatedCArr = updatedCRes[0] as any[];
    const claim = await this.enrichClaim(updatedCArr[0]);
    claim.workflow = updatedWorkflow as any;

    return { claim, workflow: updatedWorkflow };
  }

  // ─── POST /expenses/preview-route ──────────────────────────────────────────

  async previewRoute(
    initiatorId: string,
    context: { amount: number; category: string }
  ) {
    return this.workflowSvc.resolveApprovalChain('expense_approval', initiatorId, context);
  }

  // ─── POST /expenses/ocr-scan ────────────────────────────────────────────────

  async simulateOcr(): Promise<{
    vendor: string; date: string; amount: number; currency: string;
    category_suggestion: string; confidence: number;
  }> {
    const vendors = [
      { vendor: 'Dishoom', category: 'meals', amounts: [18.5, 24.0, 32.75, 47.5] },
      { vendor: 'Avanti West Coast', category: 'travel', amounts: [54.0, 89.5, 124.0, 210.0] },
      { vendor: 'Premier Inn', category: 'accommodation', amounts: [89.0, 109.0, 129.0, 149.0] },
      { vendor: 'Uber', category: 'travel', amounts: [8.4, 12.6, 19.8, 31.5] },
      { vendor: 'Ryman', category: 'office_supplies', amounts: [4.99, 12.49, 22.0, 38.5] },
      { vendor: 'Pret A Manger', category: 'meals', amounts: [6.5, 8.95, 11.75, 14.5] },
      { vendor: 'Travelodge', category: 'accommodation', amounts: [59.0, 75.0, 89.0, 99.0] },
      { vendor: 'Virgin Trains', category: 'travel', amounts: [44.5, 68.0, 112.0, 187.5] },
      { vendor: 'Bolt', category: 'travel', amounts: [7.2, 11.4, 16.8, 24.9] },
    ];

    const pick = vendors[Math.floor(Math.random() * vendors.length)];
    const amount = pick.amounts[Math.floor(Math.random() * pick.amounts.length)];
    const daysAgo = Math.floor(Math.random() * 30);
    const date = new Date(Date.now() - daysAgo * 86400000).toISOString().split('T')[0];

    // Simulate OCR latency
    await new Promise(resolve => setTimeout(resolve, 1500));

    return {
      vendor: pick.vendor,
      date,
      amount,
      currency: 'GBP',
      category_suggestion: pick.category,
      confidence: parseFloat((0.82 + Math.random() * 0.17).toFixed(2)),
    };
  }

  // ─── POST /expenses/export ──────────────────────────────────────────────────

  async exportApproved(actorId: string): Promise<{ csv: string; claims_count: number; total_amount: number }> {
    // Permission check — must hold finance_approver role
    const roleCheck = await this.db.query(
      `SELECT <-has_role<-person[WHERE id = type::record($personId)].id AS holders FROM role:finance_approver`,
      { personId: actorId }
    );
    const rArr = roleCheck[0] as any[];
    const hasRole = rArr && rArr[0] && rArr[0].holders && rArr[0].holders.length > 0;
    if (!hasRole) {
      throw Object.assign(new Error('Only finance_approver role can export claims'), { statusCode: 403 });
    }

    const claimsRes = await this.db.query(
      `SELECT * FROM expense_claim WHERE status = 'approved' ORDER BY created_at DESC`
    );
    const claims = claimsRes[0] as any[];
    if (!claims || claims.length === 0) {
      return { csv: '', claims_count: 0, total_amount: 0 };
    }

    // Fetch all policy rules once for GL code / VAT rate lookup
    const rulesRes = await this.db.query(`SELECT * FROM policy_rule`);
    const allRules = rulesRes[0] as any[];
    const ruleByCategory: Record<string, any> = {};
    for (const r of allRules) ruleByCategory[r.category] = r;

    const rows: ExportRow[] = [];
    let totalAmount = 0;

    for (const claim of claims) {
      const claimId = claim.id?.toString ? claim.id.toString() : claim.id;
      const claimantId = claim.claimant?.toString ? claim.claimant.toString() : claim.claimant;
      const person = await this.fetchPerson(claimantId);
      const rule = ruleByCategory[claim.category] || {};

      // Find approved-by from the workflow instance
      let approvedBy = '';
      let approvedDate = '';
      if (claim.workflow_instance) {
        try {
          const wiId = claim.workflow_instance?.toString ? claim.workflow_instance.toString() : claim.workflow_instance;
          const timeline = await this.workflowSvc.getWorkflowTimeline(wiId);
          const approveAction = timeline.actions.slice().reverse().find((a: any) => a.action === 'approve');
          if (approveAction) {
            approvedBy = approveAction.actor_id || '';
            approvedDate = approveAction.created_at || '';
          }
        } catch { /* ignore */ }
      }

      const vatRate = rule.vat_rate ?? 0;
      const amountNet = claim.amount / (1 + vatRate);
      const vatAmount = claim.amount - amountNet;

      rows.push({
        ClaimID: claim.reference || claimId,
        EmployeeID: claimantId,
        EmployeeName: person ? this.personName(person) : claimantId,
        CostCentre: person?.cost_centre?.toString ? person.cost_centre.toString() : (person?.cost_centre || ''),
        GLCode: rule.gl_code || '',
        AmountNet: amountNet.toFixed(2),
        VATRate: (vatRate * 100).toFixed(0) + '%',
        VATAmount: vatAmount.toFixed(2),
        AmountGross: claim.amount.toFixed(2),
        Currency: claim.currency || 'GBP',
        Category: claim.category,
        Description: claim.description || '',
        Date: claim.date || '',
        ApprovedBy: approvedBy,
        ApprovedDate: approvedDate,
      });

      totalAmount += claim.amount;
    }

    // Build CSV
    const headers = [
      'ClaimID', 'EmployeeID', 'EmployeeName', 'CostCentre', 'GLCode',
      'AmountNet', 'VATRate', 'VATAmount', 'AmountGross', 'Currency',
      'Category', 'Description', 'Date', 'ApprovedBy', 'ApprovedDate',
    ] as (keyof ExportRow)[];

    const escapeCsv = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csvLines = [
      headers.join(','),
      ...rows.map(r => headers.map(h => escapeCsv(r[h])).join(',')),
    ];

    return {
      csv: csvLines.join('\n'),
      claims_count: rows.length,
      total_amount: parseFloat(totalAmount.toFixed(2)),
    };
  }

  // ─── GET /expenses/approved (finance view) ─────────────────────────────────

  async getApprovedForFinance(actorId: string): Promise<{
    approved: any[];
    posted: any[];
    total_pending: number;
  }> {
    // Role check
    const roleCheck = await this.db.query(
      `SELECT <-has_role<-person[WHERE id = type::record($personId)].id AS holders FROM role:finance_approver`,
      { personId: actorId }
    );
    const rArr = roleCheck[0] as any[];
    const hasRole = rArr && rArr[0] && rArr[0].holders && rArr[0].holders.length > 0;
    if (!hasRole) {
      throw Object.assign(new Error('Only finance_approver role can access this'), { statusCode: 403 });
    }

    const claimsRes = await this.db.query(
      `SELECT * FROM expense_claim WHERE status IN ['approved', 'posted'] ORDER BY created_at DESC`
    );
    const claims = claimsRes[0] as any[];
    if (!claims || claims.length === 0) return { approved: [], posted: [], total_pending: 0 };

    const rulesRes = await this.db.query(`SELECT * FROM policy_rule`);
    const allRules = rulesRes[0] as any[];
    const ruleByCategory: Record<string, any> = {};
    for (const r of allRules) ruleByCategory[r.category] = r;

    const enrichRow = async (claim: any) => {
      const claimId = claim.id?.toString ? claim.id.toString() : claim.id;
      const claimantId = claim.claimant?.toString ? claim.claimant.toString() : claim.claimant;
      const person = await this.fetchPerson(claimantId);
      const rule = ruleByCategory[claim.category] || {};

      let approvedDate = claim.updated_at || '';
      if (claim.workflow_instance) {
        try {
          const wiId = claim.workflow_instance?.toString ? claim.workflow_instance.toString() : claim.workflow_instance;
          const timeline = await this.workflowSvc.getWorkflowTimeline(wiId);
          const approveAction = timeline.actions.slice().reverse().find((a: any) => a.action === 'approve');
          if (approveAction) approvedDate = approveAction.created_at || '';
        } catch { /* ignore */ }
      }

      const vatRate = rule.vat_rate ?? 0;
      const amountNet = claim.amount / (1 + vatRate);
      const vatAmount = claim.amount - amountNet;

      return {
        id: claimId,
        reference: claim.reference || claimId,
        employee_name: person ? this.personName(person) : claimantId,
        employee_id: claimantId,
        description: claim.description || '',
        category: claim.category,
        amount_gross: claim.amount,
        amount_net: parseFloat(amountNet.toFixed(2)),
        vat_amount: parseFloat(vatAmount.toFixed(2)),
        vat_rate: parseFloat((vatRate * 100).toFixed(0)),
        gl_code: rule.gl_code || '',
        cost_centre: person?.cost_centre?.toString ? person.cost_centre.toString() : (person?.cost_centre || ''),
        currency: claim.currency || 'GBP',
        date: claim.date || '',
        approved_date: approvedDate,
        status: claim.status,
      };
    };

    const rows = await Promise.all(claims.map(enrichRow));
    const approved = rows.filter(r => r.status === 'approved');
    const posted = rows.filter(r => r.status === 'posted');

    return {
      approved,
      posted,
      total_pending: parseFloat(approved.reduce((s, r) => s + r.amount_gross, 0).toFixed(2)),
    };
  }

  // ─── POST /expenses/mark-posted ────────────────────────────────────────────

  async markPosted(claimIds: string[]): Promise<{ updated: number }> {
    let updated = 0;
    for (const id of claimIds) {
      try {
        await this.db.query(
          `UPDATE type::record($id) MERGE { status: 'posted' } WHERE status = 'approved'`,
          { id }
        );
        updated++;
      } catch { /* skip invalid ids */ }
    }
    return { updated };
  }
}
