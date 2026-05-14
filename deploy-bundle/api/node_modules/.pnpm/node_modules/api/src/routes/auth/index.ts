import { FastifyPluginAsync } from 'fastify';
import { PeopleService } from '../../services/people.service';
import { getDb } from '../../db/connection';

const authRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {

  fastify.post('/bypass', async (request: any, reply) => {
    const authMode = process.env.AUTH_MODE || 'bypass';
    if (authMode !== 'bypass') {
      return reply.code(403).send({ error: 'Bypass mode disabled' });
    }
    const { person_id } = request.body;
    const srv = new PeopleService(getDb());
    const person = await srv.getPerson(person_id);
    if (!person) return reply.code(404).send({ error: 'User not found' });

    const roles = (person.roles || []).map((r: any) => r.name);
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

  fastify.get('/me', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
    return { data: request.user };
  });

  fastify.get('/switch-options', async (request: any, reply) => {
    const srv = new PeopleService(getDb());
    const ids = ['person:sarah_chen', 'person:james_morton', 'person:peter_blackwell', 'person:peter_diciacca', 'person:amara_okafor', 'person:lisa_thornton', 'person:daniel_frost'];
    const users = await Promise.all(ids.map(id => srv.getPerson(id)));
    return { data: users.filter(u => !!u).map(u => ({
       id: u.id, name: `${u.first_name} ${u.last_name}`, title: u.job_title, avatar_url: u.avatar_url
    }))};
  });

};

export default authRoutes;
