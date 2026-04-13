import { FastifyPluginAsync } from 'fastify';
import { ExpenseService } from '../../services/expense.service';
import { getDb } from '../../db/connection';
import { DEMO_USER } from '../../db/constants';

const expenseRoutes: FastifyPluginAsync = async (fastify): Promise<void> => {
  // ─── Helpers ──────────────────────────────────────────────────────────────

  function actorId(request: any): string {
    return request.headers['x-user-id'] || request.user?.id || DEMO_USER;
  }

  function srv(): ExpenseService {
    return new ExpenseService(getDb());
  }

  // ─── GET /expenses ─────────────────────────────────────────────────────────
  // Query param ?role=claimant (default) | approver

  fastify.get('/', async (request: any, reply) => {
    const role = (request.query as any).role || 'claimant';
    const actor = actorId(request);
    try {
      const service = srv();
      const claims =
        role === 'approver'
          ? await service.getClaimsForApprover(actor)
          : await service.getClaimsForClaimant(actor);
      return {
        status: 'success',
        data: { claims },
        meta: { total: claims.length, role },
      };
    } catch (err: any) {
      fastify.log.error({ err, actor, role }, 'GET /expenses failed');
      return reply.status(500).send({ status: 'error', message: err.message });
    }
  });

  // ─── GET /expenses/pending ──────────────────────────────────────────────────
  // Convenience alias for approver view

  fastify.get('/pending', async (request: any, reply) => {
    const actor = actorId(request);
    const claims = await srv().getClaimsForApprover(actor);
    return {
      status: 'success',
      data: { claims },
      meta: { total: claims.length },
    };
  });

  // ─── POST /expenses/preview-route ──────────────────────────────────────────

  fastify.post('/preview-route', async (request: any, reply) => {
    const actor = actorId(request);
    const body = request.body as any;
    const context = {
      amount: Number(body.amount ?? 0),
      category: body.category ?? 'general',
    };
    const data = await srv().previewRoute(actor, context);
    return { status: 'success', data };
  });

  // ─── POST /expenses/ocr-scan ───────────────────────────────────────────────

  fastify.post('/ocr-scan', async (request: any, reply) => {
    const result = await srv().simulateOcr();
    return { status: 'success', data: result };
  });

  // ─── GET /expenses/approved ────────────────────────────────────────────────

  fastify.get('/approved', async (request: any, reply) => {
    const actor = actorId(request);
    try {
      const result = await srv().getApprovedForFinance(actor);
      return { status: 'success', data: result };
    } catch (err: any) {
      if (err.statusCode === 403) {
        return reply.status(403).send({ status: 'error', message: err.message });
      }
      throw err;
    }
  });

  // ─── POST /expenses/export ─────────────────────────────────────────────────

  fastify.post('/export', async (request: any, reply) => {
    const actor = actorId(request);
    try {
      const result = await srv().exportApproved(actor);
      return { status: 'success', data: result };
    } catch (err: any) {
      if (err.statusCode === 403) {
        return reply.status(403).send({ status: 'error', message: err.message });
      }
      throw err;
    }
  });

  // ─── POST /expenses/mark-posted ────────────────────────────────────────────

  fastify.post('/mark-posted', async (request: any, reply) => {
    const body = request.body as any;
    const claimIds: string[] = Array.isArray(body?.claim_ids) ? body.claim_ids : [];
    if (claimIds.length === 0) {
      return reply.status(400).send({ status: 'error', message: 'claim_ids array is required' });
    }
    const result = await srv().markPosted(claimIds);
    return { status: 'success', data: result };
  });

  // ─── POST /expenses ─────────────────────────────────────────────────────────

  fastify.post('/', async (request: any, reply) => {
    const actor = actorId(request);
    const body = request.body as any;

    try {
      const result = await srv().submitClaim(actor, {
        category: body.category,
        amount: Number(body.amount),
        date: body.date,
        has_receipt: Boolean(body.has_receipt),
        description: body.description ?? '',
        currency: body.currency,
        receipt_url: body.receipt_url,
        // Partial claim
        receipt_amount: body.receipt_amount != null ? Number(body.receipt_amount) : undefined,
        claim_amount:   body.claim_amount   != null ? Number(body.claim_amount)   : undefined,
        partial_claim:  body.partial_claim  != null ? Boolean(body.partial_claim) : undefined,
        partial_reason: body.partial_reason,
        // Exception
        exception_requested:    body.exception_requested    != null ? Boolean(body.exception_requested) : undefined,
        exception_justification: body.exception_justification,
      });
      return reply.status(201).send({ status: 'success', data: result });
    } catch (err: any) {
      if (err.statusCode === 400) {
        return reply.status(400).send({
          status: 'error',
          message: err.message,
          policy_result: err.policy_result,
        });
      }
      throw err;
    }
  });

  // ─── GET /expenses/:id ─────────────────────────────────────────────────────

  fastify.get('/:id', async (request: any, reply) => {
    try {
      const data = await srv().getClaimDetail(request.params.id);
      return { status: 'success', data };
    } catch (err: any) {
      if (err.statusCode === 404) {
        return reply.status(404).send({ status: 'error', message: err.message });
      }
      throw err;
    }
  });

  // ─── POST /expenses/:id/action ─────────────────────────────────────────────

  fastify.post('/:id/action', async (request: any, reply) => {
    const actor = actorId(request);
    const body = request.body as any;
    const action = body?.action as 'approve' | 'reject' | 'query' | 'respond';

    if (!action) {
      return reply.status(400).send({ status: 'error', message: 'action is required' });
    }

    try {
      const result = await srv().processAction(request.params.id, actor, action, body.note);
      return { status: 'success', data: result };
    } catch (err: any) {
      if (err.statusCode === 404) {
        return reply.status(404).send({ status: 'error', message: err.message });
      }
      if (err.statusCode === 409) {
        return reply.status(409).send({ status: 'error', message: err.message });
      }
      // 403 / auth errors from workflow service
      if (err.message?.toLowerCase().includes('not the current approver') ||
          err.message?.toLowerCase().includes('only the initiator')) {
        return reply.status(403).send({ status: 'error', message: err.message });
      }
      throw err;
    }
  });
};

export default expenseRoutes;
