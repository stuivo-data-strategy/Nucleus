import { FastifyPluginAsync } from 'fastify';
import { PeopleService } from '../../services/people.service';
import { getDb } from '../../db/connection';
import { DEMO_USER } from '../../db/constants';

const peopleRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get('/', async (request: any, reply) => {
    const srv = new PeopleService(getDb());
    if (request.query.q) {
      const data = await srv.searchPeople(request.query.q, request.query) as any[];
      return { data, meta: { total: data.length } };
    }
    const result = await srv.listPeople(request.query);
    return result;
  });

  fastify.get('/me', async (request: any, reply) => {
    const srv = new PeopleService(getDb());
    // Use auth data/demo user for bypass
    const actorId = request.headers['x-user-id'] || DEMO_USER;
    const data = await srv.getPerson(actorId);
    return { data };
  });

  fastify.get('/:id', async (request: any, reply) => {
    const srv = new PeopleService(getDb());
    const data = await srv.getPerson(request.params.id);
    return { data };
  });

  fastify.get('/:id/reports', async (request: any, reply) => {
    const srv = new PeopleService(getDb());
    const data = await srv.getDirectReports(request.params.id);
    return { data, meta: { total: data.length } };
  });

  fastify.get('/:id/chain', async (request: any, reply) => {
    const srv = new PeopleService(getDb());
    const data = await srv.getReportingChain(request.params.id);
    return { data, meta: { total: data.length } };
  });

  fastify.get('/:id/history', async (request: any, reply) => {
    const srv = new PeopleService(getDb());
    const data = await srv.getEmploymentHistory(request.params.id);
    return { data };
  });

  fastify.get('/:id/permissions', async (request: any, reply) => {
    const srv = new PeopleService(getDb());
    const data = await srv.getPermissions(request.params.id);
    return { data };
  });

  fastify.get('/:id/context', async (request: any, reply) => {
    const srv = new PeopleService(getDb());
    const data = await srv.getPersonContext(request.params.id);
    if (!data) return reply.code(404).send({ error: 'Person not found' });
    return { data };
  });
};

export default peopleRoutes;
