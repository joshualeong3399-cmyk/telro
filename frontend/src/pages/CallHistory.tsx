import { useState, useEffect, useCallback } from 'react'
import {
  Card, Table, Input, Space, Tag, Button, Select, Typography,
  DatePicker, Modal, Tooltip,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlayCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { callHistoryService } from '@/services/callHistoryService'
import type { CallRecord, CallStatus } from '@/services/callHistoryService'

const { RangePicker } = DatePicker

const STATUS_CONFIG: Record<CallStatus, { label: string; color: string }> = {
  answered: { label: '接通', color: 'green' },
  missed:   { label: '未接', color: 'red' },
  busy:     { label: '忙音', color: 'orange' },
  failed:   { label: '失败', color: 'default' },
}

const fmtSec = (s: number) => {
  if (s === 0) return '—'
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}m ${String(sec).padStart(2, '0')}s` : `${s}s`
}

// Deterministic mock data
const CALL_STATUSES: CallStatus[] = ['answered', 'missed', 'busy', 'answered', 'answered']
const MOCK_CALLS: CallRecord[] = Array.from({ length: 55 }, (_, i) => {
  const status = CALL_STATUSES[i % 5]
  return {
    id: i + 1,
    caller: `075588${String(100000 + i * 137).slice(0, 6)}`,
    callee: `1${['38', '36', '57', '89'][i % 4]}${String(10000000 + i * 1234321).slice(0, 8)}`,
    time: dayjs().subtract(i * 28, 'minute').toISOString(),
    duration: status === 'answered' ? 30 + (i * 73) % 270 : 0,
    status,
    recording: status === 'answered' && i % 2 === 0 ? `/recordings/rec-${i + 1}.wav` : null,
  }
})

const CallHistory: React.FC = () => {
  const [data, setData] = useState<CallRecord[]>(MOCK_CALLS)
  const [total, setTotal] = useState(MOCK_CALLS.length)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<CallStatus | 'all'>('all')
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(7, 'day'), dayjs(),
  ])
  const [playUrl, setPlayUrl] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await callHistoryService.list({
        page,
        pageSize: 10,
        keyword,
        status: statusFilter,
        startDate: dateRange[0].format('YYYY-MM-DD'),
        endDate: dateRange[1].format('YYYY-MM-DD'),
      })
      setData(res.records)
      setTotal(res.total)
    } catch { /* use mock */ } finally { setLoading(false) }
  }, [page, keyword, statusFilter, dateRange])

  useEffect(() => { fetchData() }, [fetchData])

  const columns: ColumnsType<CallRecord> = [
    {
      title: '主叫', dataIndex: 'caller', key: 'caller', width: 140,
      render: (v: string) => <span style={{ fontFamily: 'monospace' }}>{v}</span>,
    },
    {
      title: '被叫', dataIndex: 'callee', key: 'callee', width: 140,
      render: (v: string) => <span style={{ fontFamily: 'monospace' }}>{v}</span>,
    },
    {
      title: '时间', dataIndex: 'time', key: 'time', width: 165,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
      sorter: (a, b) => dayjs(a.time).unix() - dayjs(b.time).unix(),
      defaultSortOrder: 'descend',
    },
    {
      title: '时长', dataIndex: 'duration', key: 'duration', width: 90, align: 'right',
      render: (v: number) => fmtSec(v),
      sorter: (a, b) => a.duration - b.duration,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80, align: 'center',
      render: (s: CallStatus) => <Tag color={STATUS_CONFIG[s].color}>{STATUS_CONFIG[s].label}</Tag>,
    },
    {
      title: '录音', key: 'recording', width: 70, align: 'center',
      render: (_, record) =>
        record.recording ? (
          <Tooltip title="播放录音">
            <Button
              type="link"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => setPlayUrl(record.recording)}
            />
          </Tooltip>
        ) : (
          <span style={{ color: '#d9d9d9' }}>—</span>
        ),
    },
  ]

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>通话记录</Typography.Title>
      <Card>
        <Space size={8} wrap style={{ marginBottom: 16 }}>
          <Input.Search
            placeholder="搜索主叫/被叫号码..."
            style={{ width: 240 }}
            allowClear
            onSearch={(v) => { setPage(1); setKeyword(v) }}
          />
          <Select
            value={statusFilter}
            onChange={v => { setStatusFilter(v); setPage(1) }}
            style={{ width: 120 }}
            options={[
              { value: 'all', label: '全部状态' },
              ...Object.entries(STATUS_CONFIG).map(([v, c]) => ({ value: v, label: c.label })),
            ]}
          />
          <RangePicker
            value={dateRange}
            onChange={r => r && setDateRange(r as [dayjs.Dayjs, dayjs.Dayjs])}
            allowClear={false}
            disabledDate={d => d.isAfter(dayjs())}
          />
        </Space>

        <Table
          dataSource={data}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="middle"
          pagination={{
            current: page, pageSize: 10, total,
            onChange: p => setPage(p),
            showSizeChanger: false,
            showTotal: t => `共 ${t} 条`,
          }}
        />
      </Card>

      {/* 录音播放弹窗 */}
      <Modal
        title="录音播放"
        open={!!playUrl}
        onCancel={() => setPlayUrl(null)}
        footer={null}
        width={400}
        destroyOnClose
      >
        {playUrl && (
          <audio
            src={playUrl}
            controls
            autoPlay
            style={{ width: '100%', marginTop: 8 }}
          />
        )}
      </Modal>
    </div>
  )
}

export default CallHistory
