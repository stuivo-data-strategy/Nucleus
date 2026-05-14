import { FastifyPluginAsync } from 'fastify';
import { PositionService } from '../../services/position.service';
import { getDb } from '../../db/connection';

const positionsRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get('/', async (request: any, reply) => {
    const srv = new PositionService(getDb());
    const data = await srv.getPositionTree(); // simplistic fallback
    return { data };
  });

  fastify.get('/vacancies', async (request: any, reply) => {
    const srv = new PositionService(getDb());
    const data = await srv.getVacancies((request.query as any).orgUnitId) as any[];
    return { data, meta: { total: data.length } };
  });

  fastify.get('/:id', async (request: any, reply) => {
    const srv = new PositionService(getDb());
    const data = await srv.getPositionContext(request.params.id);
    return { data };
  });

  fastify.post('/', async (request: any, reply) => {
    const srv = new PositionService(getDb());
    const data = await srv.createPosition(request.body);
    return { data };
  });

  fastify.patch('/:id', async (request: any, reply) => {
    const srv = new PositionService(getDb());
    const data = await srv.updatePosition(request.params.id, request.body);
    return { data };
  });
};

export default positionsRoutes;
