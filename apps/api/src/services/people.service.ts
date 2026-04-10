import { Surreal, StringRecordId } from 'surrealdb';

export class PeopleService {
  constructor(private db: Surreal) {}

  async getPerson(id: string) {
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
    const result = await this.db.query(query, { id: new StringRecordId(id) });
    const arr = result[0] as any[];
    return arr[0];
  }

  async getByEmail(email: string) {
    const result = await this.db.query(`SELECT * FROM person WHERE email = $email LIMIT 1`, { email });
    const arr = result[0] as any[];
    return arr[0] || null;
  }

  async getByEntraOid(oid: string) {
    const result = await this.db.query(`SELECT * FROM person WHERE entra_oid = $oid LIMIT 1`, { oid });
    const arr = result[0] as any[];
    return arr[0] || null;
  }

  async getDirectReports(id: string) {
    const result = await this.db.query(`SELECT <-reports_to<-person.* AS reports FROM person WHERE id = $id`, { id: new StringRecordId(id) });
    const arr = result[0] as any[];
    if (arr[0] && arr[0].reports) return arr[0].reports;
    return [];
  }

  async getReportingChain(id: string) {
    const chain = [];
    let currentId = id;
    let hops = 0;
    while(currentId && hops < 20) {
       const res = await this.db.query(`SELECT ->reports_to->person AS manager FROM person WHERE id = $id`, { id: new StringRecordId(currentId) });
       const arr = res[0] as any[];
       if (!arr || arr.length === 0 || !arr[0].manager || arr[0].manager.length === 0) break;
       const mgr = arr[0].manager[0];
       chain.push(mgr);
       currentId = mgr.id;
       hops++;
    }
    return chain;
  }

  async getTeamMembers(id: string) {
    const res = await this.db.query(`
      SELECT * FROM person 
      WHERE org_unit = (SELECT org_unit FROM person WHERE id = $id LIMIT 1)[0].org_unit
    `, { id: new StringRecordId(id) });
    return res[0];
  }

  async searchPeople(searchTerm: string, filters?: any) {
    const query = `
      SELECT * FROM person
      WHERE first_name ~ $q
      OR last_name ~ $q
      OR email ~ $q
      OR job_title ~ $q;
    `;
    const res = await this.db.query(query, { q: searchTerm });
    return res[0];
  }

  async listPeople(options: any) {
    const limit = options?.limit || 50;
    const page = options?.page || 1;
    const start = (page - 1) * limit;
    const res = await this.db.query(`SELECT * FROM person LIMIT ${limit} START ${start}`);
    const countRes = await this.db.query(`SELECT count() FROM person GROUP ALL`);
    let total = 0;
    const countArr = countRes[0] as any[];
    if (countArr && countArr.length > 0) total = countArr[0].count;
    
    return {
      data: res[0],
      meta: { total, page, limit }
    };
  }

  async getEmploymentHistory(id: string) {
    const res = await this.db.query(`SELECT * FROM employment_event WHERE person = $id ORDER BY effective_date DESC`, { id: new StringRecordId(id) });
    return res[0];
  }

  async getPermissions(id: string) {
    const res = await this.db.query(`SELECT ->has_role->role.permissions AS perms FROM person WHERE id = $id`, { id: new StringRecordId(id) });
    const arr = res[0] as any[];
    if (arr && arr[0] && arr[0].perms) {
      return arr[0].perms.flat();
    }
    return [];
  }
}
