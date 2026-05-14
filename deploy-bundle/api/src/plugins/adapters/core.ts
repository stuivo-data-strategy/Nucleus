export interface NotificationPayload {
  recipientId: string;
  type: 'approval_request' | 'approval_result' | 'query' | 'info' | 'reminder' | 'escalation';
  title: string;
  body: string;
  link?: string;
  relatedWorkflowId?: string;
  actions?: NotificationAction[];
  priority?: 'normal' | 'high';
  metadata?: Record<string, unknown>;
}

export interface NotificationAction {
  label: string;
  action: string;
  style: 'primary' | 'secondary' | 'destructive';
}

export interface NotificationAdapter {
  name: string;
  send(payload: NotificationPayload): Promise<boolean>;
  sendBatch(payloads: NotificationPayload[]): Promise<boolean[]>;
}

export class ConsoleAdapter implements NotificationAdapter {
  name = 'ConsoleAdapter';
  async send(payload: NotificationPayload) {
    console.log(`\n📢 [NOTIFICATION] -> ${payload.recipientId}`);
    console.log(`Type: ${payload.type} | Title: ${payload.title}`);
    console.log(`Body: ${payload.body}`);
    if (payload.actions) console.log(`Actions: ${payload.actions.map(a => a.label).join(', ')}`);
    console.log(`------------------------------------------------\n`);
    return true;
  }
  async sendBatch(payloads: NotificationPayload[]) {
    return Promise.all(payloads.map(p => this.send(p)));
  }
}

import { getDb } from '../../db/connection';

export class InAppAdapter implements NotificationAdapter {
  name = 'InAppAdapter';
  async send(payload: NotificationPayload) {
    const db = getDb();
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
  async sendBatch(payloads: NotificationPayload[]) {
    return Promise.all(payloads.map(p => this.send(p)));
  }
}
