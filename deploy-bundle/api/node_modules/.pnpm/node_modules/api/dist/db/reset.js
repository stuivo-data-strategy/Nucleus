"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const connection_1 = require("./connection");
const config_1 = require("../config");
async function main() {
    // Connect but bypass the automatic runMigrations temporarily to safely drop
    await connection_1.dbConnection.db.connect(config_1.config.surreal.url);
    await connection_1.dbConnection.db.signin({
        username: config_1.config.surreal.user,
        password: config_1.config.surreal.pass,
    });
    const dbName = config_1.config.surreal.db;
    const nsName = config_1.config.surreal.ns;
    console.log(`Resetting database: ${dbName} in namespace: ${nsName}...`);
    try {
        await connection_1.dbConnection.db.query(`REMOVE DATABASE ${dbName}`);
    }
    catch (e) {
        console.log("Database might not exist yet, continuing...");
    }
    await connection_1.dbConnection.db.use({ namespace: nsName, database: dbName });
    await connection_1.dbConnection.runMigrations();
    await connection_1.dbConnection.close();
    console.log('Reset complete.');
}
main().catch(console.error);
