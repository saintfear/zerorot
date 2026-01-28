// Manual database setup script
// This creates the SQLite database and tables manually

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'prisma', 'dev.db');

// Create database directory if it doesn't exist
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
  console.log('✅ Connected to SQLite database');
});

// Create tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS User (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    preferences TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  )`);

  // ContentItem table
  db.run(`CREATE TABLE IF NOT EXISTS ContentItem (
    id TEXT PRIMARY KEY,
    instagramId TEXT UNIQUE NOT NULL,
    url TEXT NOT NULL,
    caption TEXT,
    imageUrl TEXT,
    hashtags TEXT,
    author TEXT,
    score REAL,
    discoveredAt INTEGER NOT NULL,
    userId TEXT,
    FOREIGN KEY (userId) REFERENCES User(id)
  )`);

  // Newsletter table
  db.run(`CREATE TABLE IF NOT EXISTS Newsletter (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    sentAt INTEGER NOT NULL,
    subject TEXT NOT NULL,
    content TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES User(id)
  )`);

  // NewsletterItem table
  db.run(`CREATE TABLE IF NOT EXISTS NewsletterItem (
    id TEXT PRIMARY KEY,
    newsletterId TEXT NOT NULL,
    contentItemId TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    FOREIGN KEY (newsletterId) REFERENCES Newsletter(id),
    FOREIGN KEY (contentItemId) REFERENCES ContentItem(id)
  )`);

  // Prisma migrations table
  db.run(`CREATE TABLE IF NOT EXISTS _prisma_migrations (
    id TEXT PRIMARY KEY,
    checksum TEXT,
    finished_at INTEGER,
    migration_name TEXT,
    logs TEXT,
    rolled_back_at INTEGER,
    started_at INTEGER,
    applied_steps_count INTEGER
  )`);

  console.log('✅ Database tables created successfully');
  
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('✅ Database setup complete!');
      console.log('📝 Next: Run "npx prisma generate" to generate Prisma client');
    }
  });
});
