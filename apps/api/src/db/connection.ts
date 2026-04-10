import { Surreal } from 'surrealdb';
import { config } from '../config';
import fs from 'fs';
import path from 'path';

class Database {
  public db: Surreal;
  private isConnected: boolean = false;
  
  constructor() {
    this.db = new Surreal();
  }

  async connect() {
    try {
      await this.db.connect(config.surreal.url);
      await this.db.signin({
        username: config.surreal.user,
        password: config.surreal.pass,
      });
      await this.db.use({
        namespace: config.surreal.ns,
        database: config.surreal.db,
      });
      this.isConnected = true;
      console.log('Connected to SurrealDB');
      
      // Run migrations on startup
      await this.runMigrations();
    } catch (error) {
      console.error('Failed to connect to SurrealDB:', error);
      this.isConnected = false;
      throw error;
    }
  }

  async runMigrations() {
    console.log('Checking for migrations...');
    const migrationsDir = path.join(__dirname, 'migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      console.log('No migrations directory found');
      return;
    }
    
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.surql'))
      .sort(); // Alphabetical order

    for (const file of files) {
      console.log(`Running migration: ${file}`);
      const content = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      
      try {
        await this.db.query(content);
        console.log(`Migration ${file} applied successfully.`);
      } catch (err) {
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

export const dbConnection = new Database();
export const getDb = () => dbConnection.getDb();
export const db = dbConnection.db;
