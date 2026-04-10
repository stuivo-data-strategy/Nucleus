"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const wsRoutes = async (fastify, opts) => {
    fastify.get('/', { websocket: true }, (connection, req) => {
        connection.socket.on('message', (message) => {
            const msg = message.toString();
            if (msg === 'ping')
                connection.socket.send('pong');
        });
        // Placeholder: Connect to SurrealDB LIVE SELECT on notifications for req.user
    });
};
exports.default = wsRoutes;
