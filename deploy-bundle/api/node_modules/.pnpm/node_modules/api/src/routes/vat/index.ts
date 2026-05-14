import { FastifyPluginAsync } from 'fastify';
import { VatService, VatClassification } from '../../services/vat.service';
import { getDb } from '../../db/connection';
import { DEMO_USER } from '../../db/constants';

const vatRoutes: FastifyPluginAsync = async (fastify): Promise<void> => {

  function officerId(request: any): string {
    return request.headers['x-user-id'] || request.user?.id || DEMO_USER;
  }

  function srv(): VatService {
    return new VatService(getDb());
  }

  // ─── GET /vat/stats ───────────────────────────────────────────────────────

  fastify.get('/stats', async (request: any, reply) => {
    const period: string = (request.query as any)?.period ?? currentPeriod();
    try {
      const stats = await srv().getStats(period);
      return { status: 'success', data: stats };
    } catch (err: any) {
      return reply.status(500).send({ status: 'error', message: err.message });
    }
  });

  // ─── GET /vat/queue ───────────────────────────────────────────────────────

  fastify.get('/queue', async (request: any, reply) => {
    const period: string = (request.query as any)?.period ?? currentPeriod();
    try {
      const items = await srv().getQueue(period);
      return { status: 'success', data: { claims: items, total: items.length } };
    } catch (err: any) {
      return reply.status(500).send({ status: 'error', message: err.message });
    }
  });

  // ─── GET /vat/summary ─────────────────────────────────────────────────────

  fastify.get('/summary', async (request: any, reply) => {
    const period: string = (request.query as any)?.period ?? currentPeriod();
    try {
      const rows = await srv().getSummary(period);
      return { status: 'success', data: { rows, period } };
    } catch (err: any) {
      return reply.status(500).send({ status: 'error', message: err.message });
    }
  });

  // ─── POST /vat/:id/classify ───────────────────────────────────────────────

  fastify.post('/:id/classify', async (request: any, reply) => {
    const claimId = decodeURIComponent(request.params.id);
    const actor   = officerId(request);
    const body    = request.body as any;

    const classification: VatClassification = body?.classification;
    if (!classification) {
      return reply.status(400).send({ status: 'error', message: 'classification is required' });
    }
    const period: string = body?.period ?? currentPeriod();
    const businessPortion: number | undefined = body?.business_portion != null ? Number(body.business_portion) : undefined;
    const supplierVatNumber: string | undefined = body?.supplier_vat_number || undefined;

    try {
      await srv().classifyClaim(claimId, actor, classification, businessPortion, supplierVatNumber, period);
      return { status: 'success' };
    } catch (err: any) {
      return reply.status(500).send({ status: 'error', message: err.message });
    }
  });

  // ─── POST /vat/export ─────────────────────────────────────────────────────

  fastify.post('/export', async (request: any, reply) => {
    const body   = request.body as any;
    const period: string = body?.period ?? currentPeriod();
    try {
      const csv = await srv().exportVAT(period);
      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', `attachment; filename="vat-${period}.csv"`);
      return reply.send(csv);
    } catch (err: any) {
      return reply.status(500).send({ status: 'error', message: err.message });
    }
  });

};

function currentPeriod(): string {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()}-Q${q}`;
}

export default vatRoutes;
