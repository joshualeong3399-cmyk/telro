import { useEffect, useRef, useState } from 'react'
import {
  Row, Col, Card, Badge, Tag, Typography, Avatar, Tooltip,
  Space, Button,
} from 'antd'
import {
  PhoneOutlined, UserOutlined, ReloadOutlined,
  CheckCircleOutlined, ClockCircleOutlined,
} from '@ant-design/icons'
import { socketService } from '@/services/socket'
import type { AgentStatusPayload, CallUpdatePayload } from '@/services/socket'

const { Title, Text } = Typography

// ── Types ─────────────────────────────────────────────────────────────────────
type AgentStatus = 'online' | 'busy' | 'away' | 'offline'

interface AgentCard extends AgentStatusPayload {
  lastUpdate: number
}

interface CallStats extends CallUpdatePayload {
  avgHandleTime: number    // seconds (extra field for display)
}

// ── Mock initial data ─────────────────────────────────────────────────────────
const INITIAL_AGENTS: AgentCard[] = [
  { agentId: 1, agentNo: 'A001', name: '张晓明', status: 'busy',    currentCallId: 'C10021', lastUpdate: Date.now() },
  { agentId: 2, agentNo: 'A002', name: '李雪梅', status: 'online',  currentCallId: undefined, lastUpdate: Date.now() },
  { agentId: 3, agentNo: 'A003', name: '王建国', status: 'away',    currentCallId: undefined, lastUpdate: Date.now() },
  { agentId: 4, agentNo: 'A004', name: '陈丽华', status: 'busy',    currentCallId: 'C10022', lastUpdate: Date.now() },
  { agentId: 5, agentNo: 'A005', name: '赵文龙', status: 'online',  currentCallId: undefined, lastUpdate: Date.now() },
  { agentId: 6, agentNo: 'A006', name: '孙明月', status: 'offline', currentCallId: undefined, lastUpdate: Date.now() },
  { agentId: 7, agentNo: 'A007', name: '周浩然', status: 'busy',    currentCallId: 'C10023', lastUpdate: Date.now() },
  { agentId: 8, agentNo: 'A008', name: '吴佳琪', status: 'online',  currentCallId: undefined, lastUpdate: Date.now() },
]

const INITIAL_STATS: CallStats = {
  totalCalls: 128,
  answeredCalls: 115,
  queuedCalls: 3,
  onlineAgents: 5,
  avgHandleTime: 187,
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<AgentStatus, { label: string; color: string; bg: string; badge: 'success' | 'processing' | 'warning' | 'error' | 'default' }> = {
  online:  { label: '空闲',   color: '#52c41a', bg: '#f6ffed', badge: 'success'    },
  busy:    { label: '通话中', color: '#1677ff', bg: '#e6f4ff', badge: 'processing' },
  away:    { label: '小休',   color: '#fa8c16', bg: '#fff7e6', badge: 'warning'    },
  offline: { label: '离线',   color: '#bfbfbf', bg: '#fafafa', badge: 'default'    },
}

function fmtDuration(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`
  return `${s}s`
}

// ── Wallboard ─────────────────────────────────────────────────────────────────
const Wallboard: React.FC = () => {
  const [agents, setAgents] = useState<AgentCard[]>(INITIAL_AGENTS)
  const [stats, setStats] = useState<CallStats>(INITIAL_STATS)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [now, setNow] = useState(new Date())

  // 实时时钟
  useEffect(() => {
    clockRef.current = setInterval(() => setNow(new Date()), 1000)
    return () => { if (clockRef.current) clearInterval(clockRef.current) }
  }, [])

  // Socket 事件监听
  useEffect(() => {
    socketService.connect()

    const handleAgentStatus = (data: AgentStatusPayload) => {
      setLastRefresh(new Date())
      setAgents((prev) => {
        const idx = prev.findIndex((a) => a.agentId === data.agentId)
        const updated: AgentCard = { ...data, lastUpdate: Date.now() }
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = updated
          return next
        }
        return [...prev, updated]
      })
    }

    const handleCallUpdate = (data: CallUpdatePayload) => {
      setLastRefresh(new Date())
      setStats((prev) => ({ ...prev, ...data }))
    }

    socketService.on('agent:status', handleAgentStatus)
    socketService.on('call:update', handleCallUpdate)

    return () => {
      socketService.off('agent:status', handleAgentStatus)
      socketService.off('call:update', handleCallUpdate)
    }
  }, [])

  // ── 统计汇总 ────────────────────────────────────────────────────────────────
  const agentCounts = agents.reduce(
    (acc, a) => { acc[a.status] = (acc[a.status] ?? 0) + 1; return acc },
    {} as Record<AgentStatus, number>,
  )

  const answerRate = stats.totalCalls > 0
    ? Math.round((stats.answeredCalls / stats.totalCalls) * 100)
    : 0

  // ── Stat cards data ─────────────────────────────────────────────────────────
  const statCards = [
    { title: '今日来电',   value: stats.totalCalls,     suffix: '次', color: '#1677ff', icon: <PhoneOutlined />,        bg: '#e6f4ff' },
    { title: '已接听',     value: stats.answeredCalls,  suffix: '次', color: '#52c41a', icon: <CheckCircleOutlined />,   bg: '#f6ffed' },
    { title: '排队等待',   value: stats.queuedCalls,    suffix: '人', color: '#fa8c16', icon: <ClockCircleOutlined />,   bg: '#fff7e6' },
    { title: '接听率',     value: `${answerRate}%`,     suffix: '',   color: '#722ed1', icon: <CheckCircleOutlined />,   bg: '#f9f0ff' },
    { title: '在线坐席',   value: stats.onlineAgents,   suffix: '人', color: '#13c2c2', icon: <UserOutlined />,          bg: '#e6fffb' },
    { title: '通话中',     value: agentCounts.busy ?? 0, suffix: '人', color: '#1677ff', icon: <PhoneOutlined />,        bg: '#e6f4ff' },
    { title: '小休',       value: agentCounts.away ?? 0, suffix: '人', color: '#fa8c16', icon: <UserOutlined />,          bg: '#fff7e6' },
    { title: '平均通话',   value: fmtDuration(stats.avgHandleTime), suffix: '', color: '#eb2f96', icon: <ClockCircleOutlined />, bg: '#fff0f6' },
  ]

  return (
    <div style={{ padding: '20px 24px', minHeight: '100vh', background: '#f0f2f5' }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 20, background: '#fff', padding: '12px 20px',
          borderRadius: 8, boxShadow: '0 1px 4px rgba(0,21,41,0.08)',
        }}
      >
        <Space>
          <Title level={4} style={{ margin: 0 }}>📊 实时坐席监控大屏</Title>
          <Tag color="green">LIVE</Tag>
        </Space>
        <Space>
          <Text type="secondary" style={{ fontSize: 13 }}>
            最近更新 {lastRefresh.toLocaleTimeString('zh-CN')}
          </Text>
          <Text style={{ fontSize: 20, fontFamily: 'monospace', fontWeight: 600 }}>
            {now.toLocaleTimeString('zh-CN')}
          </Text>
          <Tooltip title="刷新连接">
            <Button
              icon={<ReloadOutlined />}
              size="small"
              onClick={() => { socketService.disconnect(); setTimeout(() => socketService.connect(), 300) }}
            />
          </Tooltip>
        </Space>
      </div>

      {/* ── Stat Cards ─────────────────────────────────────────────────────── */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        {statCards.map((c) => (
          <Col key={c.title} xs={12} sm={8} md={6} xl={3}>
            <Card
              size="small"
              style={{
                borderRadius: 8, borderTop: `3px solid ${c.color}`,
                boxShadow: '0 1px 4px rgba(0,21,41,0.06)',
              }}
              styles={{ body: { padding: '12px 14px' } }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div
                  style={{
                    width: 32, height: 32, borderRadius: 6, background: c.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: c.color, fontSize: 15, flexShrink: 0,
                  }}
                >
                  {c.icon}
                </div>
                <div style={{ minWidth: 0 }}>
                  <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{c.title}</Text>
                  <Text strong style={{ fontSize: 20, color: c.color, lineHeight: 1.3 }}>
                    {c.value}
                    {c.suffix && <span style={{ fontSize: 12, color: '#999', marginLeft: 2 }}>{c.suffix}</span>}
                  </Text>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* ── Agent Grid ─────────────────────────────────────────────────────── */}
      <Card
        title={<span style={{ fontWeight: 600 }}>坐席状态</span>}
        extra={
          <Space>
            {(['online', 'busy', 'away', 'offline'] as AgentStatus[]).map((s) => (
              <Space key={s} size={4}>
                <Badge status={STATUS_CFG[s].badge} />
                <Text style={{ fontSize: 12, color: STATUS_CFG[s].color }}>
                  {STATUS_CFG[s].label} {agentCounts[s] ?? 0}
                </Text>
              </Space>
            ))}
          </Space>
        }
        style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,21,41,0.06)' }}
      >
        <Row gutter={[12, 12]}>
          {agents.map((agent) => {
            const cfg = STATUS_CFG[agent.status]
            return (
              <Col key={agent.agentId} xs={12} sm={8} md={6} lg={4} xl={3}>
                <Tooltip
                  title={
                    agent.currentCallId
                      ? `通话ID: ${agent.currentCallId}`
                      : `最近更新: ${new Date(agent.lastUpdate).toLocaleTimeString('zh-CN')}`
                  }
                >
                  <div
                    style={{
                      background: cfg.bg,
                      border: `1.5px solid ${cfg.color}33`,
                      borderRadius: 8, padding: '10px 12px',
                      textAlign: 'center', cursor: 'default',
                      transition: 'transform 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                  >
                    <Badge
                      status={cfg.badge}
                      dot
                      offset={[-4, 4]}
                      styles={{ indicator: { width: 10, height: 10 } }}
                    >
                      <Avatar
                        size={40}
                        style={{ background: cfg.color, marginBottom: 6 }}
                      >
                        {agent.name[0]}
                      </Avatar>
                    </Badge>
                    <div style={{ marginTop: 2 }}>
                      <Text strong style={{ fontSize: 13, display: 'block' }}>{agent.name}</Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>{agent.agentNo}</Text>
                    </div>
                    <Tag
                      color={cfg.color}
                      style={{ marginTop: 6, fontSize: 11, padding: '0 6px' }}
                    >
                      {cfg.label}
                    </Tag>
                    {agent.currentCallId && (
                      <div style={{ marginTop: 4 }}>
                        <Text style={{ fontSize: 10, color: cfg.color }}>
                          📞 {agent.currentCallId}
                        </Text>
                      </div>
                    )}
                  </div>
                </Tooltip>
              </Col>
            )
          })}
        </Row>
      </Card>
    </div>
  )
}

export default Wallboard
