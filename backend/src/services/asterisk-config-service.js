/**
 * AsteriskConfigService
 *
 * 负责将数据库中的配置（分机、SIP中继、入站/出站路由、IVR、队列）
 * 转换为 Asterisk 配置文件并写入磁盘，然后通过 AMI 热重载生效。
 *
 * 文件写入位置由环境变量 ASTERISK_CONF_PATH 控制，默认 /etc/asterisk
 * 写入的文件名：
 *   telro-sip.conf         → #include 到 sip.conf
 *   telro-extensions.conf  → #include 到 extensions.conf
 *   telro-queues.conf      → #include 到 queues.conf
 *
 * 首次使用时调用 setupIncludes() 自动在主配置文件中添加 #include 语句。
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import Extension from '../db/models/extension.js';
import SIPTrunk from '../db/models/sip-trunk.js';
import InboundRoute from '../db/models/inbound-route.js';
import OutboundRoute from '../db/models/outbound-route.js';
import IVR from '../db/models/ivr.js';
import CallQueue from '../db/models/call-queue.js';
import RingGroup from '../db/models/ring-group.js';
import AiFlow from '../db/models/ai-flow.js';
import AudioFile from '../db/models/audio-file.js';
import ConferenceRoom from '../db/models/conference-room.js';
import amiClient from '../asterisk/ami-client.js';
import logger from '../utils/logger.js';

const CONF_PATH = process.env.ASTERISK_CONF_PATH || '/etc/asterisk';

class AsteriskConfigService {
  // ================================================================
  //  GENERATE: sip.conf (chan_sip)
  // ================================================================
  async generateSipConf() {
    const [extensions, trunks] = await Promise.all([
      Extension.findAll({ where: { enabled: true }, order: [['number', 'ASC']] }),
      SIPTrunk.findAll({ where: { enabled: true }, order: [['priority', 'ASC'], ['name', 'ASC']] }),
    ]);

    const lines = this._header('sip.conf');
    lines.push(
      '[general]',
      'context=from-internal',
      'allowoverlap=no',
      'udpbindaddr=0.0.0.0',
      'srvlookup=yes',
      'nat=force_rport,comedia',
      'qualify=yes',
      'qualifyfreq=60',
      'dtmfmode=rfc2833',
      'disallow=all',
      'allow=ulaw,alaw,g729',
      'alwaysauthreject=yes',
      'registertimeout=20',
      'registerattempts=0',
      '',
    );

    // ---- Internal Extensions ----
    lines.push(
      '; ================================================================',
      '; 内部分机 (Extensions)',
      '; ================================================================',
      '',
    );
    for (const ext of extensions) {
      lines.push(
        `[${ext.number}]`,
        'type=friend',
        `host=${ext.host || 'dynamic'}`,
        `secret=${ext.secret}`,
        `callerid=${ext.callerid || `"${ext.name}" <${ext.number}>`}`,
        `context=${ext.context || 'from-internal'}`,
        `mailbox=${ext.number}@default`,
        'allow=ulaw,alaw,g729',
        `maxcalls=${ext.maxCalls || 5}`,
        'dtmfmode=rfc2833',
        'pickupgroup=1',
        'callgroup=1',
        '',
      );
    }

    // ---- SIP Trunks ----
    const registrations = [];
    lines.push(
      '; ================================================================',
      '; SIP 中继 (Trunks)',
      '; ================================================================',
      '',
    );
    for (const trunk of trunks) {
      lines.push(
        `[${trunk.name}]`,
        'type=peer',
        `host=${trunk.host}`,
        `port=${trunk.port || 5060}`,
      );
      if (trunk.username) lines.push(`username=${trunk.username}`);
      if (trunk.secret)   lines.push(`secret=${trunk.secret}`);
      const fromUser = trunk.fromuser || trunk.username;
      if (fromUser) lines.push(`fromuser=${fromUser}`);
      if (trunk.fromdomain) lines.push(`fromdomain=${trunk.fromdomain}`);
      if (trunk.authid)   lines.push(`authuser=${trunk.authid}`);
      lines.push(
        `insecure=${trunk.insecure || 'invite,port'}`,
        `context=${trunk.context || 'from-trunk'}`,
        'qualify=yes',
        'nat=no',
        'canreinvite=no',
        'allow=ulaw,alaw,g729',
        '',
      );

      // Registration line
      if (trunk.username && trunk.secret) {
        const regHost = trunk.fromdomain || trunk.host;
        const port = trunk.port && trunk.port !== 5060 ? `:${trunk.port}` : '';
        registrations.push(`register => ${trunk.username}:${trunk.secret}@${regHost}${port}/${trunk.username}`);
      }
    }

    // ---- Registrations ----
    if (registrations.length > 0) {
      lines.push(
        '; ================================================================',
        '; SIP 中继注册',
        '; ================================================================',
        '',
        ...registrations,
        '',
      );
    }

    return lines.join('\n');
  }

  // ================================================================
  //  GENERATE: extensions.conf (dialplan)
  // ================================================================
  async generateExtensionsConf() {
    const [extensions, outboundRoutes, inboundRoutes, ivrs, ringGroups, aiFlows, conferences] = await Promise.all([
      Extension.findAll({ where: { enabled: true }, order: [['number', 'ASC']] }),
      OutboundRoute.findAll({
        where: { enabled: true },
        include: [{ model: SIPTrunk, as: 'sipTrunk' }],
        order: [['priority', 'ASC']],
      }),
      InboundRoute.findAll({ where: { enabled: true }, order: [['priority', 'ASC']] }),
      IVR.findAll({ where: { enabled: true } }),
      RingGroup.findAll({ where: { enabled: true }, order: [['number', 'ASC']] }).catch(() => []),
      AiFlow.findAll({ where: { enabled: true } }).catch(() => []),
      ConferenceRoom.findAll({ where: { enabled: true } }).catch(() => []),
    ]);

    const extNumbers = extensions.map(e => e.number);
    const extPattern = this._extPattern(extNumbers);

    const lines = this._header('extensions.conf');

    // ---- [globals] ----
    lines.push('[globals]', 'ATTENDED_TRANSFER_COMPLETE_SOUND=beep', '');

    // ================================================================
    // [from-internal] — 内部拨号 + 出站路由
    // ================================================================
    lines.push(
      '; ================================================================',
      '; 内部上下文 [from-internal]',
      '; ================================================================',
      '[from-internal]',
      '',
      '; 内部分机直拨',
    );

    if (extNumbers.length > 0) {
      lines.push(
        `exten => _${extPattern},1,NoOp(内部拨号: \${EXTEN})`,
        `exten => _${extPattern},n,MixMonitor(/var/spool/asterisk/monitor/int-\${UNIQUEID}.wav,b)`,
        `exten => _${extPattern},n,Dial(SIP/\${EXTEN},20,tTg)`,
        `exten => _${extPattern},n,StopMixMonitor()`,
        `exten => _${extPattern},n,VoiceMail(\${EXTEN}@default,u)`,
        `exten => _${extPattern},n,Hangup()`,
        '',
      );
    }

    // 出站路由
    lines.push('; --- 出站路由 (Outbound Routes) ---', '');

    // Ring group direct dial (within from-internal)
    if (ringGroups.length > 0) {
      lines.push('; --- 振铃组直拨 ---');
      for (const rg of ringGroups) {
        lines.push(
          `exten => ${rg.number},1,NoOp(振铃组: ${rg.name})`,
          `exten => ${rg.number},n,Goto(ring-group-${rg.id},s,1)`,
          '',
        );
      }
    }

    // Conference room direct dial
    if (conferences.length > 0) {
      lines.push('; --- 会议室直拨 ---');
      for (const room of conferences) {
        lines.push(
          `exten => ${room.number},1,NoOp(会议室: ${room.name})`,
          `exten => ${room.number},n,Goto(conf-${room.number},s,1)`,
          '',
        );
      }
    }

    // Feature codes
    lines.push(
      '; --- 功能码 (Feature Codes) ---',
      'exten => *97,1,VoiceMailMain(@default)',
      'exten => *97,n,Hangup()',
      'exten => *98,1,VoiceMailMain(${CALLERID(num)}@default)',
      'exten => *98,n,Hangup()',
      '',
    );


    for (const route of outboundRoutes) {
      const trunk = route.sipTrunk;
      if (!trunk) {
        lines.push(`; [跳过] 路由 "${route.name}" 未绑定中继`, '');
        continue;
      }

      lines.push(`; 路由: ${route.name} (优先级: ${route.priority}, 中继: ${trunk.name})`);

      for (const rawPattern of (route.dialPatterns || [])) {
        const pattern = this._toAstPattern(rawPattern);

        // 计算最终拨出号码
        let dialExten = '${EXTEN}';
        if (route.stripDigits > 0) dialExten = `\${EXTEN:${route.stripDigits}}`;
        if (route.prepend)         dialExten = `${route.prepend}${dialExten}`;

        lines.push(
          `exten => ${pattern},1,NoOp(出站路由: ${route.name} → ${trunk.name})`,
        );
        if (route.callerIdOverride) {
          lines.push(`exten => ${pattern},n,Set(CALLERID(num)=${route.callerIdOverride})`);
        }
        lines.push(
          `exten => ${pattern},n,Dial(SIP/${dialExten}@${trunk.name},30,gT)`,
          `exten => ${pattern},n,Congestion()`,
          `exten => ${pattern},n,Hangup()`,
          '',
        );
      }
    }

    // ================================================================
    // [from-trunk] — 入站路由
    // ================================================================
    lines.push(
      '; ================================================================',
      '; 入站上下文 [from-trunk]',
      '; ================================================================',
      '[from-trunk]',
      '',
      '; --- 入站路由 (Inbound Routes) ---',
      '',
    );

    let defaultRoute = null;

    for (const route of inboundRoutes) {
      const gotoTarget = await this._buildGoto(route.destinationType, route.destinationId);
      if (!gotoTarget) continue;

      const isDefault = !route.did || route.did === '' || route.did === '_any_';
      if (isDefault) {
        defaultRoute = { route, gotoTarget };
        continue;
      }

      lines.push(`; 入站路由: ${route.name} (DID: ${route.did})`);
      lines.push(`exten => ${route.did},1,NoOp(入站: ${route.name})`);
      if (route.callerIdName) {
        lines.push(`exten => ${route.did},n,Set(CALLERID(name)=${route.callerIdName})`);
      }
      lines.push(
        `exten => ${route.did},n,${gotoTarget}`,
        `exten => ${route.did},n,Hangup()`,
        '',
      );
    }

    // 默认入站处理
    lines.push('; 默认入站处理');
    if (defaultRoute) {
      lines.push(
        `exten => s,1,NoOp(默认入站: ${defaultRoute.route.name})`,
        `exten => s,n,${defaultRoute.gotoTarget}`,
        `exten => _.,1,NoOp(通配入站: ${defaultRoute.route.name})`,
        `exten => _.,n,${defaultRoute.gotoTarget}`,
      );
    } else {
      lines.push(
        'exten => s,1,Answer()',
        'exten => s,n,Playback(tt-weasels)',
        'exten => s,n,Hangup()',
        'exten => _.,1,Goto(s,1)',
      );
    }
    lines.push('');

    // ================================================================
    // IVR 上下文
    // ================================================================
    if (ivrs.length > 0) {
      lines.push(
        '; ================================================================',
        '; IVR 上下文',
        '; ================================================================',
        '',
      );

      for (const ivr of ivrs) {
        const ctx = `ivr-${ivr.id}`;
        lines.push(`; IVR: ${ivr.name}`, `[${ctx}]`, '');

        lines.push(
          `exten => s,1,NoOp(IVR: ${ivr.name})`,
          'exten => s,n,Answer()',
        );
        if (ivr.greeting) {
          lines.push(`exten => s,n,Playback(${ivr.greeting})`);
        }
        lines.push(`exten => s,n,WaitExten(${ivr.timeout || 10})`, '');

        // 按键选项
        for (const opt of (ivr.options || [])) {
          const target = await this._buildGoto(opt.destinationType, opt.destinationId);
          lines.push(`; [${opt.digit}] ${opt.label || ''}`);
          lines.push(`exten => ${opt.digit},1,NoOp(IVR ${ivr.name} 按键 ${opt.digit})`);
          if (target) lines.push(`exten => ${opt.digit},n,${target}`);
          lines.push(`exten => ${opt.digit},n,Hangup()`, '');
        }

        // 直拨分机
        if (ivr.directDial && extNumbers.length > 0) {
          lines.push(
            '; 直拨分机',
            `exten => _${extPattern},1,Goto(from-internal,\${EXTEN},1)`,
            '',
          );
        }

        // 超时 / 无效处理
        const timeoutTarget = (ivr.timeoutDestinationType && ivr.timeoutDestinationType !== 'hangup')
          ? await this._buildGoto(ivr.timeoutDestinationType, ivr.timeoutDestinationId)
          : null;

        lines.push(
          '; 超时',
          `exten => t,1,NoOp(IVR ${ivr.name} 超时)`,
          timeoutTarget ? `exten => t,n,${timeoutTarget}` : 'exten => t,n,Hangup()',
          '',
          '; 无效输入',
          `exten => i,1,NoOp(IVR ${ivr.name} 无效输入)`,
          'exten => i,n,Playback(invalid)',
          'exten => i,n,Goto(s,1)',
          '',
        );
      }
    }

    // ================================================================
    // Ring Groups 振铃组
    // ================================================================
    if (ringGroups.length > 0) {
      lines.push(
        '; ================================================================',
        '; 振铃组 (Ring Groups)',
        '; ================================================================',
        '',
      );
      for (const rg of ringGroups) {
        const ctx = `ring-group-${rg.id}`;
        lines.push(`; Ring Group: ${rg.name} (${rg.number})`, `[${ctx}]`, '');
        lines.push(
          'exten => s,1,NoOp(Ring Group: ' + rg.name + ')',
          'exten => s,n,Answer()',
        );
        const members = (rg.members || []);
        if (members.length > 0) {
          const dialStr = members.map(m => (m.includes('/') ? m : `SIP/${m}`)).join('&');
          lines.push(
            `exten => s,n,Dial(${dialStr},${rg.ringTime || 20},tTgI)`,
          );
          // Failover
          const failover = await this._buildGoto(rg.failoverType, rg.failoverId).catch(() => 'Hangup()');
          lines.push(`exten => s,n,${failover}`);
        } else {
          lines.push('exten => s,n,Hangup()');
        }
        lines.push('');
        // Register the group's extension number in from-internal
        lines.push(`; Ring group reachable at ${rg.number} from from-internal`);
      }

      // Add ring group numbers to from-internal (we patch it after the main context)
      lines.push('');
    }

    // ================================================================
    // Campaign hold/transfer contexts (for predictive dialer)
    // ================================================================
    lines.push(
      '; ================================================================',
      '; Campaign 群呼专用上下文',
      '; ================================================================',
      '',
      '[campaign-hold]',
      '; 接通后播放等待音乐，等待操作员决定路由（全程录音）',
      'exten => s,1,NoOp(Campaign call answered - holding)',
      'exten => s,n,Answer()',
      'exten => s,n,Wait(0.5)',
      'exten => s,n,MixMonitor(/var/spool/asterisk/monitor/campaign-${UNIQUEID}.wav,b)',
      'exten => s,n,MusicOnHold(default)',
      'exten => s,n,Hangup()',
      '',
      '[campaign-queue-hold]',
      '; 客户等待话务员接听（人工排队，播放等待音乐）',
      'exten => s,1,NoOp(Campaign queue hold - waiting for agent)',
      'exten => s,n,Answer()',
      'exten => s,n,Wait(0.5)',
      '; 录音继续（通道已在 campaign-hold 中开始 MixMonitor，不需要重启）',
      'exten => s,n,MusicOnHold(default)',
      'exten => s,n,Hangup()',
      '',
      '[campaign-transfer]',
      '; 转接到话务员分机（录音已由 campaign-hold 中启动，这里继续）',
      'exten => _.,1,NoOp(Campaign transfer to agent: ${EXTEN})',
      'exten => _.,n,Dial(SIP/${EXTEN},60,tTgI)',
      'exten => _.,n,Hangup()',
      '',
    );

    // ================================================================
    // DTMF 按键接转上下文 — 每个启用了 dtmfConnectKey 的活动生成一对专属上下文
    // ================================================================
    const dtmfQueues = await CallQueue.findAll({
      where: { enabled: true },
    }).then(qs => qs.filter(q => q.dtmfConnectKey));

    if (dtmfQueues.length > 0) {
      lines.push(
        '; ================================================================',
        '; DTMF 按键接转上下文（每个活动专属）',
        '; ================================================================',
        '',
      );

      for (const q of dtmfQueues) {
        const qid = q.id;
        const key = q.dtmfConnectKey;
        const timeout = q.dtmfTimeout || 10;
        const maxRetries = q.dtmfMaxRetries || 3;

        // Resolve audio file path
        let audioPath = 'silence/1';
        if (q.dtmfAudioFileId) {
          try {
            const af = await AudioFile.findByPk(q.dtmfAudioFileId);
            if (af?.asteriskPath) audioPath = af.asteriskPath;
          } catch {}
        }

        // Resolve transfer destination dialplan instruction
        let destination = 'Hangup()';
        try {
          if (q.dtmfConnectType === 'extension') {
            const ext = await Extension.findByPk(q.dtmfConnectId);
            if (ext) destination = `Goto(from-internal,${ext.number},1)`;
          } else if (q.dtmfConnectType === 'ivr') {
            const ivr = await IVR.findByPk(q.dtmfConnectId);
            if (ivr) destination = `Goto(ivr-${ivr.id},s,1)`;
          } else if (q.dtmfConnectType === 'queue') {
            const cq = await CallQueue.findByPk(q.dtmfConnectId);
            if (cq) destination = `Queue(${cq.name})`;
          }
        } catch {}

        // Context 1: initial answer + recording setup
        lines.push(
          `; ── DTMF 活动: ${q.name}  按键=${key}  目标=${q.dtmfConnectType}`,
          `[campaign-dtmf-${qid}]`,
          `exten => s,1,NoOp(DTMF Campaign: ${q.name})`,
          'exten => s,n,Answer()',
          'exten => s,n,Wait(0.5)',
          'exten => s,n,MixMonitor(/var/spool/asterisk/monitor/campaign-${UNIQUEID}.wav,b)',
          'exten => s,n,Set(DTMF_TRIES=0)',
          `exten => s,n,Goto(campaign-dtmf-play-${qid},s,1)`,
          '',
        );

        // Context 2: play loop — increments counter, plays audio, waits for key
        lines.push(
          `[campaign-dtmf-play-${qid}]`,
          `exten => s,1,Set(DTMF_TRIES=$[\${DTMF_TRIES}+1])`,
          `exten => s,n,GotoIf($[\${DTMF_TRIES}>${maxRetries}]?campaign-dtmf-end-${qid},s,1)`,
          `exten => s,n,Background(${audioPath})`,
          `exten => s,n,WaitExten(${timeout})`,
          // timeout → replay
          `exten => t,1,Goto(campaign-dtmf-play-${qid},s,1)`,
          // invalid key → replay
          `exten => i,1,Goto(campaign-dtmf-play-${qid},s,1)`,
          // matching key → connect
          `exten => ${key},1,NoOp(Customer pressed ${key} — connecting)`,
          `exten => ${key},n,StopMixMonitor()`,
          `exten => ${key},n,${destination}`,
          `exten => ${key},n,Hangup()`,
          '',
        );

        // Context 3: max retries exceeded — hangup
        lines.push(
          `[campaign-dtmf-end-${qid}]`,
          `exten => s,1,NoOp(DTMF max retries reached for campaign: ${q.name})`,
          'exten => s,n,StopMixMonitor()',
          'exten => s,n,Hangup()',
          '',
        );
      }
    }

    // ================================================================
    // Conference Rooms
    // ================================================================
    if (conferences.length > 0) {
      lines.push(
        '; ================================================================',
        '; \u4f1a\u8bae\u5ba4 (Conference Rooms)',
        '; ================================================================',
        '',
      );
      // Add conference room extensions to from-internal
      for (const room of conferences) {
        const pin = room.pinRequired && room.pin ? `${room.pin}` : '';
        const adminPin = room.adminPin ? `${room.adminPin}` : pin;
        const bridgeProfile = `room-${room.number}`;
        lines.push(`; Conference Room: ${room.name} (${room.number})`);
        // We use ConfBridge app
        lines.push(
          `[conf-${room.number}]`,
          `exten => s,1,NoOp(Conference Room ${room.number})`,
          `exten => s,n,ConfBridge(${room.number},${bridgeProfile},default_user${room.adminPin ? `,admin_user` : ''})`,
          `exten => s,n,Hangup()`,
          '',
        );
      }
    }

    // ================================================================
    // AI Flow contexts
    // ================================================================
    if (aiFlows.length > 0) {
      lines.push(
        '; ================================================================',
        '; AI \u6d41\u7a0b (AI Flows)',
        '; ================================================================',
        '',
      );
      for (const flow of aiFlows) {
        const steps = flow.steps || [];
        const stepMap = {};
        steps.forEach(s => { stepMap[s.id] = s; });

        const ctx = `ai-flow-${flow.id}`;
        lines.push(`; AI Flow: ${flow.name}`, `[${ctx}]`, '');
        lines.push(`exten => s,1,NoOp(AI Flow: ${flow.name})`);
        lines.push(`exten => s,n,Answer()`);
        lines.push(`exten => s,n,Wait(0.5)`);
        lines.push(`exten => s,n,MixMonitor(/var/spool/asterisk/monitor/aiflow-\${UNIQUEID}.wav,b)`);

        // Simple linear walkthrough of steps
        let prio = 4;
        let stepId = flow.firstStepId || steps[0]?.id;
        const visited = new Set();
        while (stepId && !visited.has(stepId)) {
          visited.add(stepId);
          const step = stepMap[stepId];
          if (!step) break;
          switch (step.type) {
            case 'play': {
              let audioPath = 'beep';
              if (step.audioFileId) {
                try {
                  const af = await AudioFile.findByPk(step.audioFileId);
                  if (af?.asteriskPath) audioPath = af.asteriskPath;
                } catch {}
              }
              lines.push(`exten => s,${prio},Playback(${audioPath})`);
              prio++;
              break;
            }
            case 'gather': {
              let promptPath = 'beep';
              if (step.audioFileId) {
                try {
                  const af = await AudioFile.findByPk(step.audioFileId);
                  if (af?.asteriskPath) promptPath = af.asteriskPath;
                } catch {}
              }
              lines.push(`exten => s,${prio},Background(${promptPath})`);
              prio++;
              lines.push(`exten => s,${prio},WaitExten(${step.timeout || 5})`);
              prio++;
              for (const branch of (step.branches || [])) {
                lines.push(`exten => ${branch.digit},1,Goto(s,${prio})`);
              }
              lines.push(`exten => i,1,Playback(invalid)`, `exten => i,n,Goto(s,1)`);
              lines.push(`exten => t,1,Hangup()`);
              break;
            }
            case 'transfer': {
              if (step.destinationType === 'extension') {
                lines.push(`exten => s,${prio},Dial(SIP/${step.destinationId},30,tT)`);
              } else if (step.destinationType === 'queue') {
                lines.push(`exten => s,${prio},Queue(${step.destinationId})`);
              }
              prio++;
              lines.push(`exten => s,${prio},Hangup()`);
              prio++;
              stepId = null; break;
            }
            case 'hangup':
            default:
              lines.push(`exten => s,${prio},Hangup()`);
              prio++;
              stepId = null; break;
          }
          stepId = step.nextStepId || null;
        }
        if (!lines[lines.length - 1]?.includes('Hangup')) {
          lines.push(`exten => s,${prio},Hangup()`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  // ================================================================
  //  GENERATE: queues.conf
  // ================================================================
  async generateQueuesConf() {
    const queues = await CallQueue.findAll({
      where: { enabled: true },
      include: [{ model: Extension, as: 'extension' }],
      order: [['name', 'ASC']],
    });

    const lines = this._header('queues.conf');
    lines.push(
      '[general]',
      'persistentmembers=yes',
      'autofill=yes',
      'monitor-type=MixMonitor',
      '',
    );

    for (const q of queues) {
      lines.push(
        `[${q.name}]`,
        `strategy=${q.strategy || 'ringall'}`,
        `timeout=${q.maxWaitTime || 300}`,
        `retry=${q.retryInterval || 5}`,
        `wrapuptime=${q.wrapupTime || 0}`,
        `joinempty=${q.joinempty !== false ? 'yes' : 'no'}`,
        `leavewhenempty=${q.leavewhenempty !== false ? 'yes' : 'no'}`,
        `autofill=${q.autofill !== false ? 'yes' : 'no'}`,
        'ringinuse=no',
      );
      // 关联分机作为队列成员
      if (q.extension) {
        lines.push(`member=SIP/${q.extension.number},0,${q.extension.name || q.extension.number}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  // ================================================================
  //  WRITE CONFIG FILES TO DISK
  // ================================================================
  async writeConfig(filename, content) {
    const filePath = path.join(CONF_PATH, filename);
    try {
      await fs.writeFile(filePath, content, 'utf8');
      logger.info(`📝 已写入配置文件: ${filePath}`);
    } catch (err) {
      if (err.code === 'ENOENT' || err.code === 'EACCES') {
        logger.error(`❌ 无法写入 ${filePath}: ${err.message}`);
        logger.error('   请确认 ASTERISK_CONF_PATH 设置正确，且进程有写入权限');
        throw new Error(`配置文件写入失败 (${filePath}): ${err.message}`);
      }
      throw err;
    }
  }

  // ================================================================
  //  SETUP: 在主配置文件中添加 #include
  // ================================================================
  async setupIncludes() {
    const includes = [
      { main: 'sip.conf',           telro: 'telro-sip.conf' },
      { main: 'extensions.conf',    telro: 'telro-extensions.conf' },
      { main: 'queues.conf',        telro: 'telro-queues.conf' },
      { main: 'voicemail.conf',     telro: 'telro-voicemail.conf' },
      { main: 'confbridge.conf',    telro: 'telro-confbridge.conf' },
    ];

    for (const { main, telro } of includes) {
      const mainPath  = path.join(CONF_PATH, main);
      const directive = `#include "${telro}"`;

      try {
        let content = '';
        try { content = await fs.readFile(mainPath, 'utf8'); } catch { /* 文件不存在，稍后创建 */ }

        if (!content.includes(directive)) {
          await fs.appendFile(mainPath, `\n${directive}\n`);
          logger.info(`✅ 已在 ${main} 中添加: ${directive}`);
        }
      } catch (err) {
        logger.warn(`⚠️  无法更新 ${main}: ${err.message}`);
      }
    }
  }

  // ================================================================
  //  AMI RELOAD
  // ================================================================
  async reloadModule(module) {
    try {
      if (!amiClient.isConnected) {
        logger.warn(`⚠️  AMI 未连接，跳过重载: ${module}`);
        return { module, success: false, reason: 'AMI not connected' };
      }
      await amiClient.action({ Action: 'Command', Command: `module reload ${module}` });
      logger.info(`🔄 已重载: ${module}`);
      return { module, success: true };
    } catch (err) {
      logger.warn(`⚠️  重载 ${module} 失败: ${err.message}`);
      return { module, success: false, reason: err.message };
    }
  }

  // ================================================================
  //  GENERATE: voicemail.conf
  // ================================================================
  async generateVoicemailConf() {
    let boxes = [];
    try {
      const VoicemailBox = (await import('../db/models/voicemail-box.js')).default;
      const Ext = (await import('../db/models/extension.js')).default;
      boxes = await VoicemailBox.findAll({
        where: { enabled: true },
        include: [{ model: Ext, as: 'extension' }],
      });
    } catch (e) {
      logger.warn('generateVoicemailConf: 无法加载语音信箱数据 -', e.message);
    }

    const lines = this._header('voicemail.conf');
    lines.push(
      '[general]',
      'format=wav49|gsm|wav',
      'serveremail=asterisk@localhost',
      'attach=yes',
      'skipms=3000',
      'maxsilence=10',
      'silencethreshold=128',
      'maxlogins=3',
      'emaildateformat=%A, %B %d, %Y at %r',
      'pagerfromstring=The Voicemail System',
      'fromstring=The Voicemail System',
      'charset=UTF-8',
      '',
      '[zonemessages]',
      'eastern=America/New_York|\'vm-received\' Q \'digits/at\' IMp',
      'central=America/Chicago|\'vm-received\' Q \'digits/at\' IMp',
      'pacific=America/Los_Angeles|\'vm-received\' Q \'digits/at\' IMp',
      'shanghai=Asia/Shanghai|\'vm-received\' Q \'digits/at\' HM',
      '',
      '[default]',
      '; 格式: mailbox => password,fullname,email,pager_email,options',
    );

    for (const box of boxes) {
      const ext = box.extension;
      const mailboxNum = ext ? ext.number : box.mailbox?.split('@')[0] || 'unknown';
      const name = ext ? (ext.name || mailboxNum) : mailboxNum;
      const email = box.email || '';
      const opts = [];
      if (box.emailAttach) opts.push('attach=yes');
      if (box.deleteAfterEmail) opts.push('delete=yes');
      if (box.timezone) opts.push(`tz=${box.timezone}`);
      lines.push(`${mailboxNum} => ${box.password || '1234'},${name},${email},,${opts.join('|')}`);
    }
    lines.push('');
    return lines.join('\n');
  }

  // ================================================================
  //  GENERATE: confbridge.conf
  // ================================================================
  async generateConfbridgeConf() {
    let rooms = [];
    try {
      const ConferenceRoom = (await import('../db/models/conference-room.js')).default;
      rooms = await ConferenceRoom.findAll({ where: { enabled: true } });
    } catch (e) {
      logger.warn('generateConfbridgeConf: 无法加载会议室数据 -', e.message);
    }

    const lines = this._header('confbridge.conf');
    lines.push(
      '[general]',
      '',
      '; Default bridge profile',
      '[default_bridge]',
      'type=bridge',
      'max_members=50',
      'record_conference=no',
      'record_file_timestamp=yes',
      'internal_sample_rate=auto',
      'mixing_interval=20',
      '',
      '; Default user profile',
      '[default_user]',
      'type=user',
      'announce_join_leave=no',
      'announce_user_count=no',
      'music_on_hold_when_empty=yes',
      'music_on_hold_class=default',
      'quiet=no',
      '',
      '; Admin user profile',
      '[admin_user]',
      'type=user',
      'admin=yes',
      'marked=yes',
      'announce_join_leave=yes',
      'announce_user_count=yes',
      '',
    );

    for (const room of rooms) {
      const bridgeName = `room-${room.number}`;
      lines.push(
        `; 会议室: ${room.name} (${room.number})`,
        `[${bridgeName}]`,
        'type=bridge',
        `max_members=${room.maxMembers || 50}`,
        `record_conference=${room.recordEnabled ? 'yes' : 'no'}`,
        room.recordEnabled ? `record_file=/var/spool/asterisk/monitor/conf-${room.number}-%Y%m%d-%H%M%S.wav` : '; recording disabled',
        'internal_sample_rate=auto',
        'mixing_interval=20',
        '',
      );
    }

    return lines.join('\n');
  }

  // ================================================================
  //  FULL SYNC (main entry point)
  // ================================================================
  async syncAll() {
    logger.info('⚙️  开始同步 Asterisk 配置...');

    // 1. 生成配置
    const [sipConf, extConf, queuesConf, vmConf, cbConf] = await Promise.all([
      this.generateSipConf(),
      this.generateExtensionsConf(),
      this.generateQueuesConf(),
      this.generateVoicemailConf(),
      this.generateConfbridgeConf(),
    ]);

    // 2. 写入文件
    await Promise.all([
      this.writeConfig('telro-sip.conf', sipConf),
      this.writeConfig('telro-extensions.conf', extConf),
      this.writeConfig('telro-queues.conf', queuesConf),
      this.writeConfig('telro-voicemail.conf', vmConf),
      this.writeConfig('telro-confbridge.conf', cbConf),
    ]);

    // 3. 确保 #include 已添加到主配置文件
    await this.setupIncludes();

    // 4. AMI 热重载
    const reloadResults = await Promise.all([
      this.reloadModule('chan_sip.so'),
      this.reloadModule('pbx_config.so'),
      this.reloadModule('app_queue.so'),
      this.reloadModule('app_voicemail.so'),
      this.reloadModule('app_confbridge.so'),
    ]);

    const timestamp = new Date().toISOString();
    logger.info(`✅ Asterisk 配置同步完成: ${timestamp}`);

    return { success: true, timestamp, reloadResults };
  }

  // ================================================================
  //  PREVIEW (without writing files)
  // ================================================================
  async previewAll() {
    const [sipConf, extConf, queuesConf, vmConf, cbConf] = await Promise.all([
      this.generateSipConf(),
      this.generateExtensionsConf(),
      this.generateQueuesConf(),
      this.generateVoicemailConf(),
      this.generateConfbridgeConf(),
    ]);
    return { sipConf, extConf, queuesConf, vmConf, cbConf };
  }

  // ================================================================
  //  PRIVATE HELPERS
  // ================================================================

  /** 将数据库 dialPattern 转为 Asterisk exten 匹配格式 */
  _toAstPattern(pattern) {
    // 已经是 _前缀的 FreePBX 格式，直接用
    if (pattern.startsWith('_')) return pattern;
    // 含通配符字符，加 _ 前缀
    if (/[XNZ.]/.test(pattern)) return `_${pattern}`;
    // 纯数字精确匹配
    return pattern;
  }

  /** 根据分机号列表生成通配模式（如 1XXX, 2XXX 等） */
  _extPattern(numbers) {
    if (numbers.length === 0) return 'XXXX';
    // 找最短公共长度
    const lengths = [...new Set(numbers.map(n => n.length))];
    if (lengths.length === 1) return 'X'.repeat(lengths[0]);
    const minLen = Math.min(...lengths);
    return 'X'.repeat(minLen) + '.';
  }

  /** 构建 Goto/Dial/Queue 跳转目标 */
  async _buildGoto(type, id) {
    if (!type || type === 'hangup') return 'Hangup()';
    try {
      switch (type) {
        case 'extension': {
          if (!id) return 'Hangup()';
          const ext = await Extension.findByPk(id);
          return ext ? `Goto(from-internal,${ext.number},1)` : 'Hangup()';
        }
        case 'ivr': {
          if (!id) return 'Hangup()';
          const ivr = await IVR.findByPk(id);
          return ivr ? `Goto(ivr-${ivr.id},s,1)` : 'Hangup()';
        }
        case 'queue': {
          if (!id) return 'Hangup()';
          const q = await CallQueue.findByPk(id);
          return q ? `Queue(${q.name})` : 'Hangup()';
        }
        case 'voicemail':
          return `VoiceMail(${id}@default,u)`;
        default:
          return 'Hangup()';
      }
    } catch {
      return 'Hangup()';
    }
  }

  /** 生成配置文件头部注释 */
  _header(filename) {
    return [
      '; ================================================================',
      `; AUTO-GENERATED BY TELRO — DO NOT EDIT MANUALLY`,
      `; File: ${filename}`,
      `; Generated: ${new Date().toISOString()}`,
      '; ================================================================',
      '; 由 Telro 自动生成，请勿手动修改。',
      '; 通过 Telro 管理界面配置后将自动更新此文件。',
      '; ================================================================',
      '',
    ];
  }
}

export default new AsteriskConfigService();
