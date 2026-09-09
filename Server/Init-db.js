#!/usr/bin/env node
/**
 * PPM Chits — Complete Database Initialization
 * Creates database, user, and all tables
 * Handles existing database/user gracefully
 * 
 * Run: node Init-db.js
 */

require("dotenv").config();

const { Pool } = require("pg");
const bcrypt = require("bcrypt");

const { DATABASE_URL } = process.env;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set. Check your .env file.");
  process.exit(1);
}

async function initDb() {
  try {
    console.log("🔧 PPM Chits Database Initialization\n");

    // Parse DATABASE_URL
    const url = new URL(DATABASE_URL);
    const dbUser = url.username;
    const dbPassword = url.password;
    const dbHost = url.hostname;
    const dbPort = url.port || 5432;
    const dbName = url.pathname.slice(1);

    console.log("📊 Database Configuration:");
    console.log(`   Host: ${dbHost}:${dbPort}`);
    console.log(`   Database: ${dbName}`);
    console.log(`   User: ${dbUser}\n`);

    // Connect to default 'postgres' database to create ppm_chits database
    const adminPool = new Pool({
      user: dbUser,
      password: dbPassword,
      host: dbHost,
      port: dbPort,
      database: 'postgres',
    });

    try {
      // Create database if not exists
      console.log("🗄️  Creating database...");
      await adminPool.query(`CREATE DATABASE ${dbName}`);
      console.log(`   ✓ Database '${dbName}' created\n`);
    } catch (err) {
      if (err.code === '42P04') {
        console.log(`   ✓ Database '${dbName}' already exists\n`);
      } else {
        throw err;
      }
    }

    try {
      // Create user if not exists
      console.log("👤 Creating database user...");
      await adminPool.query(`CREATE USER ${dbUser} WITH PASSWORD '${dbPassword}'`);
      console.log(`   ✓ User '${dbUser}' created\n`);
    } catch (err) {
      if (err.code === '42710') {
        console.log(`   ✓ User '${dbUser}' already exists\n`);
      } else {
        throw err;
      }
    }

    // Grant privileges
    console.log("🔐 Granting privileges...");
    await adminPool.query(`GRANT ALL PRIVILEGES ON DATABASE ${dbName} TO ${dbUser}`);
    console.log(`   ✓ All privileges granted\n`);

    await adminPool.end();

    // Now connect to the app database
    const pool = new Pool({ connectionString: DATABASE_URL });

    console.log("🔧 Creating tables...\n");

    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'staff',
        is_active BOOLEAN DEFAULT true,
        failed_login_count INTEGER DEFAULT 0,
        locked_until TIMESTAMP NULL,
        companies JSONB NOT NULL DEFAULT '[]',
        screen_overrides JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("   ✓ Users table created");

    // Parties table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS parties (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        relation VARCHAR(255),
        address TEXT,
        city VARCHAR(255),
        phone VARCHAR(20),
        chit_value DECIMAL(12, 2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("   ✓ Parties table created");

    // Party members table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS party_members (
        id SERIAL PRIMARY KEY,
        party_id INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(255),
        phone VARCHAR(20),
        chit_share DECIMAL(12, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("   ✓ Party Members table created\n");

    // Seed admin user
    const adminCheck = await pool.query(
      "SELECT id FROM users WHERE role = $1 LIMIT 1",
      ["super_admin"]
    );

    if (adminCheck.rows.length === 0) {
      console.log("🔐 Seeding admin account...\n");

      const adminEmail = process.env.ADMIN_EMAIL || "admin@ppmchits.local";
      const adminPassword = process.env.ADMIN_PASSWORD || "ChangeMe@12345";
      const adminName = process.env.ADMIN_NAME || "Administrator";

      const passwordHash = await bcrypt.hash(adminPassword, 12);

      await pool.query(
        `INSERT INTO users (email, password_hash, name, role, companies)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          adminEmail,
          passwordHash,
          adminName,
          "super_admin",
          JSON.stringify(["Company 1", "Company 2", "Company 3"]),
        ]
      );

      console.log("   ✓ Super admin account created:");
      console.log(`     📧 Email: ${adminEmail}`);
      console.log(`     🔑 Password: ${adminPassword}`);
      console.log(`     🏢 Companies: Company 1, Company 2, Company 3`);
      console.log(`     ⚠️  CHANGE PASSWORD after first login!\n`);
    } else {
      console.log("   ✓ Super admin already exists. Skipping seed.\n");
    }

    await pool.end();

    console.log("✅ Database initialization completed successfully!\n");
    console.log("📋 Next steps:");
    console.log("   1. npm start              → Start backend (port 4000)");
    console.log("   2. cd ../Client           → Navigate to frontend");
    console.log("   3. npm run dev            → Start frontend (port 5173)\n");
    console.log("🔗 Access: http://localhost:5173\n");

  } catch (err) {
    console.error("❌ Database initialization failed:\n");
    console.error(`   Error: ${err.message}`);
    if (err.detail) console.error(`   Detail: ${err.detail}`);
    if (err.code) console.error(`   Code: ${err.code}`);
    console.error("\n💡 Troubleshooting:");
    console.error("   • Verify PostgreSQL is running");
    console.error("   • Check DATABASE_URL in .env");
    console.error("   • Ensure initial admin user has superuser privileges\n");
    process.exit(1);
  }
}

initDb();