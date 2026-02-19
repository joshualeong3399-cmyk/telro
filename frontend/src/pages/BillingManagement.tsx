import { useState, useEffect, useMemo } from 'react'
import {
  Card, Col, Row, Statistic, Tabs, Table, Select, DatePicker,
  Space, Typography, Tag,
} from 'antd'
import type { ColumnsType, TableProps } from 'antd/es/table'
import {
  PhoneOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { billingService } from '@/services/billingService'
import type {
  BillingSummary,
  DailyStatItem,
  BillingRecord,
  BillingType,
} from '@/services/billingService'

const { Text } = Typography
const { RangePicker } = DatePicker

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtInt = (v: number) => v.toLocaleString('zh-CN')
const fmtDec = (v: number) =>
  v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtPct = (v: number) => `${v.toFixed(1)}%`
const fmtSec = (s: number) => {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}m ${String(sec).padStart(2, '0')}s`
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const genMockDaily = (): DailyStatItem[] => {
  const today = dayjs()
  return Array.from({ length: 19 }, (_, i) => {
    const calls = 800 + Math.floor(Math.random() * 600)
    const answered = Math.floor(calls * (0.8 + Math.random() * 0.15))
    const duration = Math.floor(answered * (3 + Math.random() * 3))
    return {
      date: today.subtract(18 - i, 'day').format('YYYY-MM-DD'),
      calls,
      answered,
      answerRate: parseFloat(((answered / calls) * 100).toFixed(1)),
      duration,
      cost: parseFloat((duration * 0.1).toFixed(2)),
    }
  })
}

const MOCK_DAILY = genMockDaily()

const calcSummary = (daily: DailyStatItem[]): BillingSummary => {
  const totalCalls = daily.reduce((s, d) => s + d.calls, 0)
  const answeredCalls = daily.reduce((s, d) => s + d.answered, 0)
  const totalDuration = daily.reduce((s, d) => s + d.duration, 0)
  const totalSpend = parseFloat(daily.reduce((s, d) => s + d.cost, 0).toFixed(2))
  return {
    totalCalls,
    answeredCalls,
    answerRate: parseFloat(((answeredCalls / totalCalls) * 100).toFixed(1)),
    totalDuration,
    totalSpend,
  }
}

const BILLING_TYPES: Exclude<BillingType, 'all'>[] = ['minute', 'count']
const BT_LABELS: Record<string, string> = { minute: '分钟计费', count: '次数计费' }
const BT_COLORS: Record<string, string> = { minute: 'blue', count: 'purple' }

const genMockRecords = (): BillingRecord[] =>
  Array.from({ length: 60 }, (_, i) => {
    const bt = BILLING_TYPES[i % 2]
    const duration = 30 + Math.floor(Math.random() * 300)
    return {
      id: i + 1,
      time: dayjs().subtract(i * 23, 'minute').toISOString(),
      billingType: bt,
      callerNumber: `0755${String(10000000 + Math.floor(Math.random() * 89999999)).slice(0, 8)}`,
      calleeNumber: `1${['3', '5', '7', '8'][i % 4]}${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
      duration,
      cost: parseFloat((bt === 'minute' ? Math.ceil(duration / 60) * 0.1 : 0.05).toFixed(2)),
    }
  })

const MOCK_RECORDS = genMockRecords()

// ─── Stat Cards ───────────────────────────────────────────────────────────────
interface SummaryCardsProps {
  summary: BillingSummary
}

const SummaryCards: React.FC<SummaryCardsProps> = ({ summary }) => (
  <Row gutter={16} style={{ marginBottom: 16 }}>
    <Col xs={24} sm={12} xl={6}>
      <Card styles={{ body: { padding: '20px 24px' } }} style={{ borderTop: '3px solid #1677ff' }}>
        <Statistic
          title="本月拨打次数"
          value={summary.totalCalls}
          prefix={<PhoneOutlined style={{ color: '#1677ff' }} />}
          formatter={(v) => fmtInt(Number(v))}
          valueStyle={{ color: '#1677ff', fontWeight: 700 }}
        />
      </Card>
    </Col>
    <Col xs={24} sm={12} xl={6}>
      <Card styles={{ body: { padding: '20px 24px' } }} style={{ borderTop: '3px solid #52c41a' }}>
        <Statistic
          title="接通次数"
          value={summary.answeredCalls}
          prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
          formatter={(v) => fmtInt(Number(v))}
          valueStyle={{ color: '#52c41a', fontWeight: 700 }}
          suffix={
            <Text style={{ fontSize: 13, fontWeight: 400, color: '#52c41a', marginLeft: 6 }}>
              ({fmtPct(summary.answerRate)})
            </Text>
          }
        />
      </Card>
    </Col>
    <Col xs={24} sm={12} xl={6}>
      <Card styles={{ body: { padding: '20px 24px' } }} style={{ borderTop: '3px solid #fa8c16' }}>
        <Statistic
          title="通话时长（分钟）"
          value={summary.totalDuration}
          prefix={<ClockCircleOutlined style={{ color: '#fa8c16' }} />}
          formatter={(v) => fmtInt(Number(v))}
          valueStyle={{ color: '#fa8c16', fontWeight: 700 }}
          suffix="min"
        />
      </Card>
    </Col>
    <Col xs={24} sm={12} xl={6}>
      <Card styles={{ body: { padding: '20px 24px' } }} style={{ borderTop: '3px solid #f5222d' }}>
        <Statistic
          title="本月消费金额"
          value={summary.totalSpend}
          prefix={<DollarOutlined style={{ color: '#f5222d' }} />}
          precision={2}
          formatter={(v) => fmtDec(Number(v))}
          valueStyle={{ color: '#f5222d', fontWeight: 700 }}
          suffix="元"
        />
      </Card>
    </Col>
  </Row>
)

// ─── Tab 1: Daily Stats ───────────────────────────────────────────────────────
interface DailyTabProps {
  daily: DailyStatItem[]
  summary: BillingSummary
}

const DailyTab: React.FC<DailyTabProps> = ({ daily, summary }) => {
  const columns: ColumnsType<DailyStatItem> = [
    {
      title: '日期', dataIndex: 'date', key: 'date', width: 120,
      render: (v: string) => <Text>{v}</Text>,
    },
    {
      title: '拨打量', dataIndex: 'calls', key: 'calls', align: 'right',
      render: (v: number) => fmtInt(v),
      sorter: (a, b) => a.calls - b.calls,
    },
    {
      title: '接通量', dataIndex: 'answered', key: 'answered', align: 'right',
      render: (v: number) => fmtInt(v),
      sorter: (a, b) => a.answered - b.answered,
    },
    {
      title: '接通率', dataIndex: 'answerRate', key: 'answerRate', align: 'right',
      render: (v: number) => (
        <Text style={{ color: v >= 85 ? '#52c41a' : v >= 70 ? '#fa8c16' : '#f5222d' }}>
          {fmtPct(v)}
        </Text>
      ),
      sorter: (a, b) => a.answerRate - b.answerRate,
    },
    {
      title: '通话时长(分钟)', dataIndex: 'duration', key: 'duration', align: 'right',
      render: (v: number) => fmtInt(v),
      sorter: (a, b) => a.duration - b.duration,
    },
    {
      title: '费用(元)', dataIndex: 'cost', key: 'cost', align: 'right',
      render: (v: number) => <Text strong>{fmtDec(v)}</Text>,
      sorter: (a, b) => a.cost - b.cost,
    },
  ]

  const summaryRow: TableProps<DailyStatItem>['summary'] = () => (
    <Table.Summary.Row style={{ background: '#fafafa' }}>
      <Table.Summary.Cell index={0}>
        <Text strong>合计</Text>
      </Table.Summary.Cell>
      <Table.Summary.Cell index={1} align="right">
        <Text strong>{fmtInt(summary.totalCalls)}</Text>
      </Table.Summary.Cell>
      <Table.Summary.Cell index={2} align="right">
        <Text strong>{fmtInt(summary.answeredCalls)}</Text>
      </Table.Summary.Cell>
      <Table.Summary.Cell index={3} align="right">
        <Text strong style={{ color: '#52c41a' }}>{fmtPct(summary.answerRate)}</Text>
      </Table.Summary.Cell>
      <Table.Summary.Cell index={4} align="right">
        <Text strong>{fmtInt(summary.totalDuration)}</Text>
      </Table.Summary.Cell>
      <Table.Summary.Cell index={5} align="right">
        <Text strong style={{ color: '#f5222d' }}>¥ {fmtDec(summary.totalSpend)}</Text>
      </Table.Summary.Cell>
    </Table.Summary.Row>
  )

  return (
    <Table
      dataSource={daily}
      columns={columns}
      rowKey="date"
      size="middle"
      pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (t) => `共 ${t} 条` }}
      summary={summaryRow}
      scroll={{ x: 700 }}
    />
  )
}

// ─── Tab 2: Records ───────────────────────────────────────────────────────────
interface RecordsTabProps {
  records: BillingRecord[]
  loading: boolean
  billingType: BillingType
  dateRange: [dayjs.Dayjs, dayjs.Dayjs]
  onTypeChange: (v: BillingType) => void
  onDateChange: (range: [dayjs.Dayjs, dayjs.Dayjs]) => void
}

const RecordsTab: React.FC<RecordsTabProps> = ({
  records, loading, billingType, dateRange, onTypeChange, onDateChange,
}) => {
  const filtered = useMemo(
    () =>
      records.filter(
        (r) =>
          (billingType === 'all' || r.billingType === billingType) &&
          dayjs(r.time).isAfter(dateRange[0].startOf('day')) &&
          dayjs(r.time).isBefore(dateRange[1].endOf('day')),
      ),
    [records, billingType, dateRange],
  )

  const columns: ColumnsType<BillingRecord> = [
    {
      title: '时间', dataIndex: 'time', key: 'time', width: 170,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
      sorter: (a, b) => dayjs(a.time).unix() - dayjs(b.time).unix(),
      defaultSortOrder: 'descend',
    },
    {
      title: '计费类型', dataIndex: 'billingType', key: 'billingType', width: 110, align: 'center',
      render: (v: Exclude<BillingType, 'all'>) => (
        <Tag color={BT_COLORS[v]}>{BT_LABELS[v]}</Tag>
      ),
    },
    {
      title: '主叫号码', dataIndex: 'callerNumber', key: 'callerNumber', width: 140,
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: '被叫号码', dataIndex: 'calleeNumber', key: 'calleeNumber', width: 140,
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: '通话时长', dataIndex: 'duration', key: 'duration', width: 110, align: 'right',
      render: (v: number) => fmtSec(v),
      sorter: (a, b) => a.duration - b.duration,
    },
    {
      title: '费用(元)', dataIndex: 'cost', key: 'cost', width: 100, align: 'right',
      render: (v: number) => <Text strong style={{ color: '#f5222d' }}>{fmtDec(v)}</Text>,
      sorter: (a, b) => a.cost - b.cost,
    },
  ]

  return (
    <>
      {/* Filter bar */}
      <Space size={12} wrap style={{ marginBottom: 16 }}>
        <Space>
          <Text type="secondary">计费类型：</Text>
          <Select
            value={billingType}
            onChange={onTypeChange}
            style={{ width: 140 }}
            options={[
              { value: 'all', label: '全部' },
              { value: 'minute', label: '分钟计费' },
              { value: 'count', label: '次数计费' },
            ]}
          />
        </Space>
        <Space>
          <Text type="secondary">时间范围：</Text>
          <RangePicker
            value={dateRange}
            onChange={(range) => range && onDateChange(range as [dayjs.Dayjs, dayjs.Dayjs])}
            allowClear={false}
            disabledDate={(d) => d.isAfter(dayjs())}
          />
        </Space>
        <Text type="secondary" style={{ fontSize: 12 }}>
          共 <Text strong>{fmtInt(filtered.length)}</Text> 条记录，
          合计费用 <Text strong style={{ color: '#f5222d' }}>
            ¥ {fmtDec(filtered.reduce((s, r) => s + r.cost, 0))}
          </Text>
        </Text>
      </Space>

      <Table
        dataSource={filtered}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="middle"
        pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        scroll={{ x: 780 }}
      />
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const BillingManagement: React.FC = () => {
  const currentMonth = dayjs().format('YYYY-MM')

  const [summary, setSummary] = useState<BillingSummary>(calcSummary(MOCK_DAILY))
  const [daily, setDaily] = useState<DailyStatItem[]>(MOCK_DAILY)
  const [records, setRecords] = useState<BillingRecord[]>(MOCK_RECORDS)
  const [loading, setLoading] = useState(false)

  // Filter state for Tab 2
  const [billingType, setBillingType] = useState<BillingType>('all')
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf('month'),
    dayjs(),
  ])

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      try {
        const [summaryRes, recordsRes] = await Promise.all([
          billingService.getSummary(currentMonth),
          billingService.getRecords({
            startDate: dayjs().startOf('month').format('YYYY-MM-DD'),
            endDate: dayjs().format('YYYY-MM-DD'),
          }),
        ])
        setSummary(summaryRes.summary)
        setDaily(summaryRes.dailyStats)
        setRecords(recordsRes.records)
      } catch { /* use mock */ } finally { setLoading(false) }
    }
    fetch()
  }, [currentMonth])

  // Memoized derivations
  const memoSummary = useMemo(() => summary, [summary])
  const memoDaily = useMemo(() => daily, [daily])

  const tabItems = [
    {
      key: 'daily',
      label: '拨打统计',
      children: (
        <div style={{ padding: '16px 0' }}>
          <DailyTab daily={memoDaily} summary={memoSummary} />
        </div>
      ),
    },
    {
      key: 'records',
      label: '账单明细',
      children: (
        <div style={{ padding: '16px 0' }}>
          <RecordsTab
            records={records}
            loading={loading}
            billingType={billingType}
            dateRange={dateRange}
            onTypeChange={setBillingType}
            onDateChange={setDateRange}
          />
        </div>
      ),
    },
  ]

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>
        计费管理
      </Typography.Title>

      {/* 统计卡片 */}
      <SummaryCards summary={memoSummary} />

      {/* Tabs */}
      <Card styles={{ body: { padding: '0 24px 24px' } }}>
        <Tabs defaultActiveKey="daily" items={tabItems} />
      </Card>
    </div>
  )
}

export default BillingManagement
