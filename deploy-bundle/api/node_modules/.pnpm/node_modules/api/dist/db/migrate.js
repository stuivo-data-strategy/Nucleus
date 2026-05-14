"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const connection_1 = require("./connection");
async function main() {
    await connection_1.dbConnection.connect();
    // connection.connect() automatically runs migrations
    await connection_1.dbConnection.close();
    console.log('Migrations complete.');
}
main().catch(console.error);
