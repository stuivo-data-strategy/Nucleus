"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const people_service_1 = require("../services/people.service");
const connection_1 = require("../db/connection");
exports.default = (0, fastify_plugin_1.default)(async (fastify, opts) => {
    const authMode = process.env.AUTH_MODE || 'bypass';
    if (authMode === 'bypass') {
        fastify.log.warn('⚠️ AUTH_MODE=bypass — do not use in production');
    }
    fastify.decorate('authenticate', async (request, reply) => {
        try {
            await request.jwtVerify();
        }
        catch (err) {
            if (authMode === 'bypass') {
                const targetId = process.env.DEMO_USER || 'person:sarah_chen';
                const srv = new people_service_1.PeopleService((0, connection_1.getDb)());
                const person = await srv.getPerson(targetId);
                if (!person)
                    throw new Error('Bypass demo user not found');
                const roles = (person.roles || []).map((r) => r.name);
                const perms = (await srv.getPermissions(targetId)) || [];
                request.user = {
                    sub: targetId,
                    employee_id: person.employee_id,
                    email: person.email,
                    name: `${person.first_name} ${person.last_name}`,
                    roles,
                    permissions: perms,
                    org_unit: person.org_unit,
                    cost_centre: person.cost_centre,
                    manager: person.manager
                };
                return;
            }
            reply.send(err);
        }
    });
});
