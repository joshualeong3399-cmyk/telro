import sequelize from '../config/database.js';
import Extension from './models/extension.js';
import SIPTrunk from './models/sip-trunk.js';
import CallRecord from './models/call-record.js';
import Recording from './models/recording.js';
import Billing from './models/billing.js';
import User from './models/user.js';
import CallQueue from './models/call-queue.js';
import QueueTask from './models/queue-task.js';
import Agent from './models/agent.js';
import Customer from './models/customer.js';
import AgentStats from './models/agent-stats.js';
import InboundRoute from './models/inbound-route.js';
import OutboundRoute from './models/outbound-route.js';
import IVR from './models/ivr.js';
import TimeCondition from './models/time-condition.js';
import DNC from './models/dnc.js';
import Disposition from './models/disposition.js';
import RingGroup from './models/ring-group.js';
import VoicemailBox from './models/voicemail-box.js';
import ConferenceRoom from './models/conference-room.js';
import AiFlow from './models/ai-flow.js';
import AudioFile from './models/audio-file.js';
import SmsMessage from './models/sms-message.js';

const models = {
  Extension, SIPTrunk, CallRecord, Recording, Billing, User,
  CallQueue, QueueTask, Agent, Customer, AgentStats,
  InboundRoute, OutboundRoute, IVR, TimeCondition, DNC, Disposition,
  RingGroup, VoicemailBox, ConferenceRoom, AiFlow, AudioFile, SmsMessage,
};

// 定义模型关系
Extension.hasMany(CallRecord, { foreignKey: 'fromExtensionId', as: 'outboundCalls' });
CallRecord.belongsTo(Extension, { foreignKey: 'fromExtensionId', as: 'fromExtension' });

Extension.hasMany(CallRecord, { foreignKey: 'toExtensionId', as: 'inboundCalls' });
CallRecord.belongsTo(Extension, { foreignKey: 'toExtensionId', as: 'toExtension' });

CallRecord.hasOne( Recording, { foreignKey: 'callRecordId', as: 'recordingFile' } );
Recording.belongsTo(CallRecord, { foreignKey: 'callRecordId', as: 'callRecord' });

CallRecord.hasMany(Billing, { foreignKey: 'callRecordId', as: 'billingRecords' });
Billing.belongsTo(CallRecord, { foreignKey: 'callRecordId', as: 'callRecord' });

Extension.hasMany(Billing, { foreignKey: 'extensionId', as: 'billingRecords' });
Billing.belongsTo(Extension, { foreignKey: 'extensionId', as: 'extension' });

User.belongsTo(Extension, { foreignKey: 'extensionId', as: 'extension' });
Extension.hasOne(User, { foreignKey: 'extensionId', as: 'user' });

CallRecord.belongsTo(SIPTrunk, { foreignKey: 'sipTrunkId', as: 'sipTrunk' });
SIPTrunk.hasMany(CallRecord, { foreignKey: 'sipTrunkId', as: 'callRecords' });

CallQueue.belongsTo(Extension, { foreignKey: 'extensionId', as: 'extension' });
Extension.hasMany(CallQueue, { foreignKey: 'extensionId', as: 'queues' });

CallQueue.hasMany(QueueTask, { foreignKey: 'queueId', as: 'tasks' });
QueueTask.belongsTo(CallQueue, { foreignKey: 'queueId', as: 'queue' });

QueueTask.belongsTo(CallRecord, { foreignKey: 'callRecordId', as: 'callRecord' });
CallRecord.hasOne(QueueTask, { foreignKey: 'callRecordId', as: 'queueTask' });

// Agent associations
Agent.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasOne(Agent, { foreignKey: 'userId', as: 'agent' });

Agent.belongsTo(Extension, { foreignKey: 'extensionId', as: 'extension' });
Extension.hasOne(Agent, { foreignKey: 'extensionId', as: 'agent' });

AgentStats.belongsTo(Agent, { foreignKey: 'agentId', as: 'agent' });
Agent.hasMany(AgentStats, { foreignKey: 'agentId', as: 'stats' });

// Customer associations
Customer.belongsTo(Agent, { foreignKey: 'assignedAgentId', as: 'assignedAgent' });
Agent.hasMany(Customer, { foreignKey: 'assignedAgentId', as: 'customers' });

// Routing associations
OutboundRoute.belongsTo(SIPTrunk, { foreignKey: 'sipTrunkId', as: 'sipTrunk' });
SIPTrunk.hasMany(OutboundRoute, { foreignKey: 'sipTrunkId', as: 'outboundRoutes' });

// Voicemail
VoicemailBox.belongsTo(Extension, { foreignKey: 'extensionId', as: 'extension' });
Extension.hasOne(VoicemailBox, { foreignKey: 'extensionId', as: 'voicemailBox' });

// Campaign → SIP Trunk
CallQueue.belongsTo(SIPTrunk, { foreignKey: 'sipTrunkId', as: 'sipTrunk' });
SIPTrunk.hasMany(CallQueue, { foreignKey: 'sipTrunkId', as: 'campaigns' });

// Campaign → AI Flow
CallQueue.belongsTo(AiFlow, { foreignKey: 'aiFlowId', as: 'aiFlow' });
AiFlow.hasMany(CallQueue, { foreignKey: 'aiFlowId', as: 'campaigns' });

// SMS associations
SmsMessage.belongsTo(SIPTrunk, { foreignKey: 'sipTrunkId', as: 'sipTrunk' });
SIPTrunk.hasMany(SmsMessage, { foreignKey: 'sipTrunkId', as: 'smsMessages' });
SmsMessage.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(SmsMessage, { foreignKey: 'userId', as: 'smsMessages' });

export { sequelize };
export default models;
