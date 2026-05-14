"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const people_service_1 = require("../../services/people.service");
const connection_1 = require("../../db/connection");
const authRoutes = async (fastify, opts) => {
    fastify.post('/bypass', async (request, reply) => {
        const authMode = process.env.AUTH_MODE || 'bypass';
        if (authMode !== 'bypass') {
            return reply.code(403).send({ error: 'Bypass mode disabled' });
        }
        const { person_id } = request.body;
        const srv = new people_service_1.PeopleService((0, connection_1.getDb)());
        const person = await srv.getPerson(person_id);
        if (!person)
            return reply.code(404).send({ error: 'User not found' });
        const roles = (person.roles || []).map((r) => r.name);
        const perms = (await srv.getPermissions(person_id)) || [];
        const token = fastify.jwt.sign({
            sub: person.id,
            employee_id: person.employee_id,
            email: person.email,
            name: `${person.first_name} ${person.last_name}`,
            roles,
            permissions: perms,
            org_unit: person.org_unit,
            cost_centre: person.cost_centre,
            manager: person.manager
        }, { expiresIn: '8h' });
        return { data: { token } };
    });
    fastify.get('/me', { preValidation: [fastify.authenticate] }, async (request, reply) => {
        return { data: request.user };
    });
    fastify.get('/switch-options', async (request, reply) => {
        const srv = new people_service_1.PeopleService((0, connection_1.getDb)());
        const ids = ['person:sarah_chen', 'person:james_morton', 'person:peter_blackwell', 'person:peter_diciacca', 'person:amara_okafor', 'person:lisa_thornton', 'person:daniel_frost'];
        const users = await Promise.all(ids.map(id => srv.getPerson(id)));
        return { data: users.filter(u => !!u).map(u => ({
                id: u.id, name: `${u.first_name} ${u.last_name}`, title: u.job_title, avatar_url: u.avatar_url
            })) };
    });
};
exports.default = authRoutes;
