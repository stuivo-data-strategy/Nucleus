"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RulesService = void 0;
class RulesService {
    db;
    constructor(db) {
        this.db = db;
    }
    async evaluateRules(triggerEvent, context) {
        const res = await this.db.query(`SELECT * FROM business_rule WHERE trigger_event = $triggerEvent`, { triggerEvent });
        const rules = res[0];
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
    async getRulesForModule(module) {
        const res = await this.db.query(`SELECT * FROM business_rule WHERE module = $module`, { module });
        return res[0];
    }
}
exports.RulesService = RulesService;
