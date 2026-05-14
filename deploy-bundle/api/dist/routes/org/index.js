"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const org_service_1 = require("../../services/org.service");
const connection_1 = require("../../db/connection");
const orgRoutes = async (fastify, opts) => {
    fastify.get('/tree', async (request, reply) => {
        const srv = new org_service_1.OrgService((0, connection_1.getDb)());
        const query = request.query;
        const data = await srv.getOrgTree(query.rootId, query.depth);
        return { data };
    });
    fastify.get('/:id', async (request, reply) => {
        const srv = new org_service_1.OrgService((0, connection_1.getDb)());
        const data = await srv.getOrgUnit(request.params.id);
        return { data };
    });
    fastify.get('/:id/people', async (request, reply) => {
        const srv = new org_service_1.OrgService((0, connection_1.getDb)());
        const data = await srv.getPeopleInUnit(request.params.id, request.query.recursive === 'true');
        return { data, meta: { total: data.length } };
    });
    fastify.get('/:id/headcount', async (request, reply) => {
        const srv = new org_service_1.OrgService((0, connection_1.getDb)());
        const data = await srv.getHeadcountSummary(request.params.id);
        return { data };
    });
};
exports.default = orgRoutes;
