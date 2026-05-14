import fp from 'fastify-plugin';
import { FastifyReply, FastifyRequest } from 'fastify';
import { PeopleService } from '../services/people.service';
import { getDb } from '../db/connection';

export default fp(async (fastify, opts) => {
  const authMode = process.env.AUTH_MODE || 'bypass';

  if (authMode === 'bypass') {
    fastify.log.warn('⚠️ AUTH_MODE=bypass — do not use in production');
  }

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      if (authMode === 'bypass') {
         const targetId = process.env.DEMO_USER || 'person:sarah_chen';
         const srv = new PeopleService(getDb());
         const person = await srv.getPerson(targetId);
         if (!person) throw new Error('Bypass demo user not found');
         const roles = (person.roles || []).map((r: any) => r.name);
         const perms = (await srv.getPermissions(targetId)) || [];
         (request as any).user = {
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
