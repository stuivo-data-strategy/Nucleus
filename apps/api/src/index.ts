import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import jwt from '@fastify/jwt';
import sensible from '@fastify/sensible';
import autoload from '@fastify/autoload';
import path from 'path';
import 'dotenv/config';

import { config } from './config';
import { dbConnection } from './db/connection';

const server = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
    },
  },
});

async function buildServer() {
  await server.register(cors, { origin: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] });
  await server.register(fastifyWebsocket);
  await server.register(sensible);
  await server.register(jwt, { secret: config.jwtSecret });

  await server.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: { title: 'Nucleus API', version: '1.0.0' },
    },
  });
  await server.register(swaggerUi, {
    routePrefix: '/docs',
  });

  await server.register(autoload, {
    dir: path.join(__dirname, 'plugins'),
  });

  await server.register(autoload, {
    dir: path.join(__dirname, 'routes'),
    options: { prefix: '/api/v1' }
  });

  return server;
}

const start = async () => {
  try {
    await buildServer();
    await dbConnection.connect();
    
    await server.listen({ port: config.port, host: config.host });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();

process.on('SIGINT', async () => {
  await dbConnection.close();
  await server.close();
  process.exit(0);
});
// trigger reload

