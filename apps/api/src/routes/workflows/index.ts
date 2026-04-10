import { FastifyPluginAsync } from 'fastify';
import { WorkflowService } from '../../services/workflow.service';
import { getDb } from '../../db/connection';
import { DEMO_USER } from '../../db/seed';

const workflowRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.post('/resolve-preview', async (request: any, reply) => {
    const srv = new WorkflowService(getDb());
    const actorId = request.headers['x-user-id'] || request.user?.id || DEMO_USER;
    const body = request.body as any;
    
    // Default template and empty context if none provided for testing
    const templateName = body.template_name || body.templateName || 'expense_approval';
    const context = body.context || { amount: body.amount || 0, category: body.category || 'general' };
    
    const data = await srv.resolveApprovalChain(templateName, actorId, context);
    return { status: 'success', data };
  });

  fastify.post('/', async (request: any, reply) => {
    const srv = new WorkflowService(getDb());
    const actorId = request.headers['x-user-id'] || request.user?.id || DEMO_USER;
    const body = request.body as any;
    
    const templateName = body.template_name || body.templateName;
    const context = body.context || { amount: body.amount || 0, category: body.category || 'general' };

    const data = await srv.createInstance(
       templateName, 
       actorId, 
       body.subject_type || body.subjectType, 
       body.subject_id || body.subjectId, 
       context
    );
    return { status: 'success', data };
  });

  fastify.get('/pending', async (request: any, reply) => {
    const srv = new WorkflowService(getDb());
    const actorId = request.headers['x-user-id'] || request.user?.id || DEMO_USER;
    
    const instances = await srv.getPendingApprovals(actorId);
    return { status: 'success', data: { instances }, meta: { total: instances.length } };
  });

  fastify.get('/submitted', async (request: any, reply) => {
    const srv = new WorkflowService(getDb());
    const actorId = request.headers['x-user-id'] || request.user?.id || DEMO_USER;
    
    const instances = await srv.getForInitiator(actorId);
    return { status: 'success', data: { instances }, meta: { total: instances.length } };
  });

  fastify.get('/:id/timeline', async (request: any, reply) => {
    const srv = new WorkflowService(getDb());
    const data = await srv.getWorkflowTimeline(request.params.id);
    return { status: 'success', data };
  });

  fastify.post('/:id/action', async (request: any, reply) => {
    const srv = new WorkflowService(getDb());
    const actorId = request.headers['x-user-id'] || request.user?.id || DEMO_USER;
    const body = request.body as any;
    const data = await srv.processAction(request.params.id, actorId, body.action, body.note);
    return { status: 'success', data };
  });
};

export default workflowRoutes;
