// Simple database setup using better-sqlite3 (lighter than sqlite3)
// This is a workaround for Prisma issues

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'prisma', 'dev.db');

// Create database directory if it doesn't exist
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Initialize database tables
function initDatabase() {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS User (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT,
      preferences TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `);

  // ContentItem table
  db.exec(`
    CREATE TABLE IF NOT EXISTS ContentItem (
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
    )
  `);

  // Newsletter table
  db.exec(`
    CREATE TABLE IF NOT EXISTS Newsletter (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      sentAt INTEGER NOT NULL,
      subject TEXT NOT NULL,
      content TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES User(id)
    )
  `);

  // NewsletterItem table
  db.exec(`
    CREATE TABLE IF NOT EXISTS NewsletterItem (
      id TEXT PRIMARY KEY,
      newsletterId TEXT NOT NULL,
      contentItemId TEXT NOT NULL,
      "order" INTEGER NOT NULL,
      FOREIGN KEY (newsletterId) REFERENCES Newsletter(id),
      FOREIGN KEY (contentItemId) REFERENCES ContentItem(id)
    )
  `);

  console.log('✅ Database initialized');
}

// Initialize on first require
if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='User'").get()) {
  initDatabase();
}

module.exports = db;
