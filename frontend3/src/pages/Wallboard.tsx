import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Card, Row, Col, Tag, Badge, Table, Empty, Typography, Progress, Tooltip, Button } from 'antd';
import {
  PhoneOutlined, TeamOutlined, ClockCircleOutlined, CheckCircleOutlined,
  ReloadOutlined, WifiOutlined, DisconnectOutlined,
} from '@ant-design/icons';
import { connectSocket } from '@/services/socket';
import { useAuthStore } from '@/store/authStore';
import api from '@/services/api';

const { Title } = Typography;

interface ActiveCall {
  callId: string;
  channel: string;
  callerIdNum: string;
  extension: string;
  agentName?: string;
  startTime: string;
  durationSec: number;
}

interface AgentRow {
  id: string;
  status: 'logged_in' | 'logged_out' | 'on_break' | 'on_call';
  currentDayDuration: number;
  performanceRating: number;
  department: string;
  skillTags: string[];
  user?: { username: string };
  extension?: { number: string };
}

interface DailyStats {
  callsToday: number;
  answeredToday: number;
  avgTalkTimeSec: number;
  activeAgents: number;
  onCallAgents: number;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  logged_in: { color: '#52c41a', bg: '#52c41a15', label: '空闲' },
  on_call:   { color: '#1677ff', bg: '#1677ff15', label: '通话中' },
  on_break:  { color: '#faad14', bg: '#faad1415', label: '休息中' },
  logged_out:{ color: '#8c8c8c', bg: '#8c8c8c15', label: '离线' },
};

const formatDuration = (sec: number) => {
  if (!sec || sec < 0) return '0:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const Wallboard: React.FC = () => {
  const [activeCalls, setActiveCalls]   = useState<ActiveCall[]>([]);
  const [agents, setAgents]             = useState<AgentRow[]>([]);
  const [stats, setStats]               = useState<DailyStats>({ callsToday: 0, answeredToday: 0, avgTalkTimeSec: 0, activeAgents: 0, onCallAgents: 0 });
  const [socketOk, setSocketOk]         = useState(false);
  const [lastRefresh, setLastRefresh]   = useState<Date | null>(null);
  const tickRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const token = useAuthStore(s => s.token);
  const user  = useAuthStore(s => s.user);

  // ── HTTP 数据拉取 ────────────────────────────────────────────
  const fetchAgents = useCallback(async () => {
    try {
      const res = await api.get('/agents', { params: { limit: 100, offset: 0 } });
      const rows: AgentRow[] = res.data?.rows ?? res.data ?? [];
      setAgents(rows);

      const active = rows.filter(a => a.status !== 'logged_out').length;
      const onCall = rows.filter(a => a.status === 'on_call').length;
      setStats(prev => ({ ...prev, activeAgents: active, onCallAgents: onCall }));
      setLastRefresh(new Date());
    } catch { /* silent */ }
  }, []);

  const fetchCalls = useCallback(async () => {
    try {
      const res = await api.get('/calls/active/list');
      const raw: any[] = res.data ?? [];
      setActiveCalls(raw.map(c => ({
        callId: c.callId ?? c.id ?? String(Math.random()),
        channel: c.channel ?? '',
        callerIdNum: c.callerIdNum ?? c.from ?? '—',
        extension: c.extension ?? c.to ?? '—',
        agentName: c.agentName ?? '',
        startTime: c.startTime ?? new Date().toISOString(),
        durationSec: Math.floor((Date.now() - new Date(c.startTime ?? 0).getTime()) / 1000),
      })));
    } catch { /* silent */ }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await api.get('/calls', { params: { startDate: today, endDate: today, limit: 1000 } });
      const rows: any[] = res.data?.rows ?? [];
      const answered = rows.filter(r => r.status === 'answered').length;
      const avgTalk = answered > 0
        ? Math.round(rows.filter(r => r.status === 'answered').reduce((s, r) => s + (r.talkDuration ?? 0), 0) / answered)
        : 0;
      setStats(prev => ({ ...prev, callsToday: rows.length, answeredToday: answered, avgTalkTimeSec: avgTalk }));
    } catch { /* silent */ }
  }, []);

  const refreshAll = useCallback(() => {
    fetchAgents();
    fetchCalls();
    fetchStats();
  }, [fetchAgents, fetchCalls, fetchStats]);

  // ── Socket.io 实时推送（额外层，有则用） ─────────────────────
  useEffect(() => {
    const socket = connectSocket(token || undefined, user?.id);
    socket.on('connect',    () => setSocketOk(true));
    socket.on('disconnect', () => setSocketOk(false));

    socket.on('call:new', (call: any) => {
      setActiveCalls(prev => [...prev.filter(c => c.callId !== call.callId), {
        ...call, durationSec: 0,
      }]);
    });
    socket.on('call:ended', ({ callId }: { callId: string }) => {
      setActiveCalls(prev => prev.filter(c => c.callId !== callId));
      setStats(prev => ({ ...prev, callsToday: prev.callsToday + 1 }));
    });
    socket.on('agent:status', () => fetchAgents());
    socket.on('stats:update', (s: any) => setStats(prev => ({ ...prev, ...s })));

    return () => {
      socket.off('call:new'); socket.off('call:ended');
      socket.off('agent:status'); socket.off('stats:update');
      socket.disconnect();
    };
  }, []);

  // ── 轮询 & 时钟 ─────────────────────────────────────────────
  useEffect(() => {
    refreshAll();
    pollRef.current = setInterval(refreshAll, 15_000); // 每15秒轮询
    tickRef.current = setInterval(() => {
      setActiveCalls(prev => prev.map(c => ({
        ...c, durationSec: Math.floor((Date.now() - new Date(c.startTime).getTime()) / 1000),
      })));
    }, 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [refreshAll]);

  // ── 计算指标 ─────────────────────────────────────────────────
  const answerRate = stats.callsToday > 0
    ? Math.round(stats.answeredToday / stats.callsToday * 100) : 0;

  const statCards = [
    { title: '今日总呼', value: stats.callsToday,             icon: <PhoneOutlined />,       color: '#1677ff' },
    { title: '接通率',   value: `${answerRate}%`,             icon: <CheckCircleOutlined />,  color: '#52c41a' },
    { title: '平均通话', value: formatDuration(stats.avgTalkTimeSec), icon: <ClockCircleOutlined />, color: '#fa8c16' },
    { title: '在线坐席', value: stats.activeAgents,           icon: <TeamOutlined />,         color: '#eb2f96' },
    { title: '通话中',   value: stats.onCallAgents,           icon: <PhoneOutlined />,        color: '#722ed1' },
    { title: '当前通话', value: activeCalls.length,           icon: <PhoneOutlined />,        color: '#13c2c2' },
  ];

  const callColumns = [
    { title: '主叫号码', dataIndex: 'callerIdNum', key: 'caller',
      render: (v: string) => <span style={{ fontFamily: 'monospace', color: '#40a9ff' }}>{v}</span> },
    { title: '分机', dataIndex: 'extension', key: 'ext' },
    { title: '坐席', dataIndex: 'agentName', key: 'agent',
      render: (v: string) => v || <span style={{ color: '#555' }}>—</span> },
    { title: '通话时长', dataIndex: 'durationSec', key: 'dur',
      render: (v: number) => (
        <Tag color={v > 180 ? 'green' : v > 60 ? 'blue' : 'default'}>{formatDuration(v)}</Tag>
      ) },
  ];

  const cardStyle = (color: string): React.CSSProperties => ({
    background: '#111827',
    border: `1px solid ${color}44`,
    borderRadius: 12,
    textAlign: 'center' as const,
    cursor: 'default',
  });

  return (
    <div style={{ padding: 24, background: '#0d1117', minHeight: '100vh' }}>
      {/* 顶部标题栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ color: '#e6edf3', margin: 0 }}>📊 实时监控大屏</Title>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {lastRefresh && (
            <span style={{ color: '#8b949e', fontSize: 12 }}>
              更新于 {lastRefresh.toLocaleTimeString('zh-CN')}
            </span>
          )}
          <Tooltip title="Socket.io 实时推送">
            {socketOk
              ? <WifiOutlined style={{ color: '#52c41a', fontSize: 16 }} />
              : <DisconnectOutlined style={{ color: '#8c8c8c', fontSize: 16 }} />}
          </Tooltip>
          <Button icon={<ReloadOutlined />} size="small" onClick={refreshAll}
            style={{ background: '#21262d', borderColor: '#30363d', color: '#e6edf3' }}>
            刷新
          </Button>
        </div>
      </div>

      {/* 核心指标卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {statCards.map(({ title, value, icon, color }) => (
          <Col key={title} xs={12} sm={8} md={4}>
            <Card style={cardStyle(color)} bodyStyle={{ padding: '20px 8px' }}>
              <div style={{ color, fontSize: 32, marginBottom: 8 }}>{icon}</div>
              <div style={{ color: '#e6edf3', fontSize: 30, fontWeight: 700, lineHeight: 1 }}>{value}</div>
              <div style={{ color: '#8b949e', fontSize: 12, marginTop: 6 }}>{title}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        {/* 坐席状态网格 */}
        <Col xs={24} lg={14}>
          <Card
            title={<span style={{ color: '#e6edf3' }}>👥 坐席实时状态 ({agents.filter(a => a.status !== 'logged_out').length} 在线)</span>}
            style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12 }}
            headStyle={{ background: '#161b22', borderBottom: '1px solid #30363d' }}
          >
            {agents.length === 0 ? (
              <Empty description={<span style={{ color: '#6e7681' }}>暂无坐席数据，请先添加坐席</span>} />
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {agents.map(a => {
                  const cfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.logged_out;
                  const name = a.user?.username ?? a.id.slice(0, 8);
                  const ext  = a.extension?.number ?? '—';
                  return (
                    <div key={a.id} style={{
                      width: 148, padding: '12px 8px', borderRadius: 10,
                      border: `1.5px solid ${cfg.color}`,
                      background: cfg.bg,
                      textAlign: 'center',
                      transition: 'all 0.2s',
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: cfg.color, color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 8px',
                        fontSize: 16, fontWeight: 700,
                      }}>
                        {name[0]?.toUpperCase()}
                      </div>
                      <div style={{ color: '#e6edf3', fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{name}</div>
                      <div style={{ color: '#8b949e', fontSize: 11, marginBottom: 6 }}>分机 {ext}</div>
                      <Tag color={cfg.color} style={{ fontSize: 11 }}>{cfg.label}</Tag>
                      {a.status !== 'logged_out' && (
                        <div style={{ marginTop: 6 }}>
                          <Tooltip title="今日工时">
                            <div style={{ color: '#8b949e', fontSize: 10 }}>
                              {formatDuration(a.currentDayDuration ?? 0)}
                            </div>
                          </Tooltip>
                          <Progress
                            percent={Math.min(100, Math.round((a.performanceRating ?? 0) / 5 * 100))}
                            size="small"
                            showInfo={false}
                            strokeColor={cfg.color}
                            style={{ marginBottom: 0 }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </Col>

        {/* 当前通话列表 */}
        <Col xs={24} lg={10}>
          <Card
            title={<span style={{ color: '#e6edf3' }}>📞 当前通话 ({activeCalls.length})</span>}
            style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12 }}
            headStyle={{ background: '#161b22', borderBottom: '1px solid #30363d' }}
          >
            <Table
              dataSource={activeCalls}
              rowKey="callId"
              columns={callColumns}
              size="small"
              pagination={false}
              style={{ background: 'transparent' }}
              onRow={() => ({ style: { background: 'transparent', borderColor: '#30363d' } })}
              locale={{ emptyText: <Empty description={<span style={{ color: '#6e7681' }}>暂无活跃通话</span>} /> }}
            />
          </Card>

          {/* 今日接通率 */}
          <Card
            style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, marginTop: 16 }}
            bodyStyle={{ padding: 20 }}
          >
            <div style={{ color: '#8b949e', fontSize: 13, marginBottom: 12 }}>📈 今日接通率</div>
            <Progress
              percent={answerRate}
              strokeColor={{ '0%': '#1677ff', '100%': '#52c41a' }}
              trailColor='#21262d'
              format={p => <span style={{ color: '#e6edf3' }}>{p}%</span>}
            />
            <Row gutter={16} style={{ marginTop: 16, textAlign: 'center' }}>
              <Col span={8}>
                <div style={{ color: '#e6edf3', fontWeight: 700, fontSize: 20 }}>{stats.callsToday}</div>
                <div style={{ color: '#8b949e', fontSize: 11 }}>总呼叫</div>
              </Col>
              <Col span={8}>
                <div style={{ color: '#52c41a', fontWeight: 700, fontSize: 20 }}>{stats.answeredToday}</div>
                <div style={{ color: '#8b949e', fontSize: 11 }}>已接通</div>
              </Col>
              <Col span={8}>
                <div style={{ color: '#fa8c16', fontWeight: 700, fontSize: 20 }}>{formatDuration(stats.avgTalkTimeSec)}</div>
                <div style={{ color: '#8b949e', fontSize: 11 }}>均通话</div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Wallboard;
