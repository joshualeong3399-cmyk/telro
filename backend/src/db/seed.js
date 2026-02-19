import { sequelize } from './index.js';
import User from './models/user.js';
import Extension from './models/extension.js';
import SIPTrunk from './models/sip-trunk.js';
import Agent from './models/agent.js';
import AgentStats from './models/agent-stats.js';
import Customer from './models/customer.js';
import CallRecord from './models/call-record.js';
import Recording from './models/recording.js';
import Billing from './models/billing.js';
import CallQueue from './models/call-queue.js';
import QueueTask from './models/queue-task.js';
import IVR from './models/ivr.js';
import InboundRoute from './models/inbound-route.js';
import OutboundRoute from './models/outbound-route.js';
import RingGroup from './models/ring-group.js';
import VoicemailBox from './models/voicemail-box.js';
import ConferenceRoom from './models/conference-room.js';
import AiFlow from './models/ai-flow.js';
import AudioFile from './models/audio-file.js';
import Disposition from './models/disposition.js';
import DNC from './models/dnc.js';
import SmsMessage from './models/sms-message.js';
import TimeCondition from './models/time-condition.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

function daysAgo( n ) {
  const d = new Date();
  d.setDate( d.getDate() - n );
  return d;
}
function hoursAgo( n ) {
  const d = new Date();
  d.setHours( d.getHours() - n );
  return d;
}

async function seed() {
  try {
    console.log( '🌱 Starting comprehensive database seeding...' );

    // 检查是否已有管理员用户
    const adminExists = await User.findOne({ where: { username: 'admin' } });
    if (adminExists) {
      console.log('ℹ️  Admin user already exists, skipping seed');
      process.exit(0);
    }

    // ── Extensions ──────────────────────────────────────────────
    console.log( '  📞 Creating extensions...' );
    const extData = [
      { number: '1001', name: 'Administrator', secret: 'pass1001' },
      { number: '1002', name: '张伟', secret: 'pass1002' },
      { number: '1003', name: '李娜', secret: 'pass1003' },
      { number: '1004', name: '王磊', secret: 'pass1004' },
      { number: '1005', name: '赵静', secret: 'pass1005' },
      { number: '1006', name: '陈刚', secret: 'pass1006' },
      { number: '1007', name: '刘芳', secret: 'pass1007' },
      { number: '1008', name: '杨帅', secret: 'pass1008' },
    ];
    const exts = await Promise.all( extData.map( e => Extension.create( {
      number: e.number,
      name: e.name,
      type: 'SIP',
      context: 'from-internal',
      secret: e.secret,
      callerid: `${ e.name } <${ e.number }>`,
      dtmfMode: 'rfc4733',
      qualify: true,
      nat: 'force_rport,comedia',
      enabled: true,
    } ) ) );

    // ── SIP Trunks ──────────────────────────────────────────────
    console.log( '  📡 Creating SIP trunks...' );
    const trunk1 = await SIPTrunk.create( {
      name: 'Provider-1 (主线)',
      provider: '中国电信 VoIP',
      host: '203.0.113.10',
      port: 5060,
      protocol: 'SIP',
      context: 'from-trunk',
      username: 'telro_main',
      secret: 'trunk_secret_1',
      fromuser: 'telro_main',
      fromdomain: 'voip.telecom.cn',
      status: 'active',
      priority: 1,
      maxChannels: 30,
      ratePerMinute: 0.04,
      supportsSms: true,
      enabled: true,
    });
    const trunk2 = await SIPTrunk.create( {
      name: 'Provider-2 (备线)',
      provider: '联通 VoIP',
      host: '203.0.113.20',
      port: 5060,
      protocol: 'SIP',
      context: 'from-trunk',
      username: 'telro_backup',
      secret: 'trunk_secret_2',
      fromuser: 'telro_backup',
      fromdomain: 'voip.unicom.cn',
      status: 'active',
      priority: 2,
      maxChannels: 20,
      ratePerMinute: 0.05,
      supportsSms: true,
      enabled: true,
    });

    // ── Users ────────────────────────────────────────────────────
    console.log( '  👤 Creating users...' );
    const adminPwd = await bcrypt.hash( 'admin123', 10 );
    const empPwd = await bcrypt.hash( 'agent123', 10 );

    const adminUser = await User.create( {
      username: 'admin',
      email: 'admin@telro.local',
      password: adminPwd,
      fullName: 'Administrator',
      extensionId: exts[ 0 ].id,
      role: 'admin',
      department: 'Administration',
      enabled: true,
    });

    const op1 = await User.create( {
      username: 'operator1',
      email: 'operator1@telro.local',
      password: empPwd,
      fullName: '运营主管',
      extensionId: exts[ 1 ].id,
      role: 'operator',
      department: 'Operations',
      enabled: true,
    } );

    const agentUsers = [];
    const agentNames = [
      { username: 'agent_zhang', fullName: '张伟', ext: exts[ 2 ] },
      { username: 'agent_li', fullName: '李娜', ext: exts[ 3 ] },
      { username: 'agent_wang', fullName: '王磊', ext: exts[ 4 ] },
      { username: 'agent_zhao', fullName: '赵静', ext: exts[ 5 ] },
      { username: 'agent_chen', fullName: '陈刚', ext: exts[ 6 ] },
      { username: 'agent_liu', fullName: '刘芳', ext: exts[ 7 ] },
    ];
    for ( const a of agentNames ) {
      const u = await User.create( {
        username: a.username,
        email: `${ a.username }@telro.local`,
        password: empPwd,
        fullName: a.fullName,
        extensionId: a.ext.id,
        role: 'employee',
        department: 'Sales',
        enabled: true,
      } );
      agentUsers.push( { user: u, ext: a.ext } );
    }

    // ── Audio Files ──────────────────────────────────────────────
    console.log( '  🎵 Creating audio files...' );
    const audioFiles = await Promise.all( [
      AudioFile.create( {
        name: '欢迎语',
        description: '系统欢迎语音',
        filename: 'welcome.wav',
        filePath: '/var/lib/asterisk/sounds/custom/welcome.wav',
        asteriskPath: 'custom/welcome',
        duration: 8,
        size: 128000,
        mimeType: 'audio/wav',
        category: 'ivr',
        uploadedBy: adminUser.id,
        enabled: true,
      } ),
      AudioFile.create( {
        name: '等待音乐',
        description: '通话等待背景音乐',
        filename: 'hold_music.wav',
        filePath: '/var/lib/asterisk/sounds/custom/hold_music.wav',
        asteriskPath: 'custom/hold_music',
        duration: 120,
        size: 1920000,
        mimeType: 'audio/wav',
        category: 'moh',
        uploadedBy: adminUser.id,
        enabled: true,
      } ),
      AudioFile.create( {
        name: '销售话术',
        description: '外呼销售开场白',
        filename: 'sales_intro.wav',
        filePath: '/var/lib/asterisk/sounds/custom/sales_intro.wav',
        asteriskPath: 'custom/sales_intro',
        duration: 15,
        size: 240000,
        mimeType: 'audio/wav',
        category: 'campaign',
        uploadedBy: adminUser.id,
        enabled: true,
      } ),
    ] );

    // ── IVR ─────────────────────────────────────────────────────
    console.log( '  📋 Creating IVR menus...' );
    const ivr1 = await IVR.create( {
      name: '主IVR菜单',
      description: '公司主要来电应答菜单',
      greeting: '欢迎致电，请按1转销售，按2转客服，按0转人工。',
      greetingType: 'tts',
      timeout: 10,
      options: JSON.stringify( [
        { digit: '1', action: 'queue', target: null, label: '销售部' },
        { digit: '2', action: 'queue', target: null, label: '客服部' },
        { digit: '0', action: 'extension', target: '1001', label: '人工坐席' },
      ] ),
      invalidMessage: '无效按键，请重新选择。',
      maxRetries: 3,
      defaultAction: 'hangup',
      enabled: true,
      recordCalls: true,
    } );

    const ivr2 = await IVR.create( {
      name: '售后IVR',
      description: '售后服务分流菜单',
      greeting: '您好，这里是售后服务，按1查询订单，按2申请退换，按9返回上级。',
      greetingType: 'tts',
      timeout: 8,
      options: JSON.stringify( [
        { digit: '1', action: 'extension', target: '1003', label: '查询订单' },
        { digit: '2', action: 'extension', target: '1004', label: '退换货' },
        { digit: '9', action: 'ivr', target: null, label: '返回' },
      ] ),
      invalidMessage: '输入无效，请重试。',
      maxRetries: 2,
      defaultAction: 'hangup',
      enabled: true,
      recordCalls: false,
    } );

    // ── Time Conditions ──────────────────────────────────────────
    console.log( '  ⏰ Creating time conditions...' );
    const tc1 = await TimeCondition.create( {
      name: '工作时间',
      description: '周一至周六 09:00-18:00',
      timezone: 'Asia/Shanghai',
      schedule: JSON.stringify( [
        { days: [ 'mon', 'tue', 'wed', 'thu', 'fri', 'sat' ], timeStart: '09:00', timeEnd: '18:00' },
      ] ),
      openAction: 'ivr',
      openDestinationId: ivr1.id,
      closedAction: 'voicemail',
      closedDestinationId: null,
      overrideMode: 'auto',
      holidays: JSON.stringify( [] ),
      enabled: true,
    } );

    const tc2 = await TimeCondition.create( {
      name: '节假日规则',
      description: '国家法定节假日转语音信箱',
      timezone: 'Asia/Shanghai',
      schedule: JSON.stringify( [] ),
      openAction: 'ivr',
      openDestinationId: ivr1.id,
      closedAction: 'hangup',
      closedDestinationId: null,
      overrideMode: 'force_closed',
      holidays: JSON.stringify( [ '2024-01-01', '2024-02-10', '2024-05-01', '2024-10-01' ] ),
      enabled: true,
    } );

    // ── Call Queues ──────────────────────────────────────────────
    console.log( '  📞 Creating call queues...' );
    const queue1 = await CallQueue.create( {
      name: '销售外呼队列',
      description: '主力销售外呼营销活动',
      sipTrunkId: trunk1.id,
      strategy: 'roundrobin',
      wrapupTime: 10,
      timeout: 30,
      maxWaitTime: 120,
      recordCalls: true,
      musicOnHold: true,
      announcePosition: true,
      aiFlowId: null,
      callerIdOverride: '02088888888',
      scheduledTime: null,
      status: 'active',
      maxAttempts: 3,
      callMode: 'human',
      ivrId: null,
    } );

    const queue2 = await CallQueue.create( {
      name: '客服来电队列',
      description: '客户来电接听分配队列',
      sipTrunkId: trunk1.id,
      strategy: 'leastrecent',
      wrapupTime: 15,
      timeout: 45,
      maxWaitTime: 180,
      recordCalls: true,
      musicOnHold: true,
      announcePosition: true,
      aiFlowId: null,
      callerIdOverride: null,
      scheduledTime: null,
      status: 'active',
      maxAttempts: 1,
      callMode: 'human',
      ivrId: ivr1.id,
    } );

    const queue3 = await CallQueue.create( {
      name: 'AI智能外呼-保险',
      description: 'AI机器人外呼保险产品',
      sipTrunkId: trunk2.id,
      strategy: 'random',
      wrapupTime: 5,
      timeout: 20,
      maxWaitTime: 60,
      recordCalls: true,
      musicOnHold: false,
      announcePosition: false,
      aiFlowId: null,
      callerIdOverride: '02066666666',
      scheduledTime: null,
      status: 'paused',
      maxAttempts: 2,
      callMode: 'ai',
      ivrId: null,
    } );

    // ── Inbound Routes ───────────────────────────────────────────
    console.log( '  📥 Creating inbound routes...' );
    await InboundRoute.create( {
      name: '主号码入线',
      description: '公司主叫号码 4000',
      did: '4000',
      callerIdPattern: '',
      destination: 'ivr',
      destinationId: ivr1.id,
      timeConditionId: tc1.id,
      priority: 1,
      ringTimeout: 30,
      enabled: true,
    } );
    await InboundRoute.create( {
      name: '售后专线',
      description: '售后服务专用号码',
      did: '4001',
      callerIdPattern: '',
      destination: 'ivr',
      destinationId: ivr2.id,
      timeConditionId: null,
      priority: 2,
      ringTimeout: 45,
      enabled: true,
    } );

    // ── Outbound Routes ──────────────────────────────────────────
    console.log( '  📤 Creating outbound routes...' );
    await OutboundRoute.create( {
      name: '默认外呼路由',
      description: '所有外呼默认走主干线',
      patterns: JSON.stringify( [ '^[0-9]{7,11}$' ] ),
      sipTrunkId: trunk1.id,
      failoverTrunkIds: JSON.stringify( [ trunk2.id ] ),
      priority: 1,
      callerIdMode: 'trunk',
      callerIdOverride: '',
      maxChannels: 20,
      allowedExtensions: JSON.stringify( [] ),
      enabled: true,
    } );
    await OutboundRoute.create( {
      name: '国际外呼路由',
      description: '国际号码走备用干线',
      patterns: JSON.stringify( [ '^00[0-9]+$', '^\\+[0-9]+$' ] ),
      sipTrunkId: trunk2.id,
      failoverTrunkIds: JSON.stringify( [] ),
      priority: 2,
      callerIdMode: 'custom',
      callerIdOverride: '862188888888',
      maxChannels: 5,
      allowedExtensions: JSON.stringify( [] ),
      enabled: true,
    } );

    // ── Ring Groups ──────────────────────────────────────────────
    console.log( '  🔔 Creating ring groups...' );
    await RingGroup.create( {
      number: '8100',
      name: '销售主管组',
      description: '销售部主管统一响铃组',
      members: JSON.stringify( exts.slice( 2, 5 ).map( e => ( { extensionId: e.id, number: e.number } ) ) ),
      strategy: 'ringall',
      ringTime: 20,
      callConfirmation: false,
      failoverAction: 'voicemail',
      failoverId: null,
      prefix: '',
      enabled: true,
    });

    // ── Voicemail Boxes ──────────────────────────────────────────
    console.log( '  📬 Creating voicemail boxes...' );
    await VoicemailBox.create( {
      extensionId: exts[ 0 ].id,
      mailbox: '1001@default',
      password: '1001',
      email: 'admin@telro.local',
      emailAttach: true,
      deleteAfterEmail: false,
      timezone: 'cn_CN_UTF-8|Asia/Shanghai',
      greetingType: 'unavail',
      maxMessages: 100,
      maxMessageLength: 180,
      enabled: true,
    } );
    await VoicemailBox.create( {
      extensionId: exts[ 2 ].id,
      mailbox: '1003@default',
      password: '1003',
      email: 'agent_li@telro.local',
      emailAttach: false,
      deleteAfterEmail: false,
      timezone: 'cn_CN_UTF-8|Asia/Shanghai',
      greetingType: 'unavail',
      maxMessages: 50,
      maxMessageLength: 120,
      enabled: true,
    } );

    // ── Conference Rooms ─────────────────────────────────────────
    console.log( '  🏛️  Creating conference rooms...' );
    await ConferenceRoom.create( {
      number: '8000',
      name: '销售会议室 A',
      description: '销售团队日常会议',
      pinRequired: true,
      pin: '1234',
      adminPin: '9999',
      maxMembers: 20,
      recordEnabled: true,
      muteOnEntry: false,
      musicOnHold: true,
      announceCount: true,
      waitForHost: false,
      enabled: true,
    } );
    await ConferenceRoom.create( {
      number: '8001',
      name: '全员大会议室 B',
      description: '全员会议用途',
      pinRequired: false,
      pin: '',
      adminPin: '8888',
      maxMembers: 50,
      recordEnabled: false,
      muteOnEntry: true,
      musicOnHold: true,
      announceCount: false,
      waitForHost: true,
      enabled: true,
    } );

    // ── AI Flows ─────────────────────────────────────────────────
    console.log( '  🤖 Creating AI flows...' );
    const flow1 = await AiFlow.create( {
      name: '保险产品介绍流',
      description: 'AI外呼介绍意外险产品',
      firstStepId: 'step-greeting',
      steps: JSON.stringify( [
        { id: 'step-greeting', type: 'play', text: '您好，我是中国人寿AI助手，为您介绍一款意外险产品，只需两分钟，请问您现在方便吗？' },
        { id: 'step-gather', type: 'gather', maxDigits: 1, timeout: 5, prompt: '按1继续了解，按2感谢来电', branches: [ { digit: '1', nextStepId: 'step-intro' }, { digit: '2', nextStepId: 'step-bye' } ] },
        { id: 'step-intro', type: 'play', text: '该产品保费每月仅需99元，保障金额高达100万，欢迎询问更多详情。' },
        { id: 'step-bye', type: 'hangup' },
      ] ),
      maxRetries: 2,
      language: 'zh',
      enabled: true,
    } );
    const flow2 = await AiFlow.create( {
      name: '满意度调研流',
      description: '通话结束后客户满意度调研',
      firstStepId: 'step-survey',
      steps: JSON.stringify( [
        { id: 'step-survey', type: 'play', text: '感谢您本次通话，请对我们的服务做出评分，按1非常满意，按2满意，按3不满意。' },
        { id: 'step-gather2', type: 'gather', maxDigits: 1, timeout: 8, prompt: '请按键评分', branches: [ { digit: '1', nextStepId: 'step-end' }, { digit: '2', nextStepId: 'step-end' }, { digit: '3', nextStepId: 'step-end' } ] },
        { id: 'step-end', type: 'play', text: '感谢您的评分，再见！' },
      ] ),
      maxRetries: 1,
      language: 'zh',
      enabled: true,
    } );

    // ── Agents ───────────────────────────────────────────────────
    console.log( '  🧑‍💼 Creating agents...' );
    const agentStatuses = [ 'logged_in', 'on_call', 'on_break', 'logged_in', 'logged_in', 'logged_out' ];
    const skillSets = [
      [ '销售', '电话营销', '保险' ],
      [ '客服', '投诉处理', '售后' ],
      [ '销售', '贷款', '理财' ],
      [ '客服', '电话营销' ],
      [ '销售', '企业客户' ],
      [ '培训中' ],
    ];
    const agents = [];
    for ( let i = 0; i < agentUsers.length; i++ ) {
      const { user, ext } = agentUsers[ i ];
      const a = await Agent.create( {
        userId: user.id,
        extensionId: ext.id,
        loginTime: agentStatuses[ i ] !== 'logged_out' ? hoursAgo( 4 ) : null,
        logoutTime: agentStatuses[ i ] === 'logged_out' ? hoursAgo( 1 ) : null,
        status: agentStatuses[ i ],
        totalWorkDuration: Math.floor( Math.random() * 50000 + 10000 ),
        currentDayDuration: Math.floor( Math.random() * 25000 + 3600 ),
        skillTags: skillSets[ i ],
        performanceRating: parseFloat( ( 3.5 + Math.random() * 1.5 ).toFixed( 1 ) ),
        department: i < 3 ? '销售部' : i < 5 ? '客服部' : '综合部',
        managerId: null,
        notes: '',
        enabled: true,
      } );
      agents.push( a );
    }

    // ── Dispositions ─────────────────────────────────────────────
    console.log( '  📝 Creating dispositions...' );
    const dispositions = await Promise.all( [
      Disposition.create( { code: 'ANSWERED', name: '已接通', color: '#52c41a', isSuccess: true, requireCallback: false, requireNote: false, sortOrder: 1, autoClose: false } ),
      Disposition.create( { code: 'NO_ANSWER', name: '无人接听', color: '#faad14', isSuccess: false, requireCallback: true, requireNote: false, sortOrder: 2, autoClose: false } ),
      Disposition.create( { code: 'BUSY', name: '忙线', color: '#ff7a45', isSuccess: false, requireCallback: true, requireNote: false, sortOrder: 3, autoClose: false } ),
      Disposition.create( { code: 'REJECTED', name: '拒接', color: '#f5222d', isSuccess: false, requireCallback: false, requireNote: true, sortOrder: 4, autoClose: true } ),
      Disposition.create( { code: 'CONVERTED', name: '已成交', color: '#1677ff', isSuccess: true, requireCallback: false, requireNote: true, sortOrder: 5, autoClose: false } ),
    ] );

    // ── Customers ────────────────────────────────────────────────
    console.log( '  👥 Creating customers...' );
    const customerData = [
      { phone: '13800138001', name: '赵明', company: '北京科技有限公司', email: 'zhao.ming@example.com', status: 'converted', source: 'referral' },
      { phone: '13900139002', name: '孙芳', company: '上海贸易集团', email: 'sun.fang@example.com', status: 'qualified', source: 'cold_call' },
      { phone: '13700137003', name: '周涛', company: null, email: null, status: 'contacted', source: 'ads' },
      { phone: '13600136004', name: '吴玲', company: '广州电子商务公司', email: 'wu.ling@example.com', status: 'new', source: 'import' },
      { phone: '13500135005', name: '郑勇', company: '成都制造业集团', email: null, status: 'lost', source: 'cold_call' },
      { phone: '13400134006', name: '冯欣', company: null, email: 'feng.xin@example.com', status: 'new', source: 'ads' },
      { phone: '13300133007', name: '褚健', company: '天津物流有限公司', email: null, status: 'contacted', source: 'cold_call' },
      { phone: '13200132008', name: '卫娟', company: '重庆零售集团', email: 'wei.juan@example.com', status: 'qualified', source: 'referral' },
      { phone: '13100131009', name: '蒋磊', company: null, email: null, status: 'new', source: 'import' },
      { phone: '15800158010', name: '沈华', company: '杭州互联网公司', email: 'shen.hua@example.com', status: 'converted', source: 'ads' },
      { phone: '15900159011', name: '韩萍', company: '西安教育集团', email: null, status: 'contacted', source: 'cold_call' },
      { phone: '15600156012', name: '杨洋', company: '武汉汽车销售公司', email: null, status: 'new', source: 'import' },
      { phone: '15500155013', name: '朱伟', company: '南京建筑公司', email: 'zhu.wei@example.com', status: 'qualified', source: 'referral' },
      { phone: '15400154014', name: '秦丽', company: null, email: null, status: 'lost', source: 'cold_call' },
      { phone: '15300153015', name: '尹强', company: '深圳金融服务公司', email: 'yin.qiang@example.com', status: 'converted', source: 'ads' },
      { phone: '18800188016', name: '任博', company: '北京房产中介', email: null, status: 'new', source: 'import' },
      { phone: '18700187017', name: '钱莉', company: null, email: 'qian.li@example.com', status: 'contacted', source: 'ads' },
      { phone: '18600186018', name: '唐振', company: '济南机械有限公司', email: null, status: 'new', source: 'cold_call' },
      { phone: '18500185019', name: '许娜', company: '福建食品集团', email: 'xu.na@example.com', status: 'qualified', source: 'referral' },
      { phone: '18400184020', name: '何俊', company: null, email: null, status: 'contacted', source: 'cold_call' },
    ];
    const customers = await Promise.all( customerData.map( ( c, i ) => Customer.create( {
      phone: c.phone,
      name: c.name,
      company: c.company,
      email: c.email,
      industry: [ '科技', '金融', '零售', '制造', '教育', '医疗' ][ i % 6 ],
      region: [ '北京', '上海', '广州', '深圳', '成都', '重庆', '杭州', '武汉' ][ i % 8 ],
      tags: JSON.stringify( i % 3 === 0 ? [ 'VIP' ] : i % 3 === 1 ? [ '潜力' ] : [] ),
      source: c.source,
      status: c.status,
      notes: c.status === 'converted' ? '已签约，满意度高' : c.status === 'lost' ? '价格敏感，暂不感兴趣' : '',
      lastCallAt: i % 4 !== 0 ? daysAgo( Math.floor( Math.random() * 10 ) ) : null,
      nextFollowUpAt: [ 'new', 'contacted', 'qualified' ].includes( c.status ) ? daysAgo( -Math.floor( Math.random() * 7 ) ) : null,
      dealValue: c.status === 'converted' ? parseFloat( ( Math.random() * 50000 + 5000 ).toFixed( 2 ) ) : null,
    } ) ) );

    // ── Call Records ─────────────────────────────────────────────
    console.log( '  📞 Creating call records...' );
    const callStatuses = [ 'answered', 'no-answer', 'busy', 'answered', 'answered', 'failed', 'answered', 'no-answer', 'answered', 'answered' ];
    const callRecords = [];
    for ( let i = 0; i < 30; i++ ) {
      const agentIdx = i % agents.length;
      const custIdx = i % customers.length;
      const agent = agents[ agentIdx ];
      const cust = customers[ custIdx ];
      const ext = agentUsers[ agentIdx ].ext;
      const isAnswered = callStatuses[ i % callStatuses.length ] === 'answered';
      const startAt = daysAgo( Math.floor( Math.random() * 14 ) );
      const talkDur = isAnswered ? Math.floor( Math.random() * 300 + 30 ) : 0;
      const holdDur = isAnswered ? Math.floor( Math.random() * 20 ) : 0;
      const totalDur = talkDur + holdDur + Math.floor( Math.random() * 10 );
      const endAt = new Date( startAt.getTime() + totalDur * 1000 );

      const cr = await CallRecord.create( {
        from: i % 3 === 0 ? cust.phone : ext.number,
        to: i % 3 === 0 ? ext.number : cust.phone,
        channel: `SIP/${ ext.number }-${ uuidv4().slice( 0, 8 ) }`,
        extensionId: ext.id,
        trunkName: trunk1.name,
        queueId: i % 5 === 0 ? queue1.id : null,
        type: i % 3 === 0 ? 'inbound' : 'outbound',
        startTime: startAt,
        connectTime: isAnswered ? new Date( startAt.getTime() + 5000 ) : null,
        endTime: endAt,
        talkDuration: talkDur,
        holdDuration: holdDur,
        totalDuration: totalDur,
        status: callStatuses[ i % callStatuses.length ],
        callerIdName: i % 3 === 0 ? cust.name : ext.name,
        hasRecording: isAnswered && i % 2 === 0,
        agentId: agent.id,
        customerId: cust.id,
        notes: isAnswered ? '通话正常' : '',
        createdAt: startAt,
      } );
      callRecords.push( cr );
    }

    // ── Recordings ───────────────────────────────────────────────
    console.log( '  🎙️  Creating recordings...' );
    const answeredCalls = callRecords.filter( c => c.hasRecording );
    for ( let i = 0; i < Math.min( 8, answeredCalls.length ); i++ ) {
      const cr = answeredCalls[ i ];
      await Recording.create( {
        callRecordId: cr.id,
        filename: `recording_${ cr.id.slice( 0, 8 ) }.wav`,
        filePath: `/var/spool/asterisk/monitor/${ cr.id.slice( 0, 8 ) }.wav`,
        format: 'wav',
        duration: cr.talkDuration,
        size: BigInt( cr.talkDuration * 16000 ),
        channel: cr.channel,
        ingressChannel: Math.floor( Math.random() * 1000 ),
        egressChannel: Math.floor( Math.random() * 1000 ),
        quality: [ 'low', 'medium', 'high' ][ i % 3 ],
        status: 'completed',
        isShared: false,
      } );
    }

    // ── Billing ──────────────────────────────────────────────────
    console.log( '  💰 Creating billing records...' );
    const ratePerSec = trunk1.ratePerMinute / 60;
    for ( let i = 0; i < 20; i++ ) {
      const cr = callRecords[ i ];
      if ( cr.talkDuration === 0 ) continue;
      const cost = parseFloat( ( cr.talkDuration * ratePerSec ).toFixed( 4 ) );
      await Billing.create( {
        callRecordId: cr.id,
        agentId: cr.agentId,
        sipTrunkId: trunk1.id,
        chargeType: cr.type === 'outbound' ? 'campaign-outbound' : 'campaign-inbound',
        extensionId: cr.extensionId,
        direction: cr.type,
        from: cr.from,
        to: cr.to,
        duration: cr.talkDuration,
        cost,
        ratePerSecond: ratePerSec,
        totalAmount: cost,
      } );
    }

    // ── Queue Tasks ──────────────────────────────────────────────
    console.log( '  📋 Creating queue tasks...' );
    const taskStatuses = [ 'pending', 'answered', 'no-answer', 'busy', 'failed', 'pending', 'calling', 'transferred' ];
    for ( let i = 0; i < 20; i++ ) {
      const qIdx = i % 3;
      const queue = [ queue1, queue2, queue3 ][ qIdx ];
      const cust = customers[ i % customers.length ];
      const agent = agents[ i % agents.length ];
      const ts = taskStatuses[ i % taskStatuses.length ];
      await QueueTask.create( {
        queueId: queue.id,
        phone: cust.phone,
        customerName: cust.name,
        customerId: cust.id,
        agentId: ts !== 'pending' ? agent.id : null,
        status: ts,
        callMode: qIdx === 2 ? 'ai' : 'human',
        disposition: ts === 'answered' ? 'ANSWERED' : ts === 'no-answer' ? 'NO_ANSWER' : ts === 'busy' ? 'BUSY' : null,
        attempts: ts === 'pending' ? 0 : Math.floor( Math.random() * 3 ) + 1,
        talkDuration: ts === 'answered' ? Math.floor( Math.random() * 200 + 30 ) : 0,
        scheduledAt: daysAgo( -Math.floor( Math.random() * 3 ) ),
        lastAttemptAt: ts !== 'pending' ? daysAgo( Math.floor( Math.random() * 3 ) ) : null,
        notes: ts === 'transferred' ? '已转人工坐席' : '',
      } );
    }

    // ── DNC List ─────────────────────────────────────────────────
    console.log( '  🚫 Creating DNC entries...' );
    const dncNumbers = [ '13999999001', '13999999002', '13999999003', '13999999004', '13999999005' ];
    const dncReasons = [ 'customer_request', 'regulatory', 'invalid_number', 'manual', 'imported' ];
    for ( let i = 0; i < dncNumbers.length; i++ ) {
      await DNC.create( {
        phone: dncNumbers[ i ],
        reason: dncReasons[ i ],
        notes: i === 0 ? '客户明确要求停止联系' : i === 1 ? '监管要求' : '',
        expiresAt: i === 0 ? daysAgo( -365 ) : null,
        addedBy: adminUser.id,
        active: true,
      } );
    }

    // ── SMS Messages ─────────────────────────────────────────────
    console.log( '  💬 Creating SMS messages...' );
    const smsData = [
      { from: '02088888888', to: '13800138001', body: '您好，感谢您对我们保险产品的关注，请问您什么时间方便进一步沟通？', dir: 'outbound', status: 'delivered' },
      { from: '13800138001', to: '02088888888', body: '好的，明天上午10点可以。', dir: 'inbound', status: 'received' },
      { from: '02088888888', to: '13900139002', body: '您好，您申请的理财产品已审核通过，请查收相关文件。', dir: 'outbound', status: 'sent' },
      { from: '02088888888', to: '13700137003', body: '温馨提示：您的保单将于下月到期，请及时续保。', dir: 'outbound', status: 'delivered' },
      { from: '13700137003', to: '02088888888', body: '谢谢提醒，我稍后查看。', dir: 'inbound', status: 'received' },
      { from: '02088888888', to: '15800158010', body: '恭喜您成为我们的VIP客户！专属客服热线：4001', dir: 'outbound', status: 'delivered' },
      { from: '02088888888', to: '15900159011', body: '您好，我们有新推出的健康险产品，月保费仅需158元，感兴趣吗？', dir: 'outbound', status: 'failed' },
      { from: '15900159011', to: '02088888888', body: '不需要，请不要再发短信。', dir: 'inbound', status: 'received' },
      { from: '02088888888', to: '18800188016', body: '【Telro】验证码：583921，5分钟内有效，请勿泄露。', dir: 'outbound', status: 'delivered' },
      { from: '02088888888', to: '18700187017', body: '您好，您的案件已受理，编号：TL20240115001，预计3个工作日内回复。', dir: 'outbound', status: 'sent' },
    ];
    for ( const s of smsData ) {
      await SmsMessage.create( {
        from: s.from,
        to: s.to,
        body: s.body,
        direction: s.dir,
        status: s.status,
        sipTrunkId: s.dir === 'outbound' ? trunk1.id : trunk2.id,
        agentId: null,
        customerId: null,
        errorMessage: s.status === 'failed' ? '号码不支持短信接收' : null,
        deliveredAt: s.status === 'delivered' ? hoursAgo( Math.floor( Math.random() * 24 ) ) : null,
        sentAt: [ 'sent', 'delivered' ].includes( s.status ) ? hoursAgo( Math.floor( Math.random() * 24 ) + 1 ) : null,
        readAt: s.dir === 'inbound' ? hoursAgo( Math.floor( Math.random() * 12 ) ) : null,
      } );
    }

    // ── Agent Stats ──────────────────────────────────────────────
    console.log( '  📊 Creating agent stats...' );
    const today = new Date();
    today.setHours( 0, 0, 0, 0 );
    for ( const agent of agents ) {
      const totalCalls = Math.floor( Math.random() * 40 + 10 );
      const answered = Math.floor( totalCalls * ( 0.6 + Math.random() * 0.3 ) );
      const missed = totalCalls - answered;
      const avgTalk = Math.floor( Math.random() * 180 + 60 );
      const totalTalk = answered * avgTalk;
      const conversion = parseFloat( ( Math.random() * 0.3 + 0.1 ).toFixed( 2 ) );
      const quality = parseFloat( ( Math.random() * 2 + 3 ).toFixed( 1 ) );
      await AgentStats.create( {
        agentId: agent.id,
        date: today,
        totalCalls,
        answeredCalls: answered,
        missedCalls: missed,
        avgTalkTime: avgTalk,
        totalTalkTime: totalTalk,
        conversionRate: conversion,
        quality,
        notes: '',
      } );
    }

    console.log( '\n✅ Comprehensive database seeding completed!' );
    console.log('');
    console.log( '📝 Login Credentials:' );
    console.log( '   admin / admin123' );
    console.log( '   agent_zhang / agent123  (+ agent_li, agent_wang, agent_zhao, agent_chen, agent_liu)' );
    console.log( '   operator1 / agent123' );
    console.log('');
    console.log( '📞 Extensions: 1001–1008' );
    console.log( '📡 SIP Trunks: Provider-1 (主线), Provider-2 (备线)' );
    console.log( '👥 Customers: 20 records' );
    console.log( '📋 Call Records: 30 records' );
    console.log( '💬 SMS Messages: 10 records' );
    console.log( '🤖 AI Flows: 2 (保险介绍, 满意度调研)' );
    console.log( '📞 Call Queues: 3 (销售/客服/AI外呼)' );
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

seed();
