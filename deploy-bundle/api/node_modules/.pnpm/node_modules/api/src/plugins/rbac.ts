import fp from 'fastify-plugin';
import { FastifyReply, FastifyRequest } from 'fastify';

export default fp(async (fastify, opts) => {
  fastify.decorate('requirePermission', (requiredPermission: string) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
       const user = (request as any).user;
       if (!user || !user.permissions) {
         reply.code(403).send({ error: 'Forbidden', message: 'No permissions found' });
         return;
       }

       if (user.permissions.includes('*:*:*')) return; // system admin

       const [reqMod, reqAct, reqScope] = requiredPermission.split(':');
       
       let hasMatch = false;
       for (const p of user.permissions) {
          const [mod, act, scope] = p.split(':');
          if ((mod === reqMod || mod === '*') && (act === reqAct || act === '*')) {
             hasMatch = true;
             break;
          }
       }

       if (!hasMatch) {
         reply.code(403).send({ error: 'Forbidden', message: 'Missing required permission' });
       }
    };
  });
});
