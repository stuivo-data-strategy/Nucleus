"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.getDb = exports.dbConnection = void 0;
const surrealdb_1 = require("surrealdb");
const config_1 = require("../config");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class Database {
    db;
    isConnected = false;
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
            this.isConnected = true;
            console.log('Connected to SurrealDB');
            // Run migrations on startup
            await this.runMigrations();
        }
        catch (error) {
            console.error('Failed to connect to SurrealDB:', error);
            this.isConnected = false;
            throw error;
        }
    }
    async runMigrations() {
        console.log('Checking for migrations...');
        const migrationsDir = path_1.default.join(__dirname, 'migrations');
        if (!fs_1.default.existsSync(migrationsDir)) {
            console.log('No migrations directory found');
            return;
        }
        const files = fs_1.default.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.surql'))
            .sort(); // Alphabetical order
        for (const file of files) {
            console.log(`Running migration: ${file}`);
            const content = fs_1.default.readFileSync(path_1.default.join(migrationsDir, file), 'utf-8');
            try {
                await this.db.query(content);
                console.log(`Migration ${file} applied successfully.`);
            }
            catch (err) {
                console.error(`Error running migration ${file}:`, err);
                throw err;
            }
        }
    }
    async close() {
        await this.db.close();
        this.isConnected = false;
    }
    getDb() {
        return this.db;
    }
    getStatus() {
        return this.isConnected;
    }
}
exports.dbConnection = new Database();
const getDb = () => exports.dbConnection.getDb();
exports.getDb = getDb;
exports.db = exports.dbConnection.db;
