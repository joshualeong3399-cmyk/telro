import React, { useEffect, useRef, useState } from 'react';
import { Card, Row, Col, Statistic, Tag, Badge, Table, Empty, Spin, Typography } from 'antd';
import {
  PhoneOutlined, TeamOutlined, ClockCircleOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { connectSocket, getSocket } from '@/services/socket';
import { useAuthStore } from '@/store/authStore';

const { Title, Text } = Typography;

interface ActiveCall {
  callId: string;
  channel: string;
  callerIdNum: string;
  extension: string;
  agentName?: string;
  startTime: string;
  durationSec: number;
}

interface AgentStatus {
  agentId: string;
  name: string;
  extension: string;
  status: 'idle' | 'on_call' | 'break' | 'offline';
  currentCall?: string;
  lastStatusAt: string;
}

interface WallboardStats {
  callsToday: number;
  answeredToday: number;
  avgTalkTimeSec: number;
  queueWaiting: number;
  activeAgents: number;
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  idle: { color: '#52c41a', label: '空闲' },
  on_call: { color: '#1677ff', label: '通话中' },
  break: { color: '#faad14', label: '休息' },
  offline: { color: '#d9d9d9', label: '离线' },
};

const formatDuration = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const Wallboard: React.FC = () => {
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
  const [agentStatuses, setAgentStatuses] = useState<AgentStatus[]>([]);
  const [stats, setStats] = useState<WallboardStats>({
    callsToday: 0, answeredToday: 0, avgTalkTimeSec: 0, queueWaiting: 0, activeAgents: 0,
  });
  const [connected, setConnected] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const token = useAuthStore(s => s.token);
  const user = useAuthStore(s => s.user);

  useEffect(() => {
    const socket = connectSocket(token || undefined, user?.id);

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    // 通话事件
    socket.on('call:new', (call: ActiveCall) => {
      setActiveCalls(prev => [...prev.filter(c => c.callId !== call.callId), call]);
    });
    socket.on('call:connected', (call: ActiveCall) => {
      setActiveCalls(prev => prev.map(c => c.callId === call.callId ? { ...c, ...call } : c));
    });
    socket.on('call:ended', ({ callId }: { callId: string }) => {
      setActiveCalls(prev => prev.filter(c => c.callId !== callId));
      setStats(prev => ({ ...prev, callsToday: prev.callsToday + 1 }));
    });

    // 坐席状态
    socket.on('agent:status', (status: AgentStatus) => {
      setAgentStatuses(prev => {
        const exists = prev.findIndex(a => a.agentId === status.agentId);
        if (exists >= 0) { const n = [...prev]; n[exists] = status; return n; }
        return [...prev, status];
      });
    });

    // 统计数据
    socket.on('stats:update', (s: WallboardStats) => setStats(s));

    // 定时更新通话时长
    tickRef.current = setInterval(() => {
      setActiveCalls(prev => prev.map(c => ({
        ...c,
        durationSec: Math.floor((Date.now() - new Date(c.startTime).getTime()) / 1000),
      })));
    }, 1000);

    return () => {
      socket.off('call:new'); socket.off('call:connected'); socket.off('call:ended');
      socket.off('agent:status'); socket.off('stats:update');
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  const answerRate = stats.callsToday > 0
    ? Math.round(stats.answeredToday / stats.callsToday * 100)
    : 0;

  const callColumns = [
    { title: '主叫号码', dataIndex: 'callerIdNum', key: 'caller', render: (v: string) => <span style={{ fontFamily: 'monospace' }}>{v}</span> },
    { title: '分机', dataIndex: 'extension', key: 'ext' },
    { title: '坐席', dataIndex: 'agentName', key: 'agent', render: (v: string) => v || '—' },
    {
      title: '通话时长', dataIndex: 'durationSec', key: 'duration',
      render: (v: number) => <Tag color={v > 120 ? 'green' : 'blue'}>{formatDuration(v)}</Tag>,
    },
  ];

  return (
    <div style={{ padding: 24, background: '#0a0a1a', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ color: '#fff', margin: 0 }}>📊 实时监控大屏</Title>
        <Badge
          status={connected ? 'success' : 'error'}
          text={<span style={{ color: '#aaa' }}>{connected ? '已连接' : '连接中断'}</span>}
        />
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {[
          { title: '今日总呼', value: stats.callsToday, icon: <PhoneOutlined />, color: '#1677ff' },
          { title: '接通率', value: `${answerRate}%`, icon: <CheckCircleOutlined />, color: '#52c41a' },
          { title: '平均通话', value: formatDuration(stats.avgTalkTimeSec), icon: <ClockCircleOutlined />, color: '#fa8c16' },
          { title: '在线坐席', value: stats.activeAgents, icon: <TeamOutlined />, color: '#eb2f96' },
          { title: '队列等待', value: stats.queueWaiting, icon: <PhoneOutlined />, color: '#722ed1' },
          { title: '当前通话', value: activeCalls.length, icon: <PhoneOutlined />, color: '#13c2c2' },
        ].map(({ title, value, icon, color }) => (
          <Col key={title} span={4}>
            <Card style={{ background: '#111', border: `1px solid ${color}22`, textAlign: 'center' }}
              bodyStyle={{ padding: '16px 8px' }}>
              <div style={{ color, fontSize: 28, marginBottom: 4 }}>{icon}</div>
              <div style={{ color: '#fff', fontSize: 28, fontWeight: 700 }}>{value}</div>
              <div style={{ color: '#888', fontSize: 12 }}>{title}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={16}>
        {/* 坐席状态网格 */}
        <Col span={12}>
          <Card title={<span style={{ color: '#fff' }}>坐席状态</span>}
            style={{ background: '#111', border: '1px solid #333' }}
            headStyle={{ background: '#1a1a2e', borderBottom: '1px solid #333' }}>
            {agentStatuses.length === 0 ? (
              <Empty description={<span style={{ color: '#555' }}>暂无坐席数据</span>} />
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {agentStatuses.map(a => {
                  const cfg = STATUS_CONFIG[a.status] || STATUS_CONFIG.offline;
                  return (
                    <div key={a.agentId} style={{
                      width: 140, padding: 12, borderRadius: 8,
                      border: `2px solid ${cfg.color}`,
                      background: `${cfg.color}15`,
                      textAlign: 'center',
                    }}>
                      <div style={{ color: cfg.color, fontWeight: 700, fontSize: 16 }}>{a.name}</div>
                      <div style={{ color: '#aaa', fontSize: 12 }}>分机 {a.extension}</div>
                      <Tag color={cfg.color} style={{ marginTop: 4 }}>{cfg.label}</Tag>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </Col>

        {/* 当前活跃通话 */}
        <Col span={12}>
          <Card title={<span style={{ color: '#fff' }}>当前通话列表 ({activeCalls.length})</span>}
            style={{ background: '#111', border: '1px solid #333' }}
            headStyle={{ background: '#1a1a2e', borderBottom: '1px solid #333' }}>
            <Table
              dataSource={activeCalls} rowKey="callId" columns={callColumns} size="small"
              pagination={false}
              style={{ background: 'transparent' }}
              onRow={() => ({ style: { background: 'transparent' } })}
              locale={{ emptyText: <Empty description={<span style={{ color: '#555' }}>暂无活跃通话</span>} /> }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Wallboard;
