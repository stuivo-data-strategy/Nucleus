import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';

const wsRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get('/', { websocket: true }, (connection, req) => {
    connection.socket.on('message', message => {
      const msg = message.toString();
      if (msg === 'ping') connection.socket.send('pong');
    });
    // Placeholder: Connect to SurrealDB LIVE SELECT on notifications for req.user
  });
};

export default wsRoutes;
