import { Surreal } from 'surrealdb';

export class PositionService {
  constructor(private db: Surreal) {}

  async getPositionTree(rootId?: string) {
    let query = `SELECT * FROM position WHERE parent_position = NONE OR parent_position = NULL`;
    if (rootId) {
      query = `SELECT * FROM position WHERE parent_position = $id`;
    }
    const result = await this.db.query(query, { id: rootId });
    return result[0];
  }

  async getPosition(id: string) {
    const query = `
      SELECT *, <-holds_position<-person.* AS incumbents,
             ->job_classification.* AS classification
      FROM position WHERE id = $id;
    `;
    const result = await this.db.query(query, { id });
    const arr = result[0] as any[];
    return arr[0];
  }

  async getVacancies(orgUnitId?: string) {
    if (orgUnitId) {
      const res = await this.db.query(`SELECT * FROM position WHERE org_unit = $org_unit_id AND vacancy_status = 'vacant'`, { org_unit_id: orgUnitId });
      return res[0];
    }
    const res = await this.db.query(`SELECT * FROM position WHERE vacancy_status = 'vacant'`);
    return res[0];
  }

  async getPositionContext(id: string) {
    return this.getPosition(id);
  }

  async updatePosition(id: string, updates: any) {
    const res = await this.db.query(`UPDATE ${id} MERGE $data`, { data: updates });
    const arr = res[0] as any[];
    return arr[0];
  }

  async createPosition(data: any) {
    const res = await this.db.query(`CREATE position CONTENT $data`, { data });
    const arr = res[0] as any[];
    return arr[0];
  }

  async getPositionsForManager(managerId: string) {
    const res = await this.db.query(`
      SELECT <-holds_position<-person.position FROM person 
      WHERE ->reports_to->person.id CONTAINS $managerId
    `, { managerId });
    return res[0];
  }
}
