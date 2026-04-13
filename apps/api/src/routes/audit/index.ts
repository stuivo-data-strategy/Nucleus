import { FastifyPluginAsync } from 'fastify';
import { AuditService } from '../../services/audit.service';
import { getDb } from '../../db/connection';
import { DEMO_USER } from '../../db/constants';

const auditRoutes: FastifyPluginAsync = async (fastify): Promise<void> => {

  function auditorId(request: any): string {
    return request.headers['x-user-id'] || request.user?.id || DEMO_USER;
  }

  function srv(): AuditService {
    return new AuditService(getDb());
  }

  // ─── GET /audit/stats ─────────────────────────────────────────────────────

  fastify.get('/stats', async (request, reply) => {
    try {
      const stats = await srv().getStats();
      return { status: 'success', data: stats };
    } catch (err: any) {
      return reply.status(500).send({ status: 'error', message: err.message });
    }
  });

  // ─── GET /audit/queue ─────────────────────────────────────────────────────

  fastify.get('/queue', async (request, reply) => {
    try {
      const items = await srv().getQueue();
      return { status: 'success', data: { claims: items, total: items.length } };
    } catch (err: any) {
      return reply.status(500).send({ status: 'error', message: err.message });
    }
  });

  // ─── GET /audit/flagged ───────────────────────────────────────────────────

  fastify.get('/flagged', async (request, reply) => {
    try {
      const items = await srv().getFlagged();
      return { status: 'success', data: { claims: items, total: items.length } };
    } catch (err: any) {
      return reply.status(500).send({ status: 'error', message: err.message });
    }
  });

  // ─── POST /audit/:id/clear ────────────────────────────────────────────────

  fastify.post('/:id/clear', async (request: any, reply) => {
    const claimId = decodeURIComponent(request.params.id);
    const actor = auditorId(request);
    try {
      await srv().clearClaim(claimId, actor);
      return { status: 'success' };
    } catch (err: any) {
      return reply.status(500).send({ status: 'error', message: err.message });
    }
  });

  // ─── POST /audit/batch-clear ──────────────────────────────────────────────

  fastify.post('/batch-clear', async (request: any, reply) => {
    const actor = auditorId(request);
    const body = request.body as any;
    const claimIds: string[] = Array.isArray(body?.claim_ids) ? body.claim_ids : [];
    if (claimIds.length === 0) {
      return reply.status(400).send({ status: 'error', message: 'claim_ids required' });
    }
    try {
      const count = await srv().batchClear(claimIds, actor);
      return { status: 'success', data: { cleared: count } };
    } catch (err: any) {
      return reply.status(500).send({ status: 'error', message: err.message });
    }
  });

  // ─── POST /audit/:id/flag ─────────────────────────────────────────────────

  fastify.post('/:id/flag', async (request: any, reply) => {
    const claimId = decodeURIComponent(request.params.id);
    const actor = auditorId(request);
    const body = request.body as any;
    const reason: string = body?.reason ?? '';
    const notes: string  = body?.notes  ?? '';
    if (!reason) {
      return reply.status(400).send({ status: 'error', message: 'reason is required' });
    }
    try {
      await srv().flagClaim(claimId, actor, reason, notes);
      return { status: 'success' };
    } catch (err: any) {
      return reply.status(500).send({ status: 'error', message: err.message });
    }
  });

  // ─── POST /audit/:id/resolve ──────────────────────────────────────────────

  fastify.post('/:id/resolve', async (request: any, reply) => {
    const claimId = decodeURIComponent(request.params.id);
    const actor = auditorId(request);
    try {
      await srv().resolveClaim(claimId, actor);
      return { status: 'success' };
    } catch (err: any) {
      return reply.status(500).send({ status: 'error', message: err.message });
    }
  });

};

export default auditRoutes;
