import test from 'node:test';
import assert from 'node:assert';
import { WorkflowService } from '../src/services/workflow.service';
import { dbConnection, getDb } from '../src/db/connection';
import { DEMO_USER } from '../src/db/seed';

test('Workflow Resolver - Expense Approval over £100', async (t) => {
  await dbConnection.connect();
  const db = getDb();
  const srv = new WorkflowService(db);

  try {
    const steps = await srv.resolveWorkflow('expense_approval', DEMO_USER, { amount: 150 });
    
    // We expect direct manager then CC owner, because £150 <= £500 (no finance) and > £100 (needs CC owner)
    assert.strictEqual(steps.length, 2);
    
    // Step 1: Direct Manager (James Morton)
    assert.strictEqual(steps[0].approver, 'person:james_morton');
    assert.strictEqual(steps[0].action, 'approve');

    // Step 2: CC Owner (James Morton because he owns CC-1011)
    assert.strictEqual(steps[1].approver, 'person:james_morton');
    assert.strictEqual(steps[1].action, 'approve');
    
  } finally {
    await dbConnection.close();
  }
});
