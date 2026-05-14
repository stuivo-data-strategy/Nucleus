"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const people_service_1 = require("../../services/people.service");
const connection_1 = require("../../db/connection");
const constants_1 = require("../../db/constants");
const peopleRoutes = async (fastify, opts) => {
    fastify.get('/', async (request, reply) => {
        const srv = new people_service_1.PeopleService((0, connection_1.getDb)());
        if (request.query.q) {
            const data = await srv.searchPeople(request.query.q, request.query);
            return { data, meta: { total: data.length } };
        }
        const result = await srv.listPeople(request.query);
        return result;
    });
    fastify.get('/me', async (request, reply) => {
        const srv = new people_service_1.PeopleService((0, connection_1.getDb)());
        // Use auth data/demo user for bypass
        const actorId = request.headers['x-user-id'] || constants_1.DEMO_USER;
        const data = await srv.getPerson(actorId);
        return { data };
    });
    fastify.get('/:id', async (request, reply) => {
        const srv = new people_service_1.PeopleService((0, connection_1.getDb)());
        const data = await srv.getPerson(request.params.id);
        return { data };
    });
    fastify.get('/:id/reports', async (request, reply) => {
        const srv = new people_service_1.PeopleService((0, connection_1.getDb)());
        const data = await srv.getDirectReports(request.params.id);
        return { data, meta: { total: data.length } };
    });
    fastify.get('/:id/chain', async (request, reply) => {
        const srv = new people_service_1.PeopleService((0, connection_1.getDb)());
        const data = await srv.getReportingChain(request.params.id);
        return { data, meta: { total: data.length } };
    });
    fastify.get('/:id/history', async (request, reply) => {
        const srv = new people_service_1.PeopleService((0, connection_1.getDb)());
        const data = await srv.getEmploymentHistory(request.params.id);
        return { data };
    });
    fastify.get('/:id/permissions', async (request, reply) => {
        const srv = new people_service_1.PeopleService((0, connection_1.getDb)());
        const data = await srv.getPermissions(request.params.id);
        return { data };
    });
    fastify.get('/:id/context', async (request, reply) => {
        const srv = new people_service_1.PeopleService((0, connection_1.getDb)());
        const data = await srv.getPersonContext(request.params.id);
        if (!data)
            return reply.code(404).send({ error: 'Person not found' });
        return { data };
    });
};
exports.default = peopleRoutes;
