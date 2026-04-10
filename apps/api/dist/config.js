"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.config = {
    port: parseInt(process.env.API_PORT || '3001', 10),
    host: process.env.API_HOST || '0.0.0.0',
    jwtSecret: process.env.JWT_SECRET || 'nucleus-dev-secret',
    surreal: {
        url: process.env.SURREAL_URL || 'ws://localhost:8000/rpc',
        ns: process.env.SURREAL_NS || 'nucleus',
        db: process.env.SURREAL_DB || 'nucleus',
        user: process.env.SURREAL_USER || 'root',
        pass: process.env.SURREAL_PASS || 'root'
    }
};
