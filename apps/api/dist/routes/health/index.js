"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const healthRoute = async (fastify, opts) => {
    fastify.get('/', async function (request, reply) {
        return { status: 'ok', db: 'connected' };
    });
};
exports.default = healthRoute;
