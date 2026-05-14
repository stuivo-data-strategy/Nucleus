export interface OrgUnit {
  id: string;
  name: string;
  type: string;
  parentId?: string;
}

export interface Position {
  id: string;
  title: string;
  reportsToId?: string;
  orgUnitId: string;
}

export interface CostCentre {
  id: string;
  code: string;
  name: string;
}
