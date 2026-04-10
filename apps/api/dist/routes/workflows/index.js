"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const workflow_service_1 = require("../../services/workflow.service");
const connection_1 = require("../../db/connection");
const seed_1 = require("../../db/seed");
const workflowRoutes = async (fastify, opts) => {
    fastify.post('/resolve-preview', async (request, reply) => {
        const srv = new workflow_service_1.WorkflowService((0, connection_1.getDb)());
        const actorId = request.headers['x-user-id'] || request.user?.id || seed_1.DEMO_USER;
        const body = request.body;
        // Default template and empty context if none provided for testing
        const templateName = body.template_name || body.templateName || 'expense_approval';
        const context = body.context || { amount: body.amount || 0, category: body.category || 'general' };
        const data = await srv.resolveApprovalChain(templateName, actorId, context);
        return { status: 'success', data };
    });
    fastify.post('/', async (request, reply) => {
        const srv = new workflow_service_1.WorkflowService((0, connection_1.getDb)());
        const actorId = request.headers['x-user-id'] || request.user?.id || seed_1.DEMO_USER;
        const body = request.body;
        const templateName = body.template_name || body.templateName;
        const context = body.context || { amount: body.amount || 0, category: body.category || 'general' };
        const data = await srv.createInstance(templateName, actorId, body.subject_type || body.subjectType, body.subject_id || body.subjectId, context);
        return { status: 'success', data };
    });
    fastify.get('/pending', async (request, reply) => {
        const srv = new workflow_service_1.WorkflowService((0, connection_1.getDb)());
        const actorId = request.headers['x-user-id'] || request.user?.id || seed_1.DEMO_USER;
        const instances = await srv.getPendingApprovals(actorId);
        return { status: 'success', data: { instances }, meta: { total: instances.length } };
    });
    fastify.get('/submitted', async (request, reply) => {
        const srv = new workflow_service_1.WorkflowService((0, connection_1.getDb)());
        const actorId = request.headers['x-user-id'] || request.user?.id || seed_1.DEMO_USER;
        const instances = await srv.getForInitiator(actorId);
        return { status: 'success', data: { instances }, meta: { total: instances.length } };
    });
    fastify.get('/:id/timeline', async (request, reply) => {
        const srv = new workflow_service_1.WorkflowService((0, connection_1.getDb)());
        const data = await srv.getWorkflowTimeline(request.params.id);
        return { status: 'success', data };
    });
    fastify.post('/:id/action', async (request, reply) => {
        const srv = new workflow_service_1.WorkflowService((0, connection_1.getDb)());
        const actorId = request.headers['x-user-id'] || request.user?.id || seed_1.DEMO_USER;
        const body = request.body;
        const data = await srv.processAction(request.params.id, actorId, body.action, body.note);
        return { status: 'success', data };
    });
};
exports.default = workflowRoutes;
