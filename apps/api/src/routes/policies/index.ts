import { FastifyPluginAsync } from 'fastify';
import { PolicyService } from '../../services/policy.service';
import { getDb } from '../../db/connection';

const policyRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {

  fastify.post('/validate', async (request, reply) => {
    const policyService = new PolicyService(getDb());
    const { category, amount, has_receipt, date } = request.body as any;
    const claimant_id = (request.user as any)?.id || 'person:sarah_chen';

    const result = await policyService.validateClaim({
      category, amount, has_receipt, date, claimant_id
    });
    return { status: 'success', data: result };
  });

  fastify.get('/rules', async (request, reply) => {
    const policyService = new PolicyService(getDb());
    const rules = await policyService.getAllPolicyRules();
    return { status: 'success', data: rules };
  });

  fastify.patch('/rules/category/:category', async (request, reply) => {
    const policyService = new PolicyService(getDb());
    const params = request.params as any;
    const updates = request.body as any;
    const updatedBy = (request.headers as any)['x-user-id'] || (request.user as any)?.id || 'system';
    const rule = await policyService.updatePolicyRuleByCategory(params.category, updates, updatedBy);
    return { status: 'success', data: rule };
  });

  fastify.get('/audit/:claimId', async (request, reply) => {
    const policyService = new PolicyService(getDb());
    const params = request.params as any;
    const entries = await policyService.getPolicyAuditTrail(params.id === 'POLICY_CHANGE' ? 'POLICY_CHANGE' : params.claimId);
    return { status: 'success', data: entries };
  });

  fastify.get('/thresholds', async (request, reply) => {
    const policyService = new PolicyService(getDb());
    const thresholds = await policyService.getApprovalThresholds();
    return { status: 'success', data: thresholds };
  });
};

export default policyRoutes;
