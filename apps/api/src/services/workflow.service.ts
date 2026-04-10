import { Surreal } from 'surrealdb';

export class WorkflowService {
  constructor(private db: Surreal) {}

  async resolveWorkflow(templateName: string, initiatorId: string, context?: any) {
    const res = await this.db.query(`SELECT * FROM workflow_template WHERE name = $name LIMIT 1`, { name: templateName });
    const tmplArr = res[0] as any[];
    if (!tmplArr || tmplArr.length === 0) throw new Error(`Template ${templateName} not found`);
    const template = tmplArr[0];

    const resolvedSteps = [];
    for (const step of template.steps || []) {
      let approverId = null;
      if (step.resolver === 'direct_manager') {
        const mgrRes = await this.db.query(`SELECT ->reports_to->person.id AS mgr_id FROM person WHERE id = $id`, { id: initiatorId });
        const arr = mgrRes[0] as any[];
        if (arr && arr[0] && arr[0].mgr_id && arr[0].mgr_id.length > 0) {
          approverId = arr[0].mgr_id[0];
        }
      } else if (step.resolver === 'cost_centre_owner') {
        const amt = context?.amount || 0;
        if (template.name === 'expense_approval' && amt <= 100) continue;
        const ccRes = await this.db.query(`SELECT cost_centre.owner AS cc_owner FROM person WHERE id = $id`, { id: initiatorId });
        const arr = ccRes[0] as any[];
        if (arr && arr[0] && arr[0].cc_owner) approverId = arr[0].cc_owner;
      } else if (step.resolver === 'org_unit_head') {
        const ouRes = await this.db.query(`SELECT org_unit.head AS ou_head FROM person WHERE id = $id`, { id: initiatorId });
        const arr = ouRes[0] as any[];
        if (arr && arr[0] && arr[0].ou_head) approverId = arr[0].ou_head;
      } else if (step.resolver === 'specific_role') {
        const roleName = step.resolver_config?.role || '';
        const amt = context?.amount || 0;
        if (roleName === 'finance_approver' && amt <= 500) continue;
        
        const roleRes = await this.db.query(`SELECT <-has_role<-person.id AS approvers FROM role WHERE name = $roleName`, { roleName });
        const arr = roleRes[0] as any[];
        if (arr && arr[0] && arr[0].approvers && arr[0].approvers.length > 0) {
          approverId = arr[0].approvers[0];
        }
      } else if (step.resolver === 'specific_person') {
         approverId = initiatorId;
      }

      if (approverId) {
        resolvedSteps.push({
          order: resolvedSteps.length + 1,
          approver: approverId,
          status: 'pending',
          action: step.action
        });
      }
    }
    return resolvedSteps;
  }

  async createInstance(templateName: string, initiatorId: string, subjectType: string, subjectId: string, context?: any) {
    const templateRes = await this.db.query(`SELECT * FROM workflow_template WHERE name = $name LIMIT 1`, { name: templateName });
    const tmplArr = templateRes[0] as any[];
    if (!tmplArr.length) throw new Error('Template not found');
    const template = tmplArr[0];

    const resolvedSteps = await this.resolveWorkflow(templateName, initiatorId, context);

    const instanceData = {
      template: template.id,
      initiator: initiatorId,
      subject_type: subjectType,
      subject_id: subjectId,
      current_step: 1,
      total_steps: resolvedSteps.length,
      status: resolvedSteps.length > 0 ? 'in_progress' : 'approved',
      steps: resolvedSteps,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const res = await this.db.query(`CREATE workflow_instance CONTENT $data`, { data: instanceData });
    const instances = res[0] as any[];
    return instances[0];
  }

  async processAction(instanceId: string, actorId: string, action: string, note?: string) {
    const res = await this.db.query(`SELECT * FROM workflow_instance WHERE id = $id LIMIT 1`, { id: instanceId });
    const instances = res[0] as any[];
    if (!instances.length) throw new Error('Instance not found');
    const instance = instances[0];

    const currentStepIdx = instance.current_step - 1;
    const currentStep = instance.steps[currentStepIdx];
    
    if (!currentStep) throw new Error('No active step found');
    if (currentStep.approver !== actorId) throw new Error('Not authorized to act on this step');

    currentStep.status = action;
    currentStep.acted_at = new Date().toISOString();
    currentStep.note = note || '';

    let newStatus = instance.status;
    let newCurrentStep = instance.current_step;

    if (action === 'approve') {
       if (newCurrentStep < instance.total_steps) {
         newCurrentStep++;
       } else {
         newStatus = 'approved';
       }
    } else if (action === 'reject') {
       newStatus = 'rejected';
    } else if (action === 'query') {
       newStatus = 'queried';
    }

    const updateRes = await this.db.query(`
      UPDATE ${instanceId} MERGE {
        current_step: $curr_st, status: $status, steps: $steps, updated_at: $u_at
      }
    `, {
      curr_st: newCurrentStep, status: newStatus, steps: instance.steps,
      u_at: new Date().toISOString()
    });

    await this.db.query(`CREATE workflow_action CONTENT $data`, {
      data: {
        instance: instanceId, step: instance.current_step, actor: actorId, action, note, created_at: new Date().toISOString()
      }
    });

    const updArr = updateRes[0] as any[];
    return updArr[0];
  }

  async getPendingForApprover(personId: string) {
    const res = await this.db.query(`SELECT * FROM workflow_instance WHERE status = 'in_progress'`);
    const all = res[0] as any[];
    const maxData = all || [];
    return maxData.filter((i: any) => {
       const step = i.steps[i.current_step - 1];
       return step && step.approver === personId && step.status === 'pending';
    });
  }

  async getForInitiator(personId: string) {
    const res = await this.db.query(`SELECT * FROM workflow_instance WHERE initiator = $personId ORDER BY updated_at DESC`, { personId });
    return res[0];
  }

  async getInstance(id: string) {
    const res = await this.db.query(`
      SELECT *, <-workflow_action.* as history FROM workflow_instance WHERE id = $id
    `, { id });
    const arr = res[0] as any[];
    return arr[0];
  }
}
