import { dbConnection } from './connection';

export const DEMO_USER = 'person:sarah_chen';

const firstNames = ["James", "John", "Robert", "Michael", "William", "David", "Richard", "Charles", "Joseph", "Thomas", "Christopher", "Daniel", "Paul", "Mark", "Donald", "George", "Kenneth", "Steven", "Edward", "Brian", "Ronald", "Anthony", "Kevin", "Jason", "Matthew", "Gary", "Timothy", "Jose", "Larry", "Jeffrey", "Frank", "Scott", "Eric", "Stephen", "Andrew", "Raymond", "Gregory", "Joshua", "Jerry", "Dennis"];
const lastNames = ["Smith", "Johnson", "Williams", "Jones", "Brown", "Davis", "Miller", "Wilson", "Moore", "Taylor", "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin", "Thompson", "Garcia", "Martinez", "Robinson", "Clark", "Rodriguez", "Lewis", "Lee", "Walker", "Hall", "Allen", "Young", "Hernandez", "King", "Wright", "Lopez", "Hill", "Scott", "Green", "Adams", "Baker", "Gonzalez", "Nelson", "Carter"];

function randomName() {
  return {
    f: firstNames[Math.floor(Math.random() * firstNames.length)],
    l: lastNames[Math.floor(Math.random() * lastNames.length)]
  };
}

function cleanData(obj: any) {
  const { id, ...rest } = obj;
  // Remove null/undefined values
  const out = Object.fromEntries(Object.entries(rest).filter(([_, v]) => v != null));
  return out;
}

async function seed() {
  console.log("Starting seed process...");
  await dbConnection.connect();
  const db = dbConnection.db;

  console.log("Seeding job classifications...");
  const jobs = [
    { id: 'job_classification:x3', family: 'Executive', title: 'C-Suite', grade: 'X3', employee_class: 'full_time', pay_range: { min: 150000, mid: 200000, max: 250000, currency: 'GBP' } },
    { id: 'job_classification:m4', family: 'Management', title: 'Director', grade: 'M4', employee_class: 'full_time', pay_range: { min: 100000, mid: 120000, max: 150000, currency: 'GBP' } },
    { id: 'job_classification:m3', family: 'Management', title: 'Head of Department', grade: 'M3', employee_class: 'full_time', pay_range: { min: 80000, mid: 95000, max: 110000, currency: 'GBP' } },
    { id: 'job_classification:m1', family: 'Management', title: 'Team Lead', grade: 'M1', employee_class: 'full_time', pay_range: { min: 70000, mid: 80000, max: 90000, currency: 'GBP' } },
    { id: 'job_classification:t4', family: 'Technical', title: 'Senior Technical', grade: 'T4', employee_class: 'full_time', pay_range: { min: 60000, mid: 70000, max: 80000, currency: 'GBP' } },
    { id: 'job_classification:t3', family: 'Technical', title: 'Mid Technical', grade: 'T3', employee_class: 'full_time', pay_range: { min: 45000, mid: 55000, max: 65000, currency: 'GBP' } },
    { id: 'job_classification:e4', family: 'Engineering', title: 'Senior Engineer', grade: 'E4', employee_class: 'full_time', pay_range: { min: 65000, mid: 75000, max: 85000, currency: 'GBP' } },
    { id: 'job_classification:e3', family: 'Engineering', title: 'Engineer', grade: 'E3', employee_class: 'full_time', pay_range: { min: 50000, mid: 60000, max: 70000, currency: 'GBP' } }
  ];
  for (const j of jobs) await db.query(`UPSERT ${j.id} MERGE $data`, { data: cleanData(j) });
  console.log(`Seeded ${jobs.length} job classifications.`);

  console.log("Seeding org units...");
  const orgs = [
    { id: 'org_unit:meridian', type: 'company', code: 'MEG', name: 'Meridian Engineering Group', status: 'active', head: 'person:margaret_thornton' },
    
    // BU
    { id: 'org_unit:tech_data', type: 'business_unit', code: 'BU-TD', name: 'Technology & Data', parent: 'org_unit:meridian', status: 'active', head: 'person:richard_keane' },
    { id: 'org_unit:ops', type: 'business_unit', code: 'BU-OP', name: 'Operations', parent: 'org_unit:meridian', status: 'active', head: 'person:david_hargreaves' },
    { id: 'org_unit:corp_services', type: 'business_unit', code: 'BU-CS', name: 'Corporate Services', parent: 'org_unit:meridian', status: 'active', head: 'person:amara_okafor' },
    { id: 'org_unit:commercial', type: 'business_unit', code: 'BU-CM', name: 'Commercial', parent: 'org_unit:meridian', status: 'active' },
    
    // Divisions
    { id: 'org_unit:ai_data', type: 'division', code: 'DIV-AID', name: 'Digital Delivery', parent: 'org_unit:tech_data', status: 'active', head: 'person:peter_blackwell' },
    { id: 'org_unit:it_ops', type: 'division', code: 'DIV-ITO', name: 'IT Operations', parent: 'org_unit:tech_data', status: 'active' },
    { id: 'org_unit:sw_dev', type: 'division', code: 'DIV-SWD', name: 'Software Development', parent: 'org_unit:tech_data', status: 'active' },
    { id: 'org_unit:project_del', type: 'division', code: 'DIV-PRD', name: 'Project Delivery', parent: 'org_unit:ops', status: 'active' },
    { id: 'org_unit:health_safety', type: 'division', code: 'DIV-HSE', name: 'Health & Safety', parent: 'org_unit:ops', status: 'active' },
    { id: 'org_unit:finance_div', type: 'division', code: 'DIV-FIN', name: 'Finance', parent: 'org_unit:corp_services', status: 'active' },
    { id: 'org_unit:hr_div', type: 'division', code: 'DIV-HR', name: 'HR', parent: 'org_unit:corp_services', status: 'active' },
    { id: 'org_unit:bus_dev', type: 'division', code: 'DIV-BD', name: 'Business Development', parent: 'org_unit:commercial', status: 'active' },
    
    // Departments
    { id: 'org_unit:data_analytics', type: 'department', code: 'DEP-DA', name: 'Digital Delivery', parent: 'org_unit:ai_data', status: 'active', head: 'person:james_morton' },
    { id: 'org_unit:ai_engineering', type: 'department', code: 'DEP-AIE', name: 'AI Engineering', parent: 'org_unit:ai_data', status: 'active' },
    { id: 'org_unit:data_engineering', type: 'department', code: 'DEP-DE', name: 'Data Engineering', parent: 'org_unit:ai_data', status: 'active' },
    { id: 'org_unit:civil_eng', type: 'department', code: 'DEP-CIV', name: 'Civil Engineering', parent: 'org_unit:project_del', status: 'active' },
    { id: 'org_unit:mech_eng', type: 'department', code: 'DEP-MEC', name: 'Mechanical Engineering', parent: 'org_unit:project_del', status: 'active' },
    { id: 'org_unit:people_ops', type: 'department', code: 'DEP-POP', name: 'People Operations', parent: 'org_unit:hr_div', status: 'active' },
    { id: 'org_unit:talent_acq', type: 'department', code: 'DEP-TA', name: 'Talent Acquisition', parent: 'org_unit:hr_div', status: 'active' }
  ];
  for (const o of orgs) await db.query(`UPSERT ${o.id} MERGE $data`, { data: cleanData(o) });
  console.log(`Seeded ${orgs.length} org units.`);

  console.log("Seeding cost centres...");
  const ccs = [
    { id: 'cost_centre:cc1000', code: 'CC-1000', name: 'Technology & Data General', owner: 'person:richard_keane' },
    { id: 'cost_centre:cc1010', code: 'CC-1010', name: 'Digital Delivery Division', parent: 'cost_centre:cc1000', owner: 'person:peter_blackwell' },
    { id: 'cost_centre:cc1011', code: 'CC-1011', name: 'Digital Delivery', parent: 'cost_centre:cc1010', owner: 'person:james_morton' },
    { id: 'cost_centre:cc1012', code: 'CC-1012', name: 'AI Engineering', parent: 'cost_centre:cc1010' },
    { id: 'cost_centre:cc2000', code: 'CC-2000', name: 'Operations General', owner: 'person:david_hargreaves' },
    { id: 'cost_centre:cc3000', code: 'CC-3000', name: 'Corporate Services General', owner: 'person:amara_okafor' },
    { id: 'cost_centre:cc4000', code: 'CC-4000', name: 'Commercial General' }
  ];
  for (const c of ccs) await db.query(`UPSERT ${c.id} MERGE $data`, { data: cleanData(c) });
  console.log(`Seeded ${ccs.length} cost centres.`);

  console.log("Clearing existing people & positions...");
  await db.query(`DELETE reports_to; DELETE holds_position; DELETE owns_budget; DELETE has_role; DELETE person; DELETE position;`);

  console.log("Seeding people & positions...");
  
  let empCounter = 1000;
  const positions: any[] = [];
  const edgeHolds: any[] = [];
  const edgeReports: any[] = [];

  const addPerson = async (id: string, f: string, l: string, title: string, job_c: string, org_u: string, cc: string, manager: string|null) => {
    empCounter++;
    const posId = `position:pos_${empCounter}`;
    
    // Position
    positions.push({
      id: posId,
      position_id: `POS-${empCounter}`,
      title: title,
      job_classification: job_c,
      org_unit: org_u,
      cost_centre: cc,
      fte_capacity: 1.0,
      fte_filled: 1.0,
      vacancy_status: 'filled'
    });

    // Person
    const person = {
      id,
      employee_id: `EMP-${empCounter}`,
      first_name: f,
      last_name: l,
      email: `${f.toLowerCase()}.${l.toLowerCase()}${empCounter}@meridian.local`,
      position: posId,
      org_unit: org_u,
      cost_centre: cc,
      manager: manager,
      job_title: title,
      start_date: new Date('2022-01-01'),
      status: 'active',
      employment_type: 'permanent',
      fte: 1.0
    };
    await db.query(`UPSERT ${id} MERGE $data`, { data: cleanData(person) });
    
    // Edges
    if (manager) edgeReports.push({ in: id, out: manager, type: 'direct' });
    edgeHolds.push({ in: id, out: posId, fte: 1.0 });
    return person;
  };

  // Executives
  await addPerson('person:margaret_thornton', 'Margaret', 'Thornton', 'CEO', 'job_classification:x3', 'org_unit:meridian', 'cost_centre:cc1000', null);
  await addPerson('person:david_hargreaves', 'David', 'Hargreaves', 'COO', 'job_classification:x3', 'org_unit:ops', 'cost_centre:cc2000', 'person:margaret_thornton');
  await addPerson('person:amara_okafor', 'Amara', 'Okafor', 'CFO', 'job_classification:x3', 'org_unit:corp_services', 'cost_centre:cc3000', 'person:margaret_thornton');
  await addPerson('person:richard_keane', 'Richard', 'Keane', 'CTO', 'job_classification:x3', 'org_unit:tech_data', 'cost_centre:cc1000', 'person:margaret_thornton');

  // Tech & Data Leadership
  await addPerson('person:peter_diciacca', 'Peter', 'DiCiacca', 'Global IT Director', 'job_classification:x3', 'org_unit:tech_data', 'cost_centre:cc1000', 'person:margaret_thornton');
  await addPerson('person:peter_blackwell', 'Peter', 'Passaro', 'Global Director of AI and Data', 'job_classification:m4', 'org_unit:ai_data', 'cost_centre:cc1010', 'person:peter_diciacca');
  await addPerson('person:james_morton', 'Stu', 'Morris', 'Head of Digital Delivery', 'job_classification:m3', 'org_unit:data_analytics', 'cost_centre:cc1011', 'person:peter_blackwell');

  // Specific required person
  await addPerson(DEMO_USER, 'Sarah', 'Chen', 'Senior Developer', 'job_classification:e4', 'org_unit:data_analytics', 'cost_centre:cc1011', 'person:james_morton');

  // Data & Analytics members
  for(let i=0; i<4; i++) {
    const fn = randomName();
    await addPerson(`person:bi_${i}`, fn.f, fn.l, 'BI Developer', 'job_classification:e3', 'org_unit:data_analytics', 'cost_centre:cc1011', 'person:james_morton');
  }
  for(let i=0; i<3; i++) {
    const fn = randomName();
    await addPerson(`person:ba_${i}`, fn.f, fn.l, 'Business Analyst', 'job_classification:t3', 'org_unit:data_analytics', 'cost_centre:cc1011', 'person:james_morton');
  }

  // AI Engineering, Data Engineering and others
  for(let i=0; i<4; i++) {
    const fn = randomName();
    await addPerson(`person:ai_${i}`, fn.f, fn.l, 'AI Engineer', 'job_classification:e4', 'org_unit:ai_engineering', 'cost_centre:cc1012', 'person:peter_blackwell');
  }

  for(let i=0; i<4; i++) {
    const fn = randomName();
    await addPerson(`person:de_${i}`, fn.f, fn.l, 'Data Engineer', 'job_classification:e4', 'org_unit:data_engineering', 'cost_centre:cc1013', 'person:peter_blackwell');
  }

  // Other departments to reach 80
  const deptConfigs = [
    { ou: 'org_unit:civil_eng', cc: 'cost_centre:cc2010', title: 'Civil Engineer', job: 'job_classification:e3', c: 15, manager: 'person:david_hargreaves' },
    { ou: 'org_unit:mech_eng', cc: 'cost_centre:cc2010', title: 'Mechanical Engineer', job: 'job_classification:e3', c: 15, manager: 'person:david_hargreaves' },
    { ou: 'org_unit:people_ops', cc: 'cost_centre:cc3000', title: 'HR Partner', job: 'job_classification:t3', c: 10, manager: 'person:amara_okafor' },
    { ou: 'org_unit:financial_acc', cc: 'cost_centre:cc3000', title: 'Accountant', job: 'job_classification:t3', c: 10, manager: 'person:amara_okafor' }
  ];

  for(const r of deptConfigs) {
    for(let i=0; i<r.c; i++) {
      const fn = randomName();
      await addPerson(`person:other_${r.ou.replace('org_unit:','')}_${i}`, fn.f, fn.l, r.title, r.job, r.ou, r.cc, r.manager);
    }
  }

  for (const p of positions) await db.query(`UPSERT ${(p as any).id} MERGE $data`, { data: cleanData(p) });

  console.log("Seeding vacant positions...");
  const vacancies = [
    { id: 'position:vac_1', position_id: 'VAC-001', title: 'Senior BI Developer', job_classification: 'job_classification:e4', org_unit: 'org_unit:data_analytics', cost_centre: 'cost_centre:cc1011', fte_capacity: 1.0, fte_filled: 0.0, vacancy_status: 'vacant' },
    { id: 'position:vac_2', position_id: 'VAC-002', title: 'Data Analyst', job_classification: 'job_classification:t3', org_unit: 'org_unit:data_analytics', cost_centre: 'cost_centre:cc1011', fte_capacity: 1.0, fte_filled: 0.0, vacancy_status: 'vacant' },
    { id: 'position:vac_3', position_id: 'VAC-003', title: 'AI Solutions Designer', job_classification: 'job_classification:e4', org_unit: 'org_unit:ai_engineering', cost_centre: 'cost_centre:cc1012', fte_capacity: 1.0, fte_filled: 0.0, vacancy_status: 'vacant' }
  ];
  for (const v of vacancies) await db.query(`UPSERT ${v.id} MERGE $data`, { data: cleanData(v) });
  console.log(`Seeded ${positions.length + vacancies.length} positions.`);

  console.log("Seeding Graph edges...");
  for (const r of edgeReports) {
    await db.query(`RELATE ${r.in}->reports_to->${r.out} SET relationship_type = '${r.type}';`);
  }
  for (const h of edgeHolds) {
    await db.query(`RELATE ${h.in}->holds_position->${h.out} SET fte_allocation = ${h.fte};`);
  }

  // Cost centre ownership edges
  await db.query(`RELATE person:richard_keane->owns_budget->cost_centre:cc1000 SET authority_level = 'full';`);
  await db.query(`RELATE person:peter_blackwell->owns_budget->cost_centre:cc1010 SET authority_level = 'full';`);
  await db.query(`RELATE person:james_morton->owns_budget->cost_centre:cc1011 SET authority_level = 'full';`);

  console.log("Seeding Workflow Templates...");
  const wfs = [
    { id: 'workflow_template:expense_approval', name: 'expense_approval', module: 'expenses', status: 'active', steps: [
      { order: 1, label: 'Direct Manager', resolver: 'direct_manager', action: 'approve' },
      { order: 2, label: 'Cost Centre Owner', resolver: 'cost_centre_owner', action: 'approve', condition: { min_amount: 100 } },
      { order: 3, label: 'Finance Head', resolver: 'role_based', role: 'finance_approver', action: 'approve', condition: { min_amount: 500 } }
    ]},
    { id: 'workflow_template:absence_request', name: 'absence_request', module: 'absence', status: 'active', steps: [
      { order: 1, resolver: 'direct_manager', action: 'approve' }
    ]},
    { id: 'workflow_template:expense_approval_exception', name: 'expense_approval_exception', module: 'expenses', status: 'active', steps: [
      { order: 1, label: 'Senior Manager (Exception)', resolver: 'skip_level_manager', action: 'approve' },
      { order: 2, label: 'Line Manager', resolver: 'direct_manager', action: 'approve' },
      { order: 3, label: 'Cost Centre Owner', resolver: 'cost_centre_owner', action: 'approve', condition: { min_amount: 100 } },
      { order: 4, label: 'Finance', resolver: 'role_based', role: 'finance_approver', action: 'approve', condition: { min_amount: 500 } }
    ]}
  ];
  for (const wf of wfs) await db.query(`UPSERT ${wf.id} MERGE $data`, { data: cleanData(wf) });

  console.log("Seeding Business Rules...");
  const brules = [
    { id: 'business_rule:br1', name: 'expense_receipt_required', module: 'expenses', trigger_event: 'expense_submitted', priority: 100, actions: [] },
    { id: 'business_rule:br2', name: 'absence_manager_approval', module: 'absence', trigger_event: 'absence_requested', priority: 100, actions: [{type: 'route_workflow', template: 'absence_request'}] }
  ];
  for (const br of brules) await db.query(`UPSERT ${br.id} MERGE $data`, { data: cleanData(br) });

  console.log("Seeding Policy Rules...");
  const prules = [
    { id: 'policy_rule:meals', category: 'meals', max_amount: 75, receipt_threshold: 15, description: 'Meals limit' },
    { id: 'policy_rule:travel', category: 'travel', max_amount: 250, receipt_threshold: 10, description: 'Travel limits including taxis and rail fares' },
    { id: 'policy_rule:accommodation', category: 'accommodation', max_amount: 200, receipt_threshold: 0, description: 'Hotel stay limits per night' },
    { id: 'policy_rule:supplies', category: 'supplies', max_amount: 150, receipt_threshold: 20, description: 'Office supplies' }
  ];
  for (const pr of prules) await db.query(`UPSERT ${pr.id} MERGE $data`, { data: cleanData(pr) });

  console.log("Seeding Lisa Thornton (Expenses Auditor)...");
  await addPerson('person:lisa_thornton', 'Lisa', 'Thornton', 'Expenses Officer', 'job_classification:t3', 'org_unit:finance_div', 'cost_centre:cc3000', 'person:amara_okafor');

  console.log("Seeding RBAC roles...");
  const roles = [
    { id: 'role:employee', name: 'employee', permissions: ['expenses:create:own', 'expenses:read:own', 'org:read:all', 'people:read:basic'] },
    { id: 'role:manager', name: 'manager', permissions: ['expenses:approve:team', 'people:read:team'] },
    { id: 'role:hr_admin', name: 'hr_admin', permissions: ['people:read:all', 'people:write:all'] },
    { id: 'role:finance_approver', name: 'finance_approver', permissions: ['expenses:approve:all', 'expenses:read:all'] },
    { id: 'role:expenses_auditor', name: 'expenses_auditor', permissions: ['expenses:audit:all', 'expenses:read:all'] },
    { id: 'role:system_admin', name: 'system_admin', permissions: ['*:*:*'] }
  ];
  for (const r of roles) await db.query(`UPSERT ${r.id} MERGE $data`, { data: cleanData(r) });

  // Grant roles
  await db.query(`RELATE person:sarah_chen->has_role->role:employee;`);
  await db.query(`RELATE person:james_morton->has_role->role:manager;`);
  await db.query(`RELATE person:margaret_thornton->has_role->role:system_admin;`);
  await db.query(`RELATE person:amara_okafor->has_role->role:finance_approver;`);
  await db.query(`RELATE person:lisa_thornton->has_role->role:expenses_auditor;`);

  console.log("Seeding Complete!");
  await dbConnection.close();
}

// Only run when executed directly: pnpm db:seed
const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('db/seed.ts') ||
               process.argv[1]?.replace(/\\/g, '/').endsWith('db/seed.js');
if (isMain) {
  seed().catch(console.error);
}
