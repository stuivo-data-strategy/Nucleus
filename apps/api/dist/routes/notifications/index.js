"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const connection_1 = require("../../db/connection");
const seed_1 = require("../../db/seed");
const notifRoutes = async (fastify, opts) => {
    fastify.get('/', async (request, reply) => {
        const db = (0, connection_1.getDb)();
        const actorId = request.headers['x-user-id'] || seed_1.DEMO_USER;
        const res = await db.query(`SELECT * FROM notification WHERE recipient = $recipient ORDER BY created_at DESC`, { recipient: actorId });
        const data = res[0];
        return { data, meta: { total: data.length } };
    });
    fastify.patch('/:id/read', async (request, reply) => {
        const db = (0, connection_1.getDb)();
        const actorId = request.headers['x-user-id'] || seed_1.DEMO_USER;
        const id = request.params.id;
        // ensure belongs to actorId
        const res = await db.query(`UPDATE ${id} MERGE { read: true } WHERE recipient = $recipient`, { recipient: actorId });
        const arr = res[0];
        return { data: arr[0] };
    });
};
exports.default = notifRoutes;
