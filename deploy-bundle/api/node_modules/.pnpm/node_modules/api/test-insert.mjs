import { Surreal, RecordId } from 'surrealdb';

const db = new Surreal();
await db.connect('ws://127.0.0.1:8000/rpc');
await db.use({ namespace: 'nucleus', database: 'nucleus' });
await db.signin({ username: 'root', password: 'root' });

// Test with CREATE and RecordId
try {
  const r1 = await db.query(`CREATE person:test_create SET 
    employee_id = 'EMP-CREATE', 
    first_name = 'Create', 
    last_name = 'Test', 
    email = 'create@test.com', 
    job_title = 'Tester', 
    org_unit = org_unit:meridian, 
    cost_centre = cost_centre:cc1000, 
    start_date = time::now(), 
    status = 'active', 
    employment_type = 'permanent', 
    fte = 1.0`);
  console.log('CREATE result:', JSON.stringify(r1, null, 2));
} catch(e) {
  console.log('CREATE ERROR:', e.message);
}

// Check
const count = await db.query('SELECT id, first_name FROM person');
console.log('Person rows:', JSON.stringify(count[0], null, 2));

db.close();
