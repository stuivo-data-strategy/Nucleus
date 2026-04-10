import { Surreal, StringRecordId } from 'surrealdb';

export class OrgService {
  constructor(private db: Surreal) {}

  async getOrgTree(rootId?: string, depth?: number) {
    let query = `
      SELECT *, 
      (SELECT * FROM org_unit WHERE parent = type::string($parent.id) OR parent = $parent.id) AS children 
      FROM org_unit 
      WHERE parent = NONE;
    `;
    if (rootId) {
      query = `SELECT *, (SELECT * FROM org_unit WHERE parent = type::string($parent.id) OR parent = $parent.id) AS children FROM org_unit WHERE id = $id;`;
    }
    const result = await this.db.query(query, { id: rootId ? new StringRecordId(rootId) : undefined });
    const arr = result[0] as any[];
    return arr[0] || null;
  }

  async getOrgUnit(id: string) {
    const result = await this.db.query(`SELECT * FROM org_unit WHERE id = $id`, { id: new StringRecordId(id) });
    const resArr = result[0] as any[];
    return resArr[0];
  }

  async getByType(type: string) {
    const result = await this.db.query(`SELECT * FROM org_unit WHERE type = $type`, { type });
    return result[0];
  }

  async getAncestorChain(id: string) {
    let currentId = id;
    const chain = [];
    let hops = 0;
    while(currentId && hops < 20) {
       const res = await this.db.query(`SELECT * FROM org_unit WHERE id = $id`, { id: new StringRecordId(currentId) });
       const arr = res[0] as any[];
       if (!arr || arr.length === 0) break;
       const unit = arr[0];
       chain.push(unit);
       currentId = unit.parent;
       hops++;
    }
    return chain;
  }

  async getPeopleInUnit(id: string, recursive: boolean = false) {
    let query = `SELECT * FROM person WHERE org_unit = $id`;
    if (recursive) {
      query = `
        SELECT * FROM person 
        WHERE org_unit IN (SELECT id FROM org_unit WHERE parent = $id) 
        OR org_unit = $id
      `;
    }
    const result = await this.db.query(query, { id: new StringRecordId(id) });
    return result[0];
  }

  async getHeadcountSummary(id: string) {
    const query = `
      SELECT count() as total FROM person 
      WHERE org_unit IN (SELECT id FROM org_unit WHERE parent = $id) 
      OR org_unit = $id GROUP ALL
    `;
    const result = await this.db.query(query, { id: new StringRecordId(id) });
    const arr = result[0] as any[];
    return { headCount: arr.length > 0 ? arr[0].total : 0 };
  }
}
