/**
 * Nucleus Database Reset
 * Drops the entire database and re-runs setup from scratch.
 * Safe to run before a demo to restore clean state.
 *
 * Usage:
 *   npx tsx database/reset.ts
 *
 * Environment variables: same as setup.ts
 */
// Path-relative import — see setup.js for the rationale.
import { Surreal } from '../api/node_modules/surrealdb/dist/surrealdb.server.mjs';
import path from 'path';
import { pathToFileURL } from 'url';
const config = {
    url: process.env.SURREAL_URL || 'ws://localhost:8000/rpc',
    ns: process.env.SURREAL_NS || 'nucleus',
    db: process.env.SURREAL_DB || 'nucleus',
    user: process.env.SURREAL_USER || 'root',
    pass: process.env.SURREAL_PASS || 'root',
};
async function run() {
    const db = new Surreal();
    console.log(`\nNucleus Database Reset`);
    console.log(`═══════════════════════════════════════`);
    console.log(`Target: ${config.url}  ns=${config.ns}  db=${config.db}\n`);
    try {
        await db.connect(config.url);
        await db.signin({ username: config.user, password: config.pass });
    }
    catch (err) {
        console.error(`Failed to connect to SurrealDB at ${config.url}`);
        console.error(err);
        process.exit(1);
    }
    // Drop database
    process.stdout.write(`  Dropping database "${config.db}"...`);
    try {
        await db.query(`REMOVE DATABASE ${config.db}`);
        console.log(` ✓`);
    }
    catch (_) {
        console.log(` (did not exist, continuing)`);
    }
    // Re-create by selecting into it
    await db.use({ namespace: config.ns, database: config.db });
    console.log(`  Re-created database "${config.db}" ✓`);
    await db.close();
    // Now run setup
    console.log(`\n  Running setup...\n`);
    // Dynamic import to run setup.js (compiled sibling file)
    const setupPath = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), 'setup.js');
    await import(pathToFileURL(setupPath).href);
}
run().catch((err) => {
    console.error('Reset failed:', err);
    process.exit(1);
});
