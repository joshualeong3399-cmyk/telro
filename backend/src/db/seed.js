import { sequelize } from './index.js';
import User from './models/user.js';
import Extension from './models/extension.js';
import SIPTrunk from './models/sip-trunk.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

async function seed() {
  try {
    console.log('🌱 Starting database seeding...');
    
    // 检查是否已有管理员用户
    const adminExists = await User.findOne({ where: { username: 'admin' } });
    if (adminExists) {
      console.log('ℹ️  Admin user already exists, skipping seed');
      process.exit(0);
    }
    
    // 创建默认分机
    const ext1 = await Extension.create({
      number: '1001',
      name: 'admin',
      type: 'SIP',
      context: 'from-internal',
      secret: 'password123',
      callerid: 'admin <1001>',
      enabled: true,
    });
    
    const ext2 = await Extension.create({
      number: '1002',
      name: '销售代理1',
      type: 'SIP',
      context: 'from-internal',
      secret: 'password456',
      callerid: 'Agent1 <1002>',
      enabled: true,
    });
    
    const ext3 = await Extension.create({
      number: '1003',
      name: '销售代理2',
      type: 'SIP',
      context: 'from-internal',
      secret: 'password789',
      callerid: 'Agent2 <1003>',
      enabled: true,
    });
    
    // 创建默认SIP干线
    await SIPTrunk.create({
      name: 'Provider-1',
      provider: 'VoIP-Provider',
      host: '203.0.113.1',
      port: 5060,
      protocol: 'SIP',
      context: 'from-trunk',
      username: 'account123',
      secret: 'secret123',
      fromuser: 'account123',
      fromdomain: 'provider.example.com',
      status: 'inactive',
      priority: 1,
      ratePerMinute: 0.05,
    });
    
    // 创建管理员用户
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await User.create({
      username: 'admin',
      email: 'admin@telro.local',
      password: hashedPassword,
      fullName: 'Administrator',
      extensionId: ext1.id,
      role: 'admin',
      department: 'Administration',
      enabled: true,
    });
    
    // 创建代理用户
    const agentPassword = await bcrypt.hash('agent123', 10);
    await User.create({
      username: 'agent1',
      email: 'agent1@telro.local',
      password: agentPassword,
      fullName: '销售代理1',
      extensionId: ext2.id,
      role: 'employee',
      department: 'Sales',
      enabled: true,
    });
    
    await User.create({
      username: 'agent2',
      email: 'agent2@telro.local',
      password: agentPassword,
      fullName: '销售代理2',
      extensionId: ext3.id,
      role: 'employee',
      department: 'Sales',
      enabled: true,
    });
    
    console.log('✅ Database seeding completed successfully!');
    console.log('');
    console.log('📝 Default Credentials:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('');
    console.log('📞 Extensions:');
    console.log('   1001 - admin (password: password123)');
    console.log('   1002 - Agent1 (password: password456)');
    console.log('   1003 - Agent2 (password: password789)');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

seed();
