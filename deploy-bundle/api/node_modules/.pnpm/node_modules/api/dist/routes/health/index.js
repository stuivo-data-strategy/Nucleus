"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const connection_1 = require("../../db/connection");
const healthRoute = async (fastify, opts) => {
    fastify.get('/', async function (request, reply) {
        try {
            const db = (0, connection_1.getDb)();
            const status = connection_1.dbConnection.getStatus() ? 'connected' : 'disconnected';
            const result = await db.query('INFO FOR DB');
            let tableCount = 0;
            if (result && Array.isArray(result) && result[0]) {
                const info = result[0];
                if (info.tables) {
                    tableCount = Object.keys(info.tables).length;
                }
            }
            return { status: 'ok', db: status, tables: tableCount };
        }
        catch (error) {
            return reply.status(500).send({ status: 'error', db: 'disconnected', error: String(error) });
        }
    });
};
exports.default = healthRoute;
