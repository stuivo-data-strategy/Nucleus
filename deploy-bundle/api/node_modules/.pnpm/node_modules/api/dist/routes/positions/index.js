"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const position_service_1 = require("../../services/position.service");
const connection_1 = require("../../db/connection");
const positionsRoutes = async (fastify, opts) => {
    fastify.get('/', async (request, reply) => {
        const srv = new position_service_1.PositionService((0, connection_1.getDb)());
        const data = await srv.getPositionTree(); // simplistic fallback
        return { data };
    });
    fastify.get('/vacancies', async (request, reply) => {
        const srv = new position_service_1.PositionService((0, connection_1.getDb)());
        const data = await srv.getVacancies(request.query.orgUnitId);
        return { data, meta: { total: data.length } };
    });
    fastify.get('/:id', async (request, reply) => {
        const srv = new position_service_1.PositionService((0, connection_1.getDb)());
        const data = await srv.getPositionContext(request.params.id);
        return { data };
    });
    fastify.post('/', async (request, reply) => {
        const srv = new position_service_1.PositionService((0, connection_1.getDb)());
        const data = await srv.createPosition(request.body);
        return { data };
    });
    fastify.patch('/:id', async (request, reply) => {
        const srv = new position_service_1.PositionService((0, connection_1.getDb)());
        const data = await srv.updatePosition(request.params.id, request.body);
        return { data };
    });
};
exports.default = positionsRoutes;
