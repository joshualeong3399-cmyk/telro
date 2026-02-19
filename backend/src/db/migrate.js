import { sequelize } from './index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrate() {
  try {
    console.log('🔄 Starting database migration...');
    
    // 同步所有模型到数据库
    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    
    console.log('✅ Database migration completed successfully!');
    console.log(`📍 Database location: ${process.env.DATABASE_PATH || './data/telro.db'}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

migrate();
