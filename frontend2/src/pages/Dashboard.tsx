import { useEffect, useState } from 'react'
import { Card, Col, Row, Statistic, Typography, Spin, Alert } from 'antd'
import {
  PhoneOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  TeamOutlined,
  AudioOutlined,
  DollarOutlined,
} from '@ant-design/icons'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { dashboardService } from '@/services/dashboardService'
import type { DashboardData } from '@/services/dashboardService'

const { Title } = Typography

// ── 格式化秒数为 HH:MM:SS ───────────────────────────────────────────────────
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

// ── 统计卡片配置 ─────────────────────────────────────────────────────────────
interface StatCardConfig {
  key: keyof DashboardData['stats']
  title: string
  color: string
  icon: React.ReactNode
  suffix?: string
  formatter?: (v: number) => string
}

const STAT_CARDS: StatCardConfig[] = [
  {
    key: 'todayCalls',
    title: '今日呼叫总量',
    color: '#1677ff',
    icon: <PhoneOutlined />,
  },
  {
    key: 'answeredCalls',
    title: '接通次数',
    color: '#52c41a',
    icon: <CheckCircleOutlined />,
  },
  {
    key: 'totalDuration',
    title: '通话时长',
    color: '#fa8c16',
    icon: <ClockCircleOutlined />,
    formatter: formatDuration,
  },
  {
    key: 'onlineAgents',
    title: '在线坐席',
    color: '#722ed1',
    icon: <UserOutlined />,
  },
  {
    key: 'queuedCalls',
    title: '排队数量',
    color: '#f5222d',
    icon: <TeamOutlined />,
  },
  {
    key: 'recordingsCount',
    title: '录音数量',
    color: '#13c2c2',
    icon: <AudioOutlined />,
  },
  {
    key: 'monthlySpend',
    title: '本月消费',
    color: '#d4b106',
    icon: <DollarOutlined />,
    suffix: '元',
  },
  {
    key: 'activeExtensions',
    title: '活跃分机',
    color: '#1677ff',
    icon: <PhoneOutlined />,
  },
]

// ── 占位 Mock 数据（API 未就绪时展示） ────────────────────────────────────────
const MOCK_DATA: DashboardData = {
  stats: {
    todayCalls: 1248,
    answeredCalls: 1103,
    totalDuration: 286740,
    onlineAgents: 18,
    queuedCalls: 3,
    recordingsCount: 1098,
    monthlySpend: 4280,
    activeExtensions: 42,
  },
  callTrend: [
    { date: '02-13', calls: 980 },
    { date: '02-14', calls: 1120 },
    { date: '02-15', calls: 870 },
    { date: '02-16', calls: 1340 },
    { date: '02-17', calls: 1050 },
    { date: '02-18', calls: 1190 },
    { date: '02-19', calls: 1248 },
  ],
  agentCalls: [
    { agent: '张伟', calls: 87 },
    { agent: '李娜', calls: 74 },
    { agent: '王芳', calls: 91 },
    { agent: '刘洋', calls: 68 },
    { agent: '陈静', calls: 82 },
    { agent: '赵磊', calls: 55 },
    { agent: '孙敏', calls: 79 },
  ],
}

// ── Dashboard 页面 ────────────────────────────────────────────────────────────
const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData>(MOCK_DATA)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await dashboardService.getStats()
        setData(res)
      } catch {
        // API 未就绪时静默使用 Mock 数据
        setError('数据加载失败，显示模拟数据')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  return (
    <Spin spinning={loading}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* 页面标题 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Title level={4} style={{ margin: 0 }}>
            运营仪表盘
          </Title>
          {error && (
            <Alert message={error} type="warning" showIcon closable style={{ padding: '2px 12px' }} />
          )}
        </div>

        {/* ── 8 个统计卡片（4 列 × 2 行）── */}
        <Row gutter={[16, 16]}>
          {STAT_CARDS.map((card) => {
            const rawValue = data.stats[card.key] as number
            const displayValue = card.formatter ? card.formatter(rawValue) : undefined

            return (
              <Col key={card.key} xs={24} sm={12} md={12} lg={6}>
                <Card
                  hoverable
                  styles={{ body: { padding: '20px 24px' } }}
                  style={{ borderTop: `3px solid ${card.color}` }}
                >
                  <Statistic
                    title={
                      <span style={{ fontSize: 13, color: '#666' }}>{card.title}</span>
                    }
                    value={displayValue ?? rawValue}
                    prefix={
                      <span style={{ color: card.color, marginRight: 4 }}>{card.icon}</span>
                    }
                    suffix={card.suffix}
                    valueStyle={{ color: card.color, fontSize: 28, fontWeight: 700 }}
                    // 千分位格式化（仅数字类型生效）
                    formatter={
                      !card.formatter
                        ? (val) =>
                            Number(val).toLocaleString('zh-CN')
                        : undefined
                    }
                  />
                </Card>
              </Col>
            )
          })}
        </Row>

        {/* ── 图表区域 ── */}
        <Row gutter={[16, 16]}>
          {/* 折线图：近 7 天呼叫趋势 */}
          <Col xs={24} lg={14}>
            <Card title="近 7 天呼叫趋势" styles={{ body: { paddingTop: 8 } }}>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data.callTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => v.toLocaleString()}
                  />
                  <Tooltip
                    formatter={(value: number) => [value.toLocaleString('zh-CN'), '呼叫量']}
                    contentStyle={{ borderRadius: 8, fontSize: 13 }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="calls"
                    name="呼叫量"
                    stroke="#1677ff"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#1677ff' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </Col>

          {/* 柱状图：今日各坐席通话量 */}
          <Col xs={24} lg={10}>
            <Card title="今日坐席通话量 Top 7" styles={{ body: { paddingTop: 8 } }}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={data.agentCalls}
                  layout="vertical"
                  margin={{ top: 5, right: 24, left: 8, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => v.toLocaleString()}
                  />
                  <YAxis
                    type="category"
                    dataKey="agent"
                    tick={{ fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip
                    formatter={(value: number) => [value.toLocaleString('zh-CN'), '通话次数']}
                    contentStyle={{ borderRadius: 8, fontSize: 13 }}
                  />
                  <Bar
                    dataKey="calls"
                    name="通话次数"
                    fill="#1677ff"
                    radius={[0, 4, 4, 0]}
                    maxBarSize={22}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>
      </div>
    </Spin>
  )
}

export default Dashboard
