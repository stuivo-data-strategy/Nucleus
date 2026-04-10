import fp from 'fastify-plugin';
import { NotificationPayload, ConsoleAdapter, InAppAdapter } from './adapters/core';
import { TeamsAdapter } from './adapters/teams.adapter';

class NotificationService {
  adapters: any[] = [];

  constructor() {
    // Register Adapters
    this.adapters.push(new InAppAdapter());
    if (process.env.NODE_ENV !== 'production') {
      this.adapters.push(new ConsoleAdapter());
    }
    if (process.env.TEAMS_ENABLED === 'true' || process.env.AUTH_MODE === 'bypass') {
      this.adapters.push(new TeamsAdapter()); // Add as stub for bypass mode
    }
  }

  async notify(payload: NotificationPayload) {
    await Promise.allSettled(this.adapters.map(a => a.send(payload)));
  }
}

export default fp(async (fastify, opts) => {
  fastify.decorate('notifications', new NotificationService());
});
