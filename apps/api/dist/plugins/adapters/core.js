"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InAppAdapter = exports.ConsoleAdapter = void 0;
class ConsoleAdapter {
    name = 'ConsoleAdapter';
    async send(payload) {
        console.log(`\n📢 [NOTIFICATION] -> ${payload.recipientId}`);
        console.log(`Type: ${payload.type} | Title: ${payload.title}`);
        console.log(`Body: ${payload.body}`);
        if (payload.actions)
            console.log(`Actions: ${payload.actions.map(a => a.label).join(', ')}`);
        console.log(`------------------------------------------------\n`);
        return true;
    }
    async sendBatch(payloads) {
        return Promise.all(payloads.map(p => this.send(p)));
    }
}
exports.ConsoleAdapter = ConsoleAdapter;
const connection_1 = require("../../db/connection");
class InAppAdapter {
    name = 'InAppAdapter';
    async send(payload) {
        const db = (0, connection_1.getDb)();
        await db.query(`CREATE notification CONTENT $data`, {
            data: {
                recipient: payload.recipientId,
                type: payload.type,
                title: payload.title,
                body: payload.body,
                link: payload.link,
                relatedWorkflowId: payload.relatedWorkflowId,
                actions: payload.actions,
                priority: payload.priority || 'normal',
                read: false
            }
        });
        return true;
    }
    async sendBatch(payloads) {
        return Promise.all(payloads.map(p => this.send(p)));
    }
}
exports.InAppAdapter = InAppAdapter;
