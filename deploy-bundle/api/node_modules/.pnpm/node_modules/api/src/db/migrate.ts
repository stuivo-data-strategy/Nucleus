import { dbConnection } from './connection';

async function main() {
  await dbConnection.connect();
  // connection.connect() automatically runs migrations
  await dbConnection.close();
  console.log('Migrations complete.');
}

main().catch(console.error);
