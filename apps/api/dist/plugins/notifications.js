"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const core_1 = require("./adapters/core");
const teams_adapter_1 = require("./adapters/teams.adapter");
class NotificationService {
    adapters = [];
    constructor() {
        // Register Adapters
        this.adapters.push(new core_1.InAppAdapter());
        if (process.env.NODE_ENV !== 'production') {
            this.adapters.push(new core_1.ConsoleAdapter());
        }
        if (process.env.TEAMS_ENABLED === 'true' || process.env.AUTH_MODE === 'bypass') {
            this.adapters.push(new teams_adapter_1.TeamsAdapter()); // Add as stub for bypass mode
        }
    }
    async notify(payload) {
        await Promise.allSettled(this.adapters.map(a => a.send(payload)));
    }
}
exports.default = (0, fastify_plugin_1.default)(async (fastify, opts) => {
    fastify.decorate('notifications', new NotificationService());
});
