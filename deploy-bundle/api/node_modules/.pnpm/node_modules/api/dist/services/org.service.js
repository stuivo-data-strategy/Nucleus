"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrgService = void 0;
const surrealdb_1 = require("surrealdb");
class OrgService {
    db;
    constructor(db) {
        this.db = db;
    }
    async getOrgTree(rootId, depth) {
        let query = `
      SELECT *, 
      (SELECT * FROM org_unit WHERE parent = type::string($parent.id) OR parent = $parent.id) AS children 
      FROM org_unit 
      WHERE parent = NONE;
    `;
        if (rootId) {
            query = `SELECT *, (SELECT * FROM org_unit WHERE parent = type::string($parent.id) OR parent = $parent.id) AS children FROM org_unit WHERE id = $id;`;
        }
        const result = await this.db.query(query, { id: rootId ? new surrealdb_1.StringRecordId(rootId) : undefined });
        const arr = result[0];
        return arr[0] || null;
    }
    async getOrgUnit(id) {
        const result = await this.db.query(`SELECT * FROM org_unit WHERE id = $id`, { id: new surrealdb_1.StringRecordId(id) });
        const resArr = result[0];
        return resArr[0];
    }
    async getByType(type) {
        const result = await this.db.query(`SELECT * FROM org_unit WHERE type = $type`, { type });
        return result[0];
    }
    async getAncestorChain(id) {
        let currentId = id;
        const chain = [];
        let hops = 0;
        while (currentId && hops < 20) {
            const res = await this.db.query(`SELECT * FROM org_unit WHERE id = $id`, { id: new surrealdb_1.StringRecordId(currentId) });
            const arr = res[0];
            if (!arr || arr.length === 0)
                break;
            const unit = arr[0];
            chain.push(unit);
            currentId = unit.parent;
            hops++;
        }
        return chain;
    }
    async getPeopleInUnit(id, recursive = false) {
        let query = `SELECT * FROM person WHERE org_unit = $id`;
        if (recursive) {
            query = `
        SELECT * FROM person 
        WHERE org_unit IN (SELECT id FROM org_unit WHERE parent = $id) 
        OR org_unit = $id
      `;
        }
        const result = await this.db.query(query, { id: new surrealdb_1.StringRecordId(id) });
        return result[0];
    }
    async getHeadcountSummary(id) {
        const query = `
      SELECT count() as total FROM person 
      WHERE org_unit IN (SELECT id FROM org_unit WHERE parent = $id) 
      OR org_unit = $id GROUP ALL
    `;
        const result = await this.db.query(query, { id: new surrealdb_1.StringRecordId(id) });
        const arr = result[0];
        return { headCount: arr.length > 0 ? arr[0].total : 0 };
    }
}
exports.OrgService = OrgService;
