import { Surreal, StringRecordId } from 'surrealdb';
import { 
  ResolvedApprover, 
  WorkflowInstance, 
  WorkflowTemplate, 
  WorkflowAction, 
  WorkflowInstanceStep 
} from '@nucleus/types';

export class WorkflowService {
  constructor(private db: Surreal) {}

  private getPersonName(p: any): string {
    return `${p.first_name || ''} ${p.last_name || ''}`.trim();
  }

  private getInitials(p: any): string {
    return `${(p.first_name || '')[0] || ''}${(p.last_name || '')[0] || ''}`.toUpperCase();
  }

  async resolveDirectManager(personId: string, initiatorName: string): Promise<ResolvedApprover> {
    const res = await this.db.query(`
      SELECT ->reports_to->person.* AS managers FROM type::record($id)
    `, { id: personId });
    const arr = res[0] as any[];
    
    if (arr && arr[0] && arr[0].managers && arr[0].managers.length > 0) {
      const mgr = arr[0].managers[0];
      const mgrName = this.getPersonName(mgr);
      return {
        person_id: mgr.id.toString(),
        first_name: mgr.first_name,
        last_name: mgr.last_name,
        avatar_initials: this.getInitials(mgr),
        job_title: mgr.job_title || 'Manager',
        role_label: '',
        resolution_method: 'reports_to',
        resolution_path: `${initiatorName} →[reports_to]→ ${mgrName}`
      };
    }
    throw new Error(`Direct manager not found for ${personId}`);
  }

  async resolveCostCentreOwner(personId: string, existingApproverIds: string[], initiatorName: string): Promise<ResolvedApprover> {
    // Determine the user's initial cost centre
    let ccRes = await this.db.query(`
      SELECT cost_centre FROM type::record($personId)
    `, { personId });
    let ccArr = ccRes[0] as any[];
    if (!ccArr || ccArr.length === 0 || !ccArr[0].cost_centre) {
      throw new Error(`No cost centre assigned to ${personId}`);
    }
    
    let currentCcId = ccArr[0].cost_centre;
    if (currentCcId.toString) currentCcId = currentCcId.toString();
    
    let baseCcName = '';
    let currentPath = '';

    while (currentCcId) {
      // Find the cost centre and its owner via owns_budget edge
      const ownerRes = await this.db.query(`
        SELECT name, parent, <-owns_budget<-person.* AS owners FROM type::record($ccId)
      `, { ccId: currentCcId });
      
      const oArr = ownerRes[0] as any[];
      if (!oArr || oArr.length === 0) {
         throw new Error(`Cost centre ${currentCcId} not found`);
      }
      
      const ccData = oArr[0];
      const ccName = ccData.name;
      if (!baseCcName) baseCcName = ccName;

      const owners = ccData.owners;
      if (owners && owners.length > 0) {
        const owner = owners[0];
        const ownerIdStr = owner.id.toString();
        const ownerName = this.getPersonName(owner);

        if (!existingApproverIds.includes(ownerIdStr)) {
          // Found a non-duplicate owner!
          const prefix = currentPath ? `${currentPath} → parent CC ${ccName} →[owns_budget]→ ` : `${ccName} owner = `;
          return {
            person_id: ownerIdStr,
            first_name: owner.first_name,
            last_name: owner.last_name,
            avatar_initials: this.getInitials(owner),
            job_title: owner.job_title || 'Cost Centre Owner',
            role_label: '',
            resolution_method: 'owns_budget',
            resolution_path: `${prefix}${ownerName}`
          };
        } else {
          // It's a duplicate, we need to walk UP the tree
          currentPath += (currentPath ? ` → ` : '') + `CC ${ccName} owner = ${ownerName} [SKIP: already in chain]`;
        }
      } else {
        currentPath += (currentPath ? ` → ` : '') + `CC ${ccName} (No Owner)`;
      }

      // Move up to the parent
      if (!ccData.parent) {
         throw new Error(`Reached top of cost centre hierarchy at ${ccName} without finding a unique owner.`);
      }
      currentCcId = ccData.parent;
      if (currentCcId.toString) currentCcId = currentCcId.toString();
    }
    throw new Error('Failed to resolve cost centre owner Hierarchy');
  }

  async resolveRoleBased(roleId: string): Promise<ResolvedApprover> {
    // roleId is like 'finance_approver' or 'role:finance_approver'
    const roleBaseName = roleId.replace('role:', '');
    
    // Find people who have this role
    const roleRes = await this.db.query(`
      SELECT <-has_role<-person.* AS holders, name FROM type::record($rId)
    `, { rId: `role:${roleBaseName}` });
    
    const rArr = roleRes[0] as any[];
    if (rArr && rArr[0] && rArr[0].holders && rArr[0].holders.length > 0) {
      // Pick first active holder for PoC
      const holder = rArr[0].holders.find((h: any) => h.status === 'active') || rArr[0].holders[0];
      const holderName = this.getPersonName(holder);
      
      return {
        person_id: holder.id.toString(),
        first_name: holder.first_name,
        last_name: holder.last_name,
        avatar_initials: this.getInitials(holder),
        job_title: holder.job_title || 'Approver',
        role_label: '',
        resolution_method: 'role_lookup',
        resolution_path: `Role lookup: ${roleBaseName} → ${holderName} (${holder.job_title || 'Role Approver'})`
      };
    }
    throw new Error(`Could not resolve anyone with role: ${roleBaseName}`);
  }

  async resolveApprovalChain(
    templateName: string,
    initiatorId: string,
    context: { amount: number; category: string }
  ) {
    const tRes = await this.db.query(`SELECT * FROM workflow_template WHERE name = $name LIMIT 1`, { name: templateName });
    const tArr = tRes[0] as any[];
    if (!tArr || tArr.length === 0) throw new Error(`Workflow template '${templateName}' not found`);
    const template = tArr[0] as WorkflowTemplate;

    const pRes = await this.db.query(`SELECT * FROM type::record($id)`, { id: initiatorId });
    const pArr = pRes[0] as any[];
    const initiator = pArr && pArr.length > 0 ? pArr[0] : { first_name: 'Unknown', last_name: 'User' };
    const initiatorName = this.getPersonName(initiator);

    const resolution_log: string[] = [
      `Resolving approval chain for ${initiatorName}`,
      `Template: ${templateName}`,
      `Context: £${context.amount.toFixed(2)} (${context.category})`,
      `---`
    ];

    const resolvedSteps: ResolvedApprover[] = [];
    const skipped_steps: { step: number; reason: string; min_amount?: number }[] = [];
    const existingApproverIds: string[] = [];

    for (const templateStep of template.steps || []) {
      // Condition Check
      if (templateStep.condition?.min_amount && context.amount < templateStep.condition.min_amount) {
        skipped_steps.push({
          step: templateStep.order,
          label: templateStep.label,
          reason: `Skipped: amount £${context.amount} below threshold £${templateStep.condition.min_amount}`,
          min_amount: templateStep.condition.min_amount
        });
        resolution_log.push(`Step ${templateStep.order} (${templateStep.label}): SKIPPED — amount below £${templateStep.condition.min_amount}`);
        continue;
      }

      let approver: ResolvedApprover;
      try {
        if (templateStep.resolver === 'direct_manager') {
          approver = await this.resolveDirectManager(initiatorId, initiatorName);
        } else if (templateStep.resolver === 'cost_centre_owner') {
          approver = await this.resolveCostCentreOwner(initiatorId, existingApproverIds, initiatorName);
        } else if (templateStep.resolver === 'role_based' && templateStep.role) {
          approver = await this.resolveRoleBased(templateStep.role);
        } else {
          approver = await this.resolveDirectManager(initiatorId, initiatorName); // fallback
        }
      } catch (e: any) {
         resolution_log.push(`Step ${templateStep.order} (${templateStep.label}): FAILED — ${e.message}`);
         throw e;
      }

      approver.role_label = templateStep.label;

      resolution_log.push(`Step ${templateStep.order} (${templateStep.label}): ${approver.first_name} ${approver.last_name}`);
      resolution_log.push(`  Resolved via: ${approver.resolution_path}`);

      existingApproverIds.push(approver.person_id);
      resolvedSteps.push(approver);
    }

    resolution_log.push(`---`);
    resolution_log.push(`Final chain: ${resolvedSteps.map(s => `${s.first_name} ${s.last_name}`).join(' → ')}`);

    return { steps: resolvedSteps, resolution_log, skipped_steps };
  }

  async createInstance(
    templateName: string,
    initiatorId: string,
    subjectType: string,
    subjectId: string,
    context: { amount: number; category: string }
  ): Promise<WorkflowInstance> {
    
    // Graph resolution
    const { steps: resolvedSteps, resolution_log, skipped_steps } = await this.resolveApprovalChain(templateName, initiatorId, context);

    const instanceSteps: WorkflowInstanceStep[] = resolvedSteps.map((approver, index) => ({
      order: index + 1,
      approver_id: approver.person_id,
      approver_name: `${approver.first_name} ${approver.last_name}`,
      resolution_path: approver.resolution_path,
      status: index === 0 ? 'pending' : 'waiting'
    }));

    const status = instanceSteps.length > 0 ? 'in_progress' : 'approved';

    const instanceData = {
      template: `workflow_template:${templateName}`,
      initiator: initiatorId,
      subject_type: subjectType,
      subject_id: subjectId,
      current_step: instanceSteps.length > 0 ? 1 : 0,
      total_steps: instanceSteps.length,
      status,
      steps: instanceSteps,
      resolution_log,
      skipped_steps
    };

    const cRes = await this.db.query(`CREATE workflow_instance CONTENT $data`, { data: instanceData });
    const cArr = cRes[0] as any[];
    const instance = cArr[0];

    // Log initialization event
    await this.db.query(`CREATE workflow_action CONTENT $data`, {
      data: {
        instance: instance.id.toString(),
        step: 0,
        actor: initiatorId,
        action: 'created',
        note: 'Workflow dynamically routed & initialized'
      }
    });

    return instance;
  }

  async processAction(
    instanceId: string,
    actorId: string,
    action: 'approve' | 'reject' | 'query' | 'respond',
    note?: string
  ): Promise<WorkflowInstance> {
    const res = await this.db.query(`SELECT * FROM type::record($id)`, { id: instanceId });
    const iArr = res[0] as any[];
    if (!iArr || iArr.length === 0) throw new Error("Instance not found");
    const instance = iArr[0] as WorkflowInstance;

    if (instance.status === 'approved' || instance.status === 'rejected') {
      throw new Error(`Instance is already ${instance.status}`);
    }

    const currentStepIdx = instance.current_step - 1;
    let step = instance.steps[currentStepIdx];
    
    if (action === 'respond') {
        if (instance.initiator !== actorId) {
            throw new Error('Only the initiator can respond to a query');
        }
        if (instance.status !== 'queried') {
            throw new Error('Cannot respond to a non-queried workflow');
        }
        instance.status = 'in_progress';
        step.status = 'pending';
    } else {
        if (step.approver_id !== actorId) {
            throw new Error('You are not the current approver for this workflow step');
        }

        if (action === 'approve') {
            step.status = 'approved';
            step.acted_at = new Date().toISOString();
            step.note = note;

            if (instance.current_step < instance.total_steps) {
                instance.current_step++;
                instance.steps[instance.current_step - 1].status = 'pending';
                instance.status = 'in_progress';
            } else {
                instance.status = 'approved';
            }
        } else if (action === 'reject') {
            if (!note) throw new Error('Rejection requires a note');
            step.status = 'rejected';
            step.acted_at = new Date().toISOString();
            step.note = note;
            instance.status = 'rejected';
        } else if (action === 'query') {
            if (!note) throw new Error('Query requires a note');
            step.status = 'queried';
            step.acted_at = new Date().toISOString();
            step.note = note;
            instance.status = 'queried';
        }
    }

    const upRes = await this.db.query(`
      UPDATE type::record($id) MERGE {
        current_step: $curr_st,
        status: $status,
        steps: $steps
      }
    `, {
      id: instanceId,
      curr_st: instance.current_step,
      status: instance.status,
      steps: instance.steps
    });
    
    await this.db.query(`CREATE workflow_action CONTENT $data`, {
      data: {
        instance: instanceId,
        step: instance.current_step,
        actor: actorId,
        action,
        note
      }
    });

    const updArr = upRes[0] as any[];
    return updArr[0];
  }

  async getPendingApprovals(personId: string): Promise<WorkflowInstance[]> {
    try {
      const res = await this.db.query(`
        SELECT * FROM workflow_instance WHERE status IN ['pending', 'in_progress']
      `);
      const all = res[0] as WorkflowInstance[];
      if (!all || all.length === 0) return [];
      return all.filter(instance => {
        if (instance.current_step < 1) return false;
        const currentStep = instance.steps[instance.current_step - 1];
        return currentStep && currentStep.approver_id === personId && currentStep.status === 'pending';
      });
    } catch (err: any) {
      if (err.message?.includes('does not exist')) return [];
      throw err;
    }
  }

  async getForInitiator(personId: string): Promise<WorkflowInstance[]> {
    const res = await this.db.query(`SELECT * FROM workflow_instance WHERE initiator = $personId ORDER BY created_at DESC`, { personId });
    return res[0] as WorkflowInstance[];
  }

  async getWorkflowTimeline(instanceId: string): Promise<{ instance: WorkflowInstance; actions: any[]; resolution_log: string[] }> {
    const res = await this.db.query(`SELECT * FROM type::record($id)`, { id: instanceId });
    const instanceArray = res[0] as any[];
    if (!instanceArray.length) throw new Error('Instance not found');
    const instance = instanceArray[0] as WorkflowInstance;

    const actionRes = await this.db.query(`
      SELECT action, note, created_at, actor as actor_id
      FROM workflow_action 
      WHERE instance = $id 
      ORDER BY created_at ASC
    `, { id: instanceId });

    const actionsRaw = actionRes[0] as any[];

    const actions = actionsRaw.map(a => ({
      action: a.action,
      actor_id: a.actor_id,
      note: a.note,
      created_at: a.created_at
    }));

    return {
      instance,
      actions,
      resolution_log: instance.resolution_log || []
    };
  }
}
