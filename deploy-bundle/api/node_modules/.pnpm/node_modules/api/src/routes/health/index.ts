import { FastifyPluginAsync } from 'fastify';
import { dbConnection, getDb } from '../../db/connection';

const healthRoute: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get('/', async function (request, reply) {
    try {
      const db = getDb();
      const status = dbConnection.getStatus() ? 'connected' : 'disconnected';
      const result = await db.query('INFO FOR DB');
      
      let tableCount = 0;
      if (result && Array.isArray(result) && result[0]) {
        const info = result[0] as any;
        if (info.tables) {
          tableCount = Object.keys(info.tables).length;
        }
      }
      return { status: 'ok', db: status, tables: tableCount };
    } catch (error) {
      return reply.status(500).send({ status: 'error', db: 'disconnected', error: String(error) });
    }
  });
};

export default healthRoute;
