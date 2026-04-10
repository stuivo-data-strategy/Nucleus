"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const policy_service_1 = require("../../services/policy.service");
const connection_1 = require("../../db/connection");
const policyRoutes = async (fastify, opts) => {
    const policyService = new policy_service_1.PolicyService((0, connection_1.getDb)());
    fastify.post('/validate', async (request, reply) => {
        const { category, amount, has_receipt, date } = request.body;
        const claimant_id = request.user?.id || 'person:sarah_chen';
        const result = await policyService.validateClaim({
            category, amount, has_receipt, date, claimant_id
        });
        return { status: 'success', data: result };
    });
    fastify.get('/rules', async (request, reply) => {
        const rules = await policyService.getAllPolicyRules();
        return { status: 'success', data: rules };
    });
    fastify.patch('/rules/:id', async (request, reply) => {
        const params = request.params;
        const updates = request.body;
        const updatedBy = request.user?.id || 'system';
        const rule = await policyService.updatePolicyRule(params.id, updates, updatedBy);
        return { status: 'success', data: rule };
    });
    fastify.get('/audit/:claimId', async (request, reply) => {
        const params = request.params;
        const entries = await policyService.getPolicyAuditTrail(params.id === 'POLICY_CHANGE' ? 'POLICY_CHANGE' : params.claimId);
        return { status: 'success', data: entries };
    });
    fastify.get('/thresholds', async (request, reply) => {
        const thresholds = await policyService.getApprovalThresholds();
        return { status: 'success', data: thresholds };
    });
};
exports.default = policyRoutes;
