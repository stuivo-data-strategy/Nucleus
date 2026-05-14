"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const websocket_1 = __importDefault(require("@fastify/websocket"));
const cors_1 = __importDefault(require("@fastify/cors"));
const swagger_1 = __importDefault(require("@fastify/swagger"));
const swagger_ui_1 = __importDefault(require("@fastify/swagger-ui"));
const jwt_1 = __importDefault(require("@fastify/jwt"));
const sensible_1 = __importDefault(require("@fastify/sensible"));
const autoload_1 = __importDefault(require("@fastify/autoload"));
const path_1 = __importDefault(require("path"));
require("dotenv/config");
const config_1 = require("./config");
const connection_1 = require("./db/connection");
const server = (0, fastify_1.default)({
    logger: {
        transport: {
            target: 'pino-pretty',
        },
    },
});
async function buildServer() {
    await server.register(cors_1.default, { origin: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] });
    await server.register(websocket_1.default);
    await server.register(sensible_1.default);
    await server.register(jwt_1.default, { secret: config_1.config.jwtSecret });
    await server.register(swagger_1.default, {
        openapi: {
            openapi: '3.1.0',
            info: { title: 'Nucleus API', version: '1.0.0' },
        },
    });
    await server.register(swagger_ui_1.default, {
        routePrefix: '/docs',
    });
    await server.register(autoload_1.default, {
        dir: path_1.default.join(__dirname, 'plugins'),
    });
    await server.register(autoload_1.default, {
        dir: path_1.default.join(__dirname, 'routes'),
        options: { prefix: '/api/v1' }
    });
    return server;
}
const start = async () => {
    try {
        await buildServer();
        await connection_1.dbConnection.connect();
        await server.listen({ port: config_1.config.port, host: config_1.config.host });
    }
    catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};
start();
process.on('SIGINT', async () => {
    await connection_1.dbConnection.close();
    await server.close();
    process.exit(0);
});
// trigger reload
