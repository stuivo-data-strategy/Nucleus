"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const audit_service_1 = require("../../services/audit.service");
const connection_1 = require("../../db/connection");
const constants_1 = require("../../db/constants");
const auditRoutes = async (fastify) => {
    function auditorId(request) {
        return request.headers['x-user-id'] || request.user?.id || constants_1.DEMO_USER;
    }
    function srv() {
        return new audit_service_1.AuditService((0, connection_1.getDb)());
    }
    // ─── GET /audit/stats ─────────────────────────────────────────────────────
    fastify.get('/stats', async (request, reply) => {
        try {
            const stats = await srv().getStats();
            return { status: 'success', data: stats };
        }
        catch (err) {
            return reply.status(500).send({ status: 'error', message: err.message });
        }
    });
    // ─── GET /audit/queue ─────────────────────────────────────────────────────
    fastify.get('/queue', async (request, reply) => {
        try {
            const items = await srv().getQueue();
            return { status: 'success', data: { claims: items, total: items.length } };
        }
        catch (err) {
            return reply.status(500).send({ status: 'error', message: err.message });
        }
    });
    // ─── GET /audit/flagged ───────────────────────────────────────────────────
    fastify.get('/flagged', async (request, reply) => {
        try {
            const items = await srv().getFlagged();
            return { status: 'success', data: { claims: items, total: items.length } };
        }
        catch (err) {
            return reply.status(500).send({ status: 'error', message: err.message });
        }
    });
    // ─── POST /audit/:id/clear ────────────────────────────────────────────────
    fastify.post('/:id/clear', async (request, reply) => {
        const claimId = decodeURIComponent(request.params.id);
        const actor = auditorId(request);
        try {
            await srv().clearClaim(claimId, actor);
            return { status: 'success' };
        }
        catch (err) {
            return reply.status(500).send({ status: 'error', message: err.message });
        }
    });
    // ─── POST /audit/batch-clear ──────────────────────────────────────────────
    fastify.post('/batch-clear', async (request, reply) => {
        const actor = auditorId(request);
        const body = request.body;
        const claimIds = Array.isArray(body?.claim_ids) ? body.claim_ids : [];
        if (claimIds.length === 0) {
            return reply.status(400).send({ status: 'error', message: 'claim_ids required' });
        }
        try {
            const count = await srv().batchClear(claimIds, actor);
            return { status: 'success', data: { cleared: count } };
        }
        catch (err) {
            return reply.status(500).send({ status: 'error', message: err.message });
        }
    });
    // ─── POST /audit/:id/flag ─────────────────────────────────────────────────
    fastify.post('/:id/flag', async (request, reply) => {
        const claimId = decodeURIComponent(request.params.id);
        const actor = auditorId(request);
        const body = request.body;
        const reason = body?.reason ?? '';
        const notes = body?.notes ?? '';
        if (!reason) {
            return reply.status(400).send({ status: 'error', message: 'reason is required' });
        }
        try {
            await srv().flagClaim(claimId, actor, reason, notes);
            return { status: 'success' };
        }
        catch (err) {
            return reply.status(500).send({ status: 'error', message: err.message });
        }
    });
    // ─── POST /audit/:id/resolve ──────────────────────────────────────────────
    fastify.post('/:id/resolve', async (request, reply) => {
        const claimId = decodeURIComponent(request.params.id);
        const actor = auditorId(request);
        try {
            await srv().resolveClaim(claimId, actor);
            return { status: 'success' };
        }
        catch (err) {
            return reply.status(500).send({ status: 'error', message: err.message });
        }
    });
};
exports.default = auditRoutes;
