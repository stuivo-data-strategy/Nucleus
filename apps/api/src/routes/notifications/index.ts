import { FastifyPluginAsync } from 'fastify';
import { getDb } from '../../db/connection';
import { DEMO_USER } from '../../db/seed';

const notifRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get('/', async (request: any, reply) => {
    const db = getDb();
    const actorId = request.headers['x-user-id'] || DEMO_USER;
    const res = await db.query(`SELECT * FROM notification WHERE recipient = $recipient ORDER BY created_at DESC`, { recipient: actorId });
    const data = res[0] as any[];
    return { data, meta: { total: data.length } };
  });

  fastify.patch('/:id/read', async (request: any, reply) => {
    const db = getDb();
    const actorId = request.headers['x-user-id'] || DEMO_USER;
    const id = request.params.id;
    // ensure belongs to actorId
    const res = await db.query(`UPDATE ${id} MERGE { read: true } WHERE recipient = $recipient`, { recipient: actorId });
    const arr = res[0] as any[];
    return { data: arr[0] };
  });
};

export default notifRoutes;
