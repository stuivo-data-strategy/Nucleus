import { dbConnection } from './connection';
import { config } from '../config';

async function main() {
  // Connect but bypass the automatic runMigrations temporarily to safely drop
  await dbConnection.db.connect(config.surreal.url);
  await dbConnection.db.signin({
    username: config.surreal.user,
    password: config.surreal.pass,
  });

  const dbName = config.surreal.db;
  const nsName = config.surreal.ns;
  
  console.log(`Resetting database: ${dbName} in namespace: ${nsName}...`);
  try {
    await dbConnection.db.query(`REMOVE DATABASE ${dbName}`);
  } catch (e) {
    console.log("Database might not exist yet, continuing...");
  }
  
  await dbConnection.db.use({ namespace: nsName, database: dbName });
  
  await dbConnection.runMigrations();
  await dbConnection.close();
  console.log('Reset complete.');
}

main().catch(console.error);
