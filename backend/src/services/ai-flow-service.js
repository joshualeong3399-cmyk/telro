import AiFlow from '../db/models/ai-flow.js';
import AudioFile from '../db/models/audio-file.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';
import asteriskConfigService from './asterisk-config-service.js';

class AiFlowService {
  async createFlow(data) {
    // Auto-assign IDs to steps if missing
    const steps = (data.steps || []).map(s => ({ id: s.id || uuidv4(), ...s }));
    const firstStepId = data.firstStepId || steps[0]?.id || null;
    const flow = await AiFlow.create({ ...data, steps, firstStepId });
    logger.info(`✅ AI Flow created: ${flow.name}`);
    asteriskConfigService.syncAll().catch(e => logger.warn('Asterisk sync failed:', e.message));
    return flow;
  }

  async updateFlow(id, data) {
    const flow = await AiFlow.findByPk(id);
    if (!flow) throw new Error(`AI Flow not found: ${id}`);
    if (data.steps) {
      data.steps = data.steps.map(s => ({ id: s.id || uuidv4(), ...s }));
      if (!data.firstStepId) data.firstStepId = data.steps[0]?.id;
    }
    await flow.update(data);
    asteriskConfigService.syncAll().catch(e => logger.warn('Asterisk sync failed:', e.message));
    return flow;
  }

  async deleteFlow(id) {
    const flow = await AiFlow.findByPk(id);
    if (!flow) throw new Error(`AI Flow not found: ${id}`);
    await flow.destroy();
    asteriskConfigService.syncAll().catch(e => logger.warn('Asterisk sync failed:', e.message));
    return flow;
  }

  async getFlows(limit = 100, offset = 0) {
    return AiFlow.findAndCountAll({ limit, offset, order: [['name', 'ASC']] });
  }

  async getFlowDetail(id) {
    const flow = await AiFlow.findByPk(id);
    if (!flow) throw new Error(`AI Flow not found: ${id}`);
    return flow;
  }

  // Duplicate a flow
  async duplicateFlow(id) {
    const flow = await AiFlow.findByPk(id);
    if (!flow) throw new Error(`AI Flow not found: ${id}`);
    const newFlow = await AiFlow.create({
      name: `${flow.name} (副本)`,
      description: flow.description,
      steps: flow.steps,
      firstStepId: flow.firstStepId,
      maxRetries: flow.maxRetries,
      language: flow.language,
    });
    return newFlow;
  }

  // Generate Asterisk dialplan context for an AI flow
  // Returns lines for extensions.conf
  async generateFlowDialplan(flow) {
    const lines = [];
    const ctx = `ai-flow-${flow.id}`;
    lines.push(`[${ctx}]`);
    lines.push(`; AI Flow: ${flow.name}`);
    lines.push(``);

    const steps = flow.steps || [];
    const stepMap = {};
    steps.forEach(s => { stepMap[s.id] = s; });

    // Build a linear execution from firstStepId
    const visited = new Set();
    let currentStepId = flow.firstStepId || steps[0]?.id;
    let priority = 1;

    // Entry point
    lines.push(`exten => s,${priority},NoOp(AI Flow: ${flow.name})`);
    priority++;
    lines.push(`exten => s,${priority},Answer()`);
    priority++;
    lines.push(`exten => s,${priority},Wait(0.5)`);
    priority++;

    // Process steps in order
    const processStep = async (stepId, prio) => {
      if (!stepId || visited.has(stepId)) return prio;
      visited.add(stepId);
      const step = stepMap[stepId];
      if (!step) return prio;

      switch (step.type) {
        case 'play': {
          const audioPath = await this._resolveAudioPath(step.audioFileId);
          lines.push(`exten => s,${prio},Playback(${audioPath})`);
          prio++;
          if (step.nextStepId) {
            // Will continue to next step naturally
          } else {
            lines.push(`exten => s,${prio},Hangup()`);
            prio++;
          }
          break;
        }
        case 'gather': {
          const promptPath = await this._resolveAudioPath(step.audioFileId);
          lines.push(`exten => s,${prio},Background(${promptPath})`);
          prio++;
          lines.push(`exten => s,${prio},WaitExten(${step.timeout || 5})`);
          prio++;
          // Branch handling in digit extensions
          const branches = step.branches || [];
          for (const branch of branches) {
            lines.push(`exten => ${branch.digit},1,Goto(s,${prio})`);
            lines.push(`; Branch digit ${branch.digit} -> step ${branch.nextStepId}`);
          }
          // Invalid
          lines.push(`exten => i,1,Playback(invalid)`);
          lines.push(`exten => i,n,Goto(s,${prio - 2})`);
          // Timeout
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
          break;
        }
        case 'hangup':
        default:
          lines.push(`exten => s,${prio},Hangup()`);
          prio++;
          break;
      }
      return prio;
    };

    priority = await processStep(currentStepId, priority);

    return lines.join('\n') + '\n';
  }

  async _resolveAudioPath(audioFileId) {
    if (!audioFileId) return 'beep';
    try {
      const af = await AudioFile.findByPk(audioFileId);
      return af?.asteriskPath || 'beep';
    } catch { return 'beep'; }
  }
}

export default new AiFlowService();
