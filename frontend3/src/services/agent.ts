import api from './api';

export interface Agent {
  id: string;
  userId: string;
  extensionId: string;
  status: 'logged_in' | 'logged_out' | 'on_break' | 'on_call';
  loginTime: string | null;
  logoutTime: string | null;
  totalWorkDuration: number;
  currentDayDuration: number;
  skillTags: string[];
  performanceRating: number;
  department: string;
  managerId: string | null;
  notes: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; username: string; email: string };
  extension?: { id: string; number: string; name: string };
}

export interface AgentStats {
  id: string;
  agentId: string;
  date: string;
  totalCalls: number;
  answeredCalls: number;
  missedCalls: number;
  avgTalkTime: number;
  totalTalkTime: number;
  conversionRate: number;
  quality: number;
}

export interface AgentListResponse {
  count: number;
  rows: Agent[];
}

export const agentService = {
  /** 获取坐席列表 */
  getAgents: (params?: { limit?: number; offset?: number }): Promise<AgentListResponse> =>
    api.get('/agents', { params }).then((r: { data: any; }) => r.data),

  /** 获取坐席详情 */
  getAgentDetail: (agentId: string): Promise<Agent> =>
    api.get(`/agents/${agentId}`).then((r: { data: any; }) => r.data),

  /** 更新坐席信息 */
  updateAgent: (agentId: string, data: Partial<Agent>): Promise<{ success: boolean; data: Agent }> =>
    api.put(`/agents/${agentId}`, data).then((r: { data: any; }) => r.data),

  /** 坐席登入（签入分机） */
  agentLogin: (extensionId: string): Promise<{ success: boolean; data: Agent }> =>
    api.post('/agents/login', { extensionId }).then((r: { data: any; }) => r.data),

  /** 坐席登出 */
  agentLogout: (extensionId: string): Promise<{ success: boolean; data: Agent }> =>
    api.post('/agents/logout', { extensionId }).then((r: { data: any; }) => r.data),

  /** 添加技能 */
  addSkill: (agentId: string, skillName: string): Promise<{ success: boolean; data: Agent }> =>
    api.post(`/agents/${agentId}/skills`, { skillName }).then((r: { data: any; }) => r.data),

  /** 移除技能 */
  removeSkill: (agentId: string, skillName: string): Promise<{ success: boolean; data: Agent }> =>
    api.delete(`/agents/${agentId}/skills/${skillName}`).then((r: { data: any; }) => r.data),

  /** 获取坐席统计 */
  getStats: (agentId: string, date?: string): Promise<AgentStats> =>
    api.get(`/agents/${agentId}/stats`, { params: { date } }).then((r: { data: any; }) => r.data),
};

export default agentService;
