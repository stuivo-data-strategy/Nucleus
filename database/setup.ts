/**
 * Nucleus Database Setup
 * Runs all .surql files in order against a SurrealDB instance.
 *
 * Usage:
 *   npx tsx database/setup.ts
 *
 * Environment variables (all optional, defaults shown):
 *   SURREAL_URL=ws://localhost:8000/rpc
 *   SURREAL_NS=nucleus
 *   SURREAL_DB=nucleus
 *   SURREAL_USER=root
 *   SURREAL_PASS=root
 */

import { Surreal } from 'surrealdb';
import fs from 'fs';
import path from 'path';

const config = {
  url:  process.env.SURREAL_URL  || 'ws://localhost:8000/rpc',
  ns:   process.env.SURREAL_NS   || 'nucleus',
  db:   process.env.SURREAL_DB   || 'nucleus',
  user: process.env.SURREAL_USER || 'root',
  pass: process.env.SURREAL_PASS || 'root',
};

const FILES = [
  { file: '01-schema.surql',      label: 'Applying schema' },
  { file: '02-seed.surql',        label: 'Seeding org data' },
  { file: '03-policy.surql',      label: 'Loading policy rules & workflows' },
  { file: '04-sample-data.surql', label: 'Creating sample data' },
];

async function run() {
  const db = new Surreal();

  console.log(`\nNucleus Database Setup`);
  console.log(`═══════════════════════════════════════`);
  console.log(`Target: ${config.url}  ns=${config.ns}  db=${config.db}\n`);

  try {
    await db.connect(config.url);
    await db.signin({ username: config.user, password: config.pass });
    await db.use({ namespace: config.ns, database: config.db });
    console.log(`Connected to SurrealDB ✓\n`);
  } catch (err) {
    console.error(`Failed to connect to SurrealDB at ${config.url}`);
    console.error(err);
    process.exit(1);
  }

  const dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));

  for (const { file, label } of FILES) {
    const filePath = path.join(dir, file);
    if (!fs.existsSync(filePath)) {
      console.log(`  ⚠ ${file} not found, skipping`);
      continue;
    }

    const sql = fs.readFileSync(filePath, 'utf-8');
    const stmtCount = sql.split(';').filter(s => s.trim().length > 0).length;

    process.stdout.write(`  ${label}...`);
    try {
      await db.query(sql);
      console.log(` ${stmtCount} statements ✓`);
    } catch (err: any) {
      console.log(` ✗`);
      console.error(`    Error in ${file}:`, err?.message || err);
      await db.close();
      process.exit(1);
    }
  }

  // Count key records
  try {
    const counts = await db.query(`
      RETURN {
        org_units: count(SELECT id FROM org_unit),
        cost_centres: count(SELECT id FROM cost_centre),
        people: count(SELECT id FROM person),
        policy_rules: count(SELECT id FROM policy_rule),
        workflow_templates: count(SELECT id FROM workflow_template),
        expense_claims: count(SELECT id FROM expense_claim),
        roles: count(SELECT id FROM role)
      };
    `);
    const c = (counts as any)?.[0] ?? {};
    console.log(`\nRecord counts:`);
    console.log(`  Org units:          ${c.org_units ?? '?'}`);
    console.log(`  Cost centres:       ${c.cost_centres ?? '?'}`);
    console.log(`  People:             ${c.people ?? '?'}`);
    console.log(`  Policy rules:       ${c.policy_rules ?? '?'}`);
    console.log(`  Workflow templates: ${c.workflow_templates ?? '?'}`);
    console.log(`  Expense claims:     ${c.expense_claims ?? '?'}`);
    console.log(`  Roles:              ${c.roles ?? '?'}`);
  } catch (_) {
    // Non-critical
  }

  await db.close();
  console.log(`\nSetup complete ✓\n`);
}

run().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
