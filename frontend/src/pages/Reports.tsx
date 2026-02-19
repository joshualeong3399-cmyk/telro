import { useState, useMemo } from 'react'
import {
  Row, Col, Card, Statistic, DatePicker, Button, Space, Typography, Table,
  Select, Tabs, Tag,
} from 'antd'
import {
  PhoneOutlined, CheckCircleOutlined, CloseCircleOutlined, BarChartOutlined,
  DownloadOutlined, ReloadOutlined,
} from '@ant-design/icons'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { RangePicker } = DatePicker
const { Option } = Select

// ── Mock data ─────────────────────────────────────────────────────────────────
const DAILY = Array.from({ length: 14 }, (_, i) => {
  const total = Math.floor(Math.random() * 200 + 80)
  const answered = Math.floor(total * (0.7 + Math.random() * 0.2))
  return {
    date: dayjs().subtract(13 - i, 'day').format('MM-DD'),
    totalCalls: total, answeredCalls: answered,
    missedCalls: total - answered,
    avgDuration: Math.floor(Math.random() * 120 + 60),
    answerRate: Math.round((answered / total) * 100),
  }
})

interface AgentReport {
  key: number; agentName: string; agentNo: string;
  totalCalls: number; answeredCalls: number; avgDuration: number; totalTalkTime: number
}

const AGENTS: AgentReport[] = [
  { key: 1, agentName: '张晓明', agentNo: 'A001', totalCalls: 87, answeredCalls: 80, avgDuration: 185, totalTalkTime: 14800 },
  { key: 2, agentName: '李雪梅', agentNo: 'A002', totalCalls: 76, answeredCalls: 71, avgDuration: 220, totalTalkTime: 15620 },
  { key: 3, agentName: '王建国', agentNo: 'A003', totalCalls: 65, answeredCalls: 58, avgDuration: 165, totalTalkTime: 9570 },
  { key: 4, agentName: '陈丽华', agentNo: 'A004', totalCalls: 92, answeredCalls: 85, avgDuration: 198, totalTalkTime: 16830 },
  { key: 5, agentName: '赵文龙', agentNo: 'A005', totalCalls: 54, answeredCalls: 49, avgDuration: 142, totalTalkTime: 6958 },
]

const HOURLY = Array.from({ length: 24 }, (_, h) => ({
  hour: `${String(h).padStart(2, '0')}:00`,
  calls: h >= 8 && h <= 18 ? Math.floor(Math.random() * 40 + 10) : Math.floor(Math.random() * 5),
}))

const PIE_COLORS = ['#52c41a', '#ff4d4f', '#fa8c16']

function fmtSeconds(s: number) {
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

const Reports: React.FC = () => {
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().subtract(13, 'day'), dayjs()])
  const [agentFilter, setAgentFilter] = useState<number | undefined>()

  const summary = useMemo(() => ({
    total: DAILY.reduce((s, d) => s + d.totalCalls, 0),
    answered: DAILY.reduce((s, d) => s + d.answeredCalls, 0),
    missed: DAILY.reduce((s, d) => s + d.missedCalls, 0),
    avgRate: Math.round(DAILY.reduce((s, d) => s + d.answerRate, 0) / DAILY.length),
    avgDur: Math.round(DAILY.reduce((s, d) => s + d.avgDuration, 0) / DAILY.length),
  }), [])

  const pieData = [
    { name: '已接听', value: summary.answered },
    { name: '未接听', value: summary.missed },
  ]

  const agentCols: ColumnsType<AgentReport> = [
    { title: '坐席', dataIndex: 'agentName', width: 120 },
    { title: '工号', dataIndex: 'agentNo', width: 80 },
    { title: '总呼叫', dataIndex: 'totalCalls', width: 90, align: 'right', sorter: (a, b) => a.totalCalls - b.totalCalls },
    { title: '已接听', dataIndex: 'answeredCalls', width: 90, align: 'right', sorter: (a, b) => a.answeredCalls - b.answeredCalls },
    {
      title: '接听率', key: 'rate', width: 100, align: 'right', sorter: (a, b) => a.answeredCalls / a.totalCalls - b.answeredCalls / b.totalCalls,
      render: (_, r) => {
        const rate = Math.round((r.answeredCalls / r.totalCalls) * 100)
        return <Tag color={rate >= 90 ? 'success' : rate >= 70 ? 'warning' : 'error'}>{rate}%</Tag>
      },
    },
    { title: '平均时长', dataIndex: 'avgDuration', width: 100, align: 'right', render: (v: number) => `${v}s`, sorter: (a, b) => a.avgDuration - b.avgDuration },
    { title: '总通话时长', dataIndex: 'totalTalkTime', width: 110, align: 'right', render: (v: number) => fmtSeconds(v), sorter: (a, b) => a.totalTalkTime - b.totalTalkTime },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}><BarChartOutlined /> 报表分析</Title>
        <Space>
          <RangePicker
            value={dateRange}
            onChange={(v) => v && setDateRange(v as [dayjs.Dayjs, dayjs.Dayjs])}
            format="YYYY-MM-DD"
          />
          <Button icon={<ReloadOutlined />}>刷新</Button>
          <Button icon={<DownloadOutlined />} type="primary">导出报表</Button>
        </Space>
      </div>

      {/* Summary cards */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        {[
          { title: '总呼叫量', value: summary.total, color: '#1677ff', icon: <PhoneOutlined /> },
          { title: '已接听', value: summary.answered, color: '#52c41a', icon: <CheckCircleOutlined /> },
          { title: '未接听', value: summary.missed, color: '#ff4d4f', icon: <CloseCircleOutlined /> },
          { title: '平均接听率', value: `${summary.avgRate}%`, color: '#722ed1', icon: <BarChartOutlined /> },
          { title: '平均通话时长', value: `${summary.avgDur}s`, color: '#13c2c2', icon: <PhoneOutlined /> },
        ].map((c) => (
          <Col key={c.title} xs={12} sm={8} md={6} lg={5}>
            <Card size="small" style={{ borderTop: `3px solid ${c.color}`, borderRadius: 8 }}>
              <Statistic title={c.title} value={c.value} valueStyle={{ color: c.color, fontSize: 22 }} prefix={c.icon} />
            </Card>
          </Col>
        ))}
      </Row>

      <Tabs items={[
        {
          key: 'trend', label: '呼叫趋势',
          children: (
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={16}>
                <Card title="14日呼叫趋势" size="small">
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={DAILY}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <RechartTooltip />
                      <Legend />
                      <Line type="monotone" dataKey="totalCalls" name="总呼叫" stroke="#1677ff" dot={false} />
                      <Line type="monotone" dataKey="answeredCalls" name="已接听" stroke="#52c41a" dot={false} />
                      <Line type="monotone" dataKey="missedCalls" name="未接听" stroke="#ff4d4f" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
              <Col xs={24} lg={8}>
                <Card title="接听分布" size="small">
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                      </Pie>
                      <RechartTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
            </Row>
          ),
        },
        {
          key: 'hourly', label: '时段分析',
          children: (
            <Card title="24小时呼叫分布" size="small">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={HOURLY}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <RechartTooltip />
                  <Bar dataKey="calls" name="呼叫数" fill="#1677ff" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          ),
        },
        {
          key: 'agents', label: '坐席报表',
          children: (
            <div>
              <Space style={{ marginBottom: 12 }}>
                <Select placeholder="筛选坐席" allowClear style={{ width: 160 }} onChange={setAgentFilter}>
                  {AGENTS.map((a) => <Option key={a.key} value={a.key}>{a.agentName}</Option>)}
                </Select>
                <Button icon={<DownloadOutlined />}>导出</Button>
              </Space>
              <Table
                columns={agentCols}
                dataSource={agentFilter ? AGENTS.filter((a) => a.key === agentFilter) : AGENTS}
                pagination={false}
                size="small"
                summary={(rows) => (
                  <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 600 }}>
                    <Table.Summary.Cell index={0} colSpan={2}><Text strong>合计</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="right"><Text strong>{rows.reduce((s, r) => s + r.totalCalls, 0)}</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="right"><Text strong>{rows.reduce((s, r) => s + r.answeredCalls, 0)}</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={4} />
                    <Table.Summary.Cell index={5} />
                    <Table.Summary.Cell index={6} align="right"><Text strong>{fmtSeconds(rows.reduce((s, r) => s + r.totalTalkTime, 0))}</Text></Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
              />
            </div>
          ),
        },
      ]} />
    </div>
  )
}

export default Reports
