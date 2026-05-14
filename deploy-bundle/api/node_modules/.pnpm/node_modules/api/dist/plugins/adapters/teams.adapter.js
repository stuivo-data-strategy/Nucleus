"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeamsAdapter = void 0;
class TeamsAdapter {
    name = 'TeamsAdapter';
    async send(payload) {
        if (process.env.TEAMS_ENABLED !== 'true') {
            console.log(`[TeamsAdapterStub] Would send adaptive card to MS Graph for ${payload.recipientId}`);
            return true;
        }
        // Actual implementation would resolve entra_oid and hit MS Graph
        const expenseApprovalCard = {
            type: "AdaptiveCard",
            version: "1.5",
            body: [
                {
                    type: "Container",
                    items: [
                        { type: "TextBlock", text: payload.title, weight: "Bolder", size: "Medium" },
                        {
                            type: "FactSet",
                            facts: [
                                { title: "Details", value: payload.body }
                            ]
                        }
                    ]
                }
            ],
            actions: payload.actions?.map(a => ({
                type: a.action === 'query' ? 'Action.ShowCard' : 'Action.Submit',
                title: a.label,
                style: a.style === 'destructive' ? 'destructive' : (a.style === 'primary' ? 'positive' : 'default'),
                data: { action: a.action, instanceId: payload.relatedWorkflowId }
            })) || []
        };
        console.log('Sending to Teams API:', JSON.stringify(expenseApprovalCard, null, 2));
        return true;
    }
    async sendBatch(payloads) {
        return Promise.all(payloads.map(p => this.send(p)));
    }
}
exports.TeamsAdapter = TeamsAdapter;
