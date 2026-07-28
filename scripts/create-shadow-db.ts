
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config({ path: path.join(__dirname, '../.env') });

async function createShadowDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not found in .env');
    process.exit(1);
  }

  // Connect to 'postgres' default database to create a new one
  // Replace the DB name in the URL with 'postgres'
  const adminUrl = connectionString.replace(/\/([^/?]+)(\?|$)/, '/postgres$2');
  
  const client = new Client({ connectionString: adminUrl });

  try {
    await client.connect();
    console.log('Connected to Postgres admin...');
    
    // Check if shadow db exists
    const res = await client.query("SELECT 1 FROM pg_database WHERE datname = 'gusec2_shadow'");
    
    if (res.rowCount === 0) {
      console.log('Creating database gusec2_shadow...');
      await client.query('CREATE DATABASE gusec2_shadow');
      console.log('✅ Created gusec2_shadow');
    } else {
      console.log('✅ gusec2_shadow already exists');
    }
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await client.end();
  }
}

createShadowDb();
