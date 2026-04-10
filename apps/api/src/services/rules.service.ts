import { Surreal } from 'surrealdb';

export class RulesService {
  constructor(private db: Surreal) {}

  async evaluateRules(triggerEvent: string, context: any) {
    const res = await this.db.query(`SELECT * FROM business_rule WHERE trigger_event = $triggerEvent`, { triggerEvent });
    const rules = res[0] as any[];
    const actions = [];
    
    for (const rule of (rules || [])) {
       let passed = true;
       if (rule.conditions) {
         for (const key of Object.keys(rule.conditions)) {
            if (context[key] !== rule.conditions[key]) {
               passed = false;
               break;
            }
         }
       }
       if (passed && rule.actions) {
          actions.push(...rule.actions);
       }
    }
    return actions;
  }

  async getRulesForModule(module: string) {
    const res = await this.db.query(`SELECT * FROM business_rule WHERE module = $module`, { module });
    return res[0];
  }
}
