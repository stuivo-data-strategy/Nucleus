"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vat_service_1 = require("../../services/vat.service");
const connection_1 = require("../../db/connection");
const constants_1 = require("../../db/constants");
const vatRoutes = async (fastify) => {
    function officerId(request) {
        return request.headers['x-user-id'] || request.user?.id || constants_1.DEMO_USER;
    }
    function srv() {
        return new vat_service_1.VatService((0, connection_1.getDb)());
    }
    // ─── GET /vat/stats ───────────────────────────────────────────────────────
    fastify.get('/stats', async (request, reply) => {
        const period = request.query?.period ?? currentPeriod();
        try {
            const stats = await srv().getStats(period);
            return { status: 'success', data: stats };
        }
        catch (err) {
            return reply.status(500).send({ status: 'error', message: err.message });
        }
    });
    // ─── GET /vat/queue ───────────────────────────────────────────────────────
    fastify.get('/queue', async (request, reply) => {
        const period = request.query?.period ?? currentPeriod();
        try {
            const items = await srv().getQueue(period);
            return { status: 'success', data: { claims: items, total: items.length } };
        }
        catch (err) {
            return reply.status(500).send({ status: 'error', message: err.message });
        }
    });
    // ─── GET /vat/summary ─────────────────────────────────────────────────────
    fastify.get('/summary', async (request, reply) => {
        const period = request.query?.period ?? currentPeriod();
        try {
            const rows = await srv().getSummary(period);
            return { status: 'success', data: { rows, period } };
        }
        catch (err) {
            return reply.status(500).send({ status: 'error', message: err.message });
        }
    });
    // ─── POST /vat/:id/classify ───────────────────────────────────────────────
    fastify.post('/:id/classify', async (request, reply) => {
        const claimId = decodeURIComponent(request.params.id);
        const actor = officerId(request);
        const body = request.body;
        const classification = body?.classification;
        if (!classification) {
            return reply.status(400).send({ status: 'error', message: 'classification is required' });
        }
        const period = body?.period ?? currentPeriod();
        const businessPortion = body?.business_portion != null ? Number(body.business_portion) : undefined;
        const supplierVatNumber = body?.supplier_vat_number || undefined;
        try {
            await srv().classifyClaim(claimId, actor, classification, businessPortion, supplierVatNumber, period);
            return { status: 'success' };
        }
        catch (err) {
            return reply.status(500).send({ status: 'error', message: err.message });
        }
    });
    // ─── POST /vat/export ─────────────────────────────────────────────────────
    fastify.post('/export', async (request, reply) => {
        const body = request.body;
        const period = body?.period ?? currentPeriod();
        try {
            const csv = await srv().exportVAT(period);
            reply.header('Content-Type', 'text/csv');
            reply.header('Content-Disposition', `attachment; filename="vat-${period}.csv"`);
            return reply.send(csv);
        }
        catch (err) {
            return reply.status(500).send({ status: 'error', message: err.message });
        }
    });
};
function currentPeriod() {
    const now = new Date();
    const q = Math.ceil((now.getMonth() + 1) / 3);
    return `${now.getFullYear()}-Q${q}`;
}
exports.default = vatRoutes;
