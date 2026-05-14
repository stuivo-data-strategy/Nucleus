import { FastifyPluginAsync } from 'fastify';
import { OrgService } from '../../services/org.service';
import { getDb } from '../../db/connection';

const orgRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get('/tree', async (request: any, reply) => {
    const srv = new OrgService(getDb());
    const query = request.query as any;
    const data = await srv.getOrgTree(query.rootId, query.depth);
    return { data };
  });

  fastify.get('/:id', async (request: any, reply) => {
    const srv = new OrgService(getDb());
    const data = await srv.getOrgUnit(request.params.id);
    return { data };
  });

  fastify.get('/:id/people', async (request: any, reply) => {
    const srv = new OrgService(getDb());
    const data = await srv.getPeopleInUnit(request.params.id, (request.query as any).recursive === 'true') as any[];
    return { data, meta: { total: data.length } };
  });

  fastify.get('/:id/headcount', async (request: any, reply) => {
    const srv = new OrgService(getDb());
    const data = await srv.getHeadcountSummary(request.params.id);
    return { data };
  });
};

export default orgRoutes;
