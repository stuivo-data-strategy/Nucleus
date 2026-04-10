"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.dbConnection = void 0;
const surrealdb_1 = require("surrealdb");
const config_1 = require("../config");
class Database {
    db;
    constructor() {
        this.db = new surrealdb_1.Surreal();
    }
    async connect() {
        try {
            await this.db.connect(config_1.config.surreal.url);
            await this.db.signin({
                username: config_1.config.surreal.user,
                password: config_1.config.surreal.pass,
            });
            await this.db.use({
                namespace: config_1.config.surreal.ns,
                database: config_1.config.surreal.db,
            });
            console.log('Connected to SurrealDB');
        }
        catch (error) {
            console.error('Failed to connect to SurrealDB:', error);
            throw error;
        }
    }
    async close() {
        await this.db.close();
    }
}
exports.dbConnection = new Database();
exports.db = exports.dbConnection.db;
