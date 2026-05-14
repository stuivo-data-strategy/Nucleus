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
// Keep-alive interval: ping SurrealDB every 30s to prevent idle disconnect.
// Reconnect automatically if the connection drops.
const KEEP_ALIVE_MS = 30_000;
const RECONNECT_DELAY_MS = 3_000;
const MAX_RECONNECT_ATTEMPTS = 10;
class Database {
    db;
    isConnected = false;
    keepAliveTimer = null;
    reconnecting = false;
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
            // Start keep-alive pings
            this.startKeepAlive();
            // Run migrations on startup
            await this.runMigrations();
        }
        catch (error) {
            console.error('Failed to connect to SurrealDB:', error);
            this.isConnected = false;
            throw error;
        }
    }
    startKeepAlive() {
        this.stopKeepAlive();
        this.keepAliveTimer = setInterval(async () => {
            try {
                // Lightweight query to keep the WS connection alive
                await this.db.query('RETURN true');
            }
            catch (err) {
                console.warn('Keep-alive ping failed, attempting reconnect…', err);
                this.isConnected = false;
                this.reconnect();
            }
        }, KEEP_ALIVE_MS);
    }
    stopKeepAlive() {
        if (this.keepAliveTimer) {
            clearInterval(this.keepAliveTimer);
            this.keepAliveTimer = null;
        }
    }
    async reconnect() {
        if (this.reconnecting)
            return;
        this.reconnecting = true;
        this.stopKeepAlive();
        for (let attempt = 1; attempt <= MAX_RECONNECT_ATTEMPTS; attempt++) {
            console.log(`Reconnect attempt ${attempt}/${MAX_RECONNECT_ATTEMPTS}…`);
            try {
                // Create a fresh Surreal instance for a clean connection
                this.db = new surrealdb_1.Surreal();
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
                this.reconnecting = false;
                console.log('Reconnected to SurrealDB');
                this.startKeepAlive();
                return;
            }
            catch (err) {
                console.error(`Reconnect attempt ${attempt} failed:`, err);
                if (attempt < MAX_RECONNECT_ATTEMPTS) {
                    await new Promise(r => setTimeout(r, RECONNECT_DELAY_MS * attempt));
                }
            }
        }
        this.reconnecting = false;
        console.error('All reconnect attempts exhausted — SurrealDB is unreachable');
    }
    async runMigrations() {
        console.log('Checking for migrations...');
        const migrationsDir = path_1.default.join(__dirname, 'migrations');
        if (!fs_1.default.existsSync(migrationsDir)) {
            console.log('No migrations directory found');
            return;
        }
        // Ensure migration tracking table exists
        await this.db.query(`
      DEFINE TABLE IF NOT EXISTS schema_migration SCHEMAFULL;
      DEFINE FIELD IF NOT EXISTS name ON schema_migration TYPE string;
      DEFINE FIELD IF NOT EXISTS applied_at ON schema_migration TYPE datetime;
      DEFINE INDEX IF NOT EXISTS idx_migration_name ON schema_migration FIELDS name UNIQUE;
    `);
        // Fetch already-applied migrations
        const appliedRes = await this.db.query(`SELECT name FROM schema_migration`);
        const applied = new Set(appliedRes[0].map((r) => r.name));
        const files = fs_1.default.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.surql'))
            .sort();
        for (const file of files) {
            if (applied.has(file)) {
                console.log(`Migration ${file} already applied, skipping.`);
                continue;
            }
            console.log(`Running migration: ${file}`);
            const content = fs_1.default.readFileSync(path_1.default.join(migrationsDir, file), 'utf-8');
            try {
                await this.db.query(content);
                await this.db.query(`CREATE schema_migration CONTENT { name: $name, applied_at: time::now() }`, { name: file });
                console.log(`Migration ${file} applied successfully.`);
            }
            catch (err) {
                console.error(`Error running migration ${file}:`, err);
                throw err;
            }
        }
    }
    async close() {
        this.stopKeepAlive();
        await this.db.close();
        this.isConnected = false;
    }
    getDb() {
        if (!this.isConnected && !this.reconnecting) {
            this.reconnect();
        }
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
