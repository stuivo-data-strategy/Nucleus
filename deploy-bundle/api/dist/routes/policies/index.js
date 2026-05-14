"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const policy_service_1 = require("../../services/policy.service");
const connection_1 = require("../../db/connection");
const policyRoutes = async (fastify, opts) => {
    fastify.post('/validate', async (request, reply) => {
        const policyService = new policy_service_1.PolicyService((0, connection_1.getDb)());
        const { category, amount, has_receipt, date } = request.body;
        const claimant_id = request.user?.id || 'person:sarah_chen';
        const result = await policyService.validateClaim({
            category, amount, has_receipt, date, claimant_id
        });
        return { status: 'success', data: result };
    });
    fastify.get('/rules', async (request, reply) => {
        const policyService = new policy_service_1.PolicyService((0, connection_1.getDb)());
        const rules = await policyService.getAllPolicyRules();
        return { status: 'success', data: rules };
    });
    fastify.patch('/rules/category/:category', async (request, reply) => {
        const policyService = new policy_service_1.PolicyService((0, connection_1.getDb)());
        const params = request.params;
        const updates = request.body;
        const updatedBy = request.headers['x-user-id'] || request.user?.id || 'system';
        const rule = await policyService.updatePolicyRuleByCategory(params.category, updates, updatedBy);
        return { status: 'success', data: rule };
    });
    fastify.get('/audit/:claimId', async (request, reply) => {
        const policyService = new policy_service_1.PolicyService((0, connection_1.getDb)());
        const params = request.params;
        const entries = await policyService.getPolicyAuditTrail(params.id === 'POLICY_CHANGE' ? 'POLICY_CHANGE' : params.claimId);
        return { status: 'success', data: entries };
    });
    fastify.get('/thresholds', async (request, reply) => {
        const policyService = new policy_service_1.PolicyService((0, connection_1.getDb)());
        const thresholds = await policyService.getApprovalThresholds();
        return { status: 'success', data: thresholds };
    });
};
exports.default = policyRoutes;
