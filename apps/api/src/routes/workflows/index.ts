import { FastifyPluginAsync } from 'fastify';
import { WorkflowService } from '../../services/workflow.service';
import { getDb } from '../../db/connection';
import { DEMO_USER } from '../../db/seed';

const workflowRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.post('/', async (request: any, reply) => {
    const srv = new WorkflowService(getDb());
    const actorId = request.headers['x-user-id'] || DEMO_USER;
    const body = request.body as any;
    const data = await srv.createInstance(body.templateName, actorId, body.subjectType, body.subjectId, body.context);
    return { data };
  });

  fastify.get('/pending', async (request: any, reply) => {
    const srv = new WorkflowService(getDb());
    const actorId = request.headers['x-user-id'] || DEMO_USER;
    const data = await srv.getPendingForApprover(actorId);
    return { data, meta: { total: data.length } };
  });

  fastify.get('/submitted', async (request: any, reply) => {
    const srv = new WorkflowService(getDb());
    const actorId = request.headers['x-user-id'] || DEMO_USER;
    const data = await srv.getForInitiator(actorId);
    return { data, meta: { total: data.length } };
  });

  fastify.get('/:id', async (request: any, reply) => {
    const srv = new WorkflowService(getDb());
    const data = await srv.getInstance(request.params.id);
    return { data };
  });

  fastify.post('/:id/action', async (request: any, reply) => {
    const srv = new WorkflowService(getDb());
    const actorId = request.headers['x-user-id'] || DEMO_USER;
    const body = request.body as any;
    const data = await srv.processAction(request.params.id, actorId, body.action, body.note);
    return { data };
  });
};

export default workflowRoutes;
