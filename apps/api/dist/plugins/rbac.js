"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
exports.default = (0, fastify_plugin_1.default)(async (fastify, opts) => {
    fastify.decorate('requirePermission', (requiredPermission) => {
        return async (request, reply) => {
            const user = request.user;
            if (!user || !user.permissions) {
                reply.code(403).send({ error: 'Forbidden', message: 'No permissions found' });
                return;
            }
            if (user.permissions.includes('*:*:*'))
                return; // system admin
            const [reqMod, reqAct, reqScope] = requiredPermission.split(':');
            let hasMatch = false;
            for (const p of user.permissions) {
                const [mod, act, scope] = p.split(':');
                if ((mod === reqMod || mod === '*') && (act === reqAct || act === '*')) {
                    hasMatch = true;
                    break;
                }
            }
            if (!hasMatch) {
                reply.code(403).send({ error: 'Forbidden', message: 'Missing required permission' });
            }
        };
    });
});
