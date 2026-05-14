"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PeopleService = void 0;
const surrealdb_1 = require("surrealdb");
class PeopleService {
    db;
    constructor(db) {
        this.db = db;
    }
    async getPerson(id) {
        const query = `
      SELECT *,
        ->reports_to->person.{first_name, last_name, job_title} AS manager_info,
        <-reports_to<-person.{id, first_name, last_name, job_title, avatar_url} AS direct_reports,
        ->holds_position->position.{title, vacancy_status, fte_capacity} AS position_info,
        org_unit.{name, type} AS org_info,
        cost_centre.{code, name} AS cc_info,
        ->has_role->role.{name, permissions} AS roles
      FROM person WHERE id = $id;
    `;
        const result = await this.db.query(query, { id: new surrealdb_1.StringRecordId(id) });
        const arr = result[0];
        return arr[0];
    }
    async getByEmail(email) {
        const result = await this.db.query(`SELECT * FROM person WHERE email = $email LIMIT 1`, { email });
        const arr = result[0];
        return arr[0] || null;
    }
    async getByEntraOid(oid) {
        const result = await this.db.query(`SELECT * FROM person WHERE entra_oid = $oid LIMIT 1`, { oid });
        const arr = result[0];
        return arr[0] || null;
    }
    async getDirectReports(id) {
        const result = await this.db.query(`SELECT <-reports_to<-person.{id, first_name, last_name, job_title, org_unit, email, employee_id, employment_type} AS reports FROM person WHERE id = $id`, { id: new surrealdb_1.StringRecordId(id) });
        const arr = result[0];
        const reports = arr[0]?.reports ?? [];
        const clean = (p) => ({ ...p, id: p.id?.toString?.() ?? p.id });
        const withCounts = await Promise.all(reports.map(clean).map(async (dr) => {
            const cRes = await this.db.query(`SELECT count(<-reports_to<-person) AS n FROM person WHERE id = $id`, { id: new surrealdb_1.StringRecordId(dr.id) });
            return { ...dr, reportCount: cRes[0][0]?.n ?? 0 };
        }));
        return withCounts;
    }
    async getReportingChain(id) {
        const chain = [];
        let currentId = id;
        let hops = 0;
        while (currentId && hops < 20) {
            const res = await this.db.query(`SELECT ->reports_to->person AS manager FROM person WHERE id = $id`, { id: new surrealdb_1.StringRecordId(currentId) });
            const arr = res[0];
            if (!arr || arr.length === 0 || !arr[0].manager || arr[0].manager.length === 0)
                break;
            const mgr = arr[0].manager[0];
            chain.push(mgr);
            currentId = mgr.id;
            hops++;
        }
        return chain;
    }
    async getTeamMembers(id) {
        const res = await this.db.query(`
      SELECT * FROM person 
      WHERE org_unit = (SELECT org_unit FROM person WHERE id = $id LIMIT 1)[0].org_unit
    `, { id: new surrealdb_1.StringRecordId(id) });
        return res[0];
    }
    async searchPeople(searchTerm, filters) {
        const qLower = searchTerm.toLowerCase();
        const query = `
      SELECT * FROM person
      WHERE string::lowercase(first_name) CONTAINS $q
      OR string::lowercase(last_name) CONTAINS $q
      OR string::lowercase(email) CONTAINS $q
      OR string::lowercase(job_title) CONTAINS $q;
    `;
        const res = await this.db.query(query, { q: qLower });
        return res[0];
    }
    async listPeople(options) {
        const limit = options?.limit || 50;
        const page = options?.page || 1;
        const start = (page - 1) * limit;
        const res = await this.db.query(`SELECT * FROM person LIMIT ${limit} START ${start}`);
        const countRes = await this.db.query(`SELECT count() FROM person GROUP ALL`);
        let total = 0;
        const countArr = countRes[0];
        if (countArr && countArr.length > 0)
            total = countArr[0].count;
        return {
            data: res[0],
            meta: { total, page, limit }
        };
    }
    async getEmploymentHistory(id) {
        const res = await this.db.query(`SELECT * FROM employment_event WHERE person = $id ORDER BY effective_date DESC`, { id: new surrealdb_1.StringRecordId(id) });
        return res[0];
    }
    async getPersonContext(id) {
        const clean = (p) => p ? { ...p, id: p.id?.toString?.() ?? p.id } : null;
        // Self
        const selfRes = await this.db.query(`
      SELECT *, org_unit.{name, type} AS org_info
      FROM person WHERE id = $id
    `, { id: new surrealdb_1.StringRecordId(id) });
        const self = clean(selfRes[0][0]);
        if (!self)
            return null;
        // Manager — via reports_to graph edge
        const mgrRes = await this.db.query(`SELECT ->reports_to->person.{id, first_name, last_name, job_title, org_unit} AS m FROM person WHERE id = $id`, { id: new surrealdb_1.StringRecordId(id) });
        const mgrArr = (mgrRes[0][0]?.m ?? []).map(clean);
        const manager = mgrArr.length > 0 ? mgrArr[0] : null;
        // Peers — others who share the same manager via graph edge (excluding self)
        let peers = [];
        if (manager?.id) {
            const peersRes = await this.db.query(`SELECT <-reports_to<-person.{id, first_name, last_name, job_title} AS p FROM person WHERE id = $mgr`, { mgr: new surrealdb_1.StringRecordId(manager.id) });
            const all = (peersRes[0][0]?.p ?? []).map(clean);
            peers = all.filter((p) => p.id !== id && p.id !== self.id);
        }
        // Direct reports — via reports_to graph edge (self is the target)
        const drRes = await this.db.query(`SELECT <-reports_to<-person.{id, first_name, last_name, job_title, org_unit, email, employee_id, employment_type} AS reports FROM person WHERE id = $id`, { id: new surrealdb_1.StringRecordId(id) });
        const directReports = (drRes[0][0]?.reports ?? []).map(clean);
        // Report count for each direct report (for expand button badge)
        const drWithCounts = await Promise.all(directReports.map(async (dr) => {
            const cRes = await this.db.query(`SELECT count(<-reports_to<-person) AS n FROM person WHERE id = $id`, { id: new surrealdb_1.StringRecordId(dr.id) });
            const n = cRes[0][0]?.n ?? 0;
            return { ...dr, reportCount: n };
        }));
        // Also get report count for self
        const selfCountRes = await this.db.query(`SELECT count(<-reports_to<-person) AS n FROM person WHERE id = $id`, { id: new surrealdb_1.StringRecordId(id) });
        const selfReportCount = selfCountRes[0][0]?.n ?? 0;
        return {
            self: { ...self, reportCount: selfReportCount },
            manager,
            peers,
            directReports: drWithCounts
        };
    }
    async getPermissions(id) {
        const res = await this.db.query(`SELECT ->has_role->role.permissions AS perms FROM person WHERE id = $id`, { id: new surrealdb_1.StringRecordId(id) });
        const arr = res[0];
        if (arr && arr[0] && arr[0].perms) {
            return arr[0].perms.flat();
        }
        return [];
    }
}
exports.PeopleService = PeopleService;
