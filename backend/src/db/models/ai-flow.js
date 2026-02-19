import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// AI Flow: sequence of steps to execute automatically when a campaign call is answered
// Steps are stored as JSON array:
// [
//   { id: "step-uuid", type: "play", audioFileId: "...", text: "...(tts fallback)" },
//   { id: "step-uuid", type: "gather", maxDigits: 1, timeout: 5, prompt: "audioFileId", branches: [{digit:"1", nextStepId:"..."}, {digit:"2",...}] },
//   { id: "step-uuid", type: "transfer", destinationType: "extension|queue", destinationId: "..." },
//   { id: "step-uuid", type: "hangup" },
//   { id: "step-uuid", type: "condition", variable: "DIGITS", value: "1", ifTrue: "stepId", ifFalse: "stepId" },
// ]

const AiFlow = sequelize.define('AiFlow', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING(255), allowNull: false, unique: true },
  description: { type: DataTypes.TEXT },
  // first step to execute
  firstStepId: { type: DataTypes.STRING(100), allowNull: true },
  steps: { type: DataTypes.JSON, defaultValue: [] },
  // Max retries for gather steps
  maxRetries: { type: DataTypes.INTEGER, defaultValue: 3 },
  language: { type: DataTypes.STRING(20), defaultValue: 'zh' },
  enabled: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'ai_flows', timestamps: true });

export default AiFlow;
