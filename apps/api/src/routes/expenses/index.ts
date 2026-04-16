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

  // ─── POST /calculate-distance ──────────────────────────────────────────────

  fastify.post('/calculate-distance', async (request: any, reply) => {
    // TODO: replace with Google Maps Distance Matrix API or OS Routes API
    // Expected incoming: { from: string; to: string }
    const body = request.body as any;
    const { from, to } = body;
    
    if (!from || !to) {
      return reply.status(400).send({ status: 'error', message: 'from and to are required' });
    }

    // Deterministic simulation
    const seedString = `${from.toLowerCase().trim()}|${to.toLowerCase().trim()}`;
    let hash = 0;
    for (let i = 0; i < seedString.length; i++) {
      hash = (Math.imul(31, hash) + seedString.charCodeAt(i)) | 0;
    }
    
    // Generate a distance between 2 and 280 miles based on hash
    const pseudoRandom = Math.abs(hash) / 2147483647; // 0 to 1
    const distanceMiles = Math.round((2 + pseudoRandom * 278) * 10) / 10;
    const durationMinutes = Math.round(distanceMiles * 1.5 + pseudoRandom * 20);

    return { 
      status: 'success', 
      data: { 
        distanceMiles, 
        durationMinutes, 
        route: "M62 · M1 · A1(M)" // mock route
      } 
    };
  });

  // ─── GET /expenses/mileage-profile ─────────────────────────────────────────
  
  fastify.get('/mileage-profile', async (request: any, reply) => {
    const actor = actorId(request);
    try {
      const db = getDb();
      // Fetch vehicles
      const vResult = await db.query(`SELECT * FROM vehicle WHERE owner = $actor`, { actor });
      const vehicles = (vResult[0] as any)?.result || [];
      // Fetch journeys
      const jResult = await db.query(`SELECT * FROM saved_journey WHERE owner = $actor`, { actor });
      const saved_journeys = (jResult[0] as any)?.result || [];
      // Fetch summary
      const mResult = await db.query(`SELECT * FROM mileage_summary WHERE person = $actor`, { actor });
      const summary = (mResult[0] as any)?.result?.[0] || { total_miles: 0 };
      
      return { 
        status: 'success', 
        data: { 
          vehicles,
          saved_journeys,
          total_miles: summary.total_miles
        } 
      };
    } catch(err: any) {
      return reply.status(500).send({ status: 'error', message: err.message });
    }
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
