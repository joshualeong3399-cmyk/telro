import { useState, useEffect, useCallback } from 'react'
import {
  Card, Table, Button, Input, Space, Typography,
  DatePicker, Popconfirm, message, Tooltip,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlayCircleOutlined, DownloadOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { recordingService } from '@/services/recordingService'
import type { Recording } from '@/services/recordingService'

const { RangePicker } = DatePicker

const fmtSec = (s: number) => {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}m ${String(sec).padStart(2, '0')}s` : `${s}s`
}

const fmtSize = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${(bytes / 1024).toFixed(0)} KB`

// Deterministic mock recordings
const MOCK_RECORDINGS: Recording[] = Array.from({ length: 42 }, (_, i) => {
  const duration = 30 + (i * 73) % 350
  const t = dayjs().subtract(i * 43, 'minute')
  return {
    id: i + 1,
    filename: `${t.format('YYYYMMDD-HHmmss')}-0755881${String(1000 + i).slice(1)}-138${String(10000000 + i * 1234321).slice(0, 8)}.wav`,
    duration,
    size: duration * 8000,
    time: t.toISOString(),
    url: `/recordings/rec-${i + 1}.wav`,
  }
})

const RecordingManagement: React.FC = () => {
  const [data, setData] = useState<Recording[]>(MOCK_RECORDINGS)
  const [total, setTotal] = useState(MOCK_RECORDINGS.length)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(7, 'day'), dayjs(),
  ])
  // id of the row currently expanded (playing audio)
  const [playingId, setPlayingId] = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await recordingService.list({
        page,
        pageSize: 10,
        keyword,
        startDate: dateRange[0].format('YYYY-MM-DD'),
        endDate: dateRange[1].format('YYYY-MM-DD'),
      })
      setData(res.records)
      setTotal(res.total)
    } catch { /* use mock */ } finally { setLoading(false) }
  }, [page, keyword, dateRange])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDelete = async (id: number) => {
    try { await recordingService.remove(id) } catch { /* ignore */ }
    setData(prev => prev.filter(r => r.id !== id))
    if (playingId === id) setPlayingId(null)
    setTotal(prev => prev - 1)
    message.success('删除成功')
  }

  const handleDownload = (rec: Recording) => {
    const a = document.createElement('a')
    a.href = rec.url
    a.download = rec.filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const togglePlay = (id: number) =>
    setPlayingId(prev => (prev === id ? null : id))

  const columns: ColumnsType<Recording> = [
    {
      title: '文件名', dataIndex: 'filename', key: 'filename',
      ellipsis: { showTitle: false },
      render: (v: string) => (
        <Tooltip title={v} placement="topLeft">
          <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span>
        </Tooltip>
      ),
    },
    {
      title: '时长', dataIndex: 'duration', key: 'duration', width: 90, align: 'right',
      render: (v: number) => fmtSec(v),
      sorter: (a, b) => a.duration - b.duration,
    },
    {
      title: '大小', dataIndex: 'size', key: 'size', width: 90, align: 'right',
      render: (v: number) => fmtSize(v),
      sorter: (a, b) => a.size - b.size,
    },
    {
      title: '时间', dataIndex: 'time', key: 'time', width: 165,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
      sorter: (a, b) => dayjs(a.time).unix() - dayjs(b.time).unix(),
      defaultSortOrder: 'descend',
    },
    {
      title: '操作', key: 'action', width: 170, align: 'center',
      render: (_, record) => (
        <Space size={0}>
          <Tooltip title={playingId === record.id ? '收起播放器' : '播放'}>
            <Button
              type="link"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => togglePlay(record.id)}
            >
              {playingId === record.id ? '收起' : '播放'}
            </Button>
          </Tooltip>
          <Tooltip title="下载">
            <Button
              type="link"
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(record)}
            >
              下载
            </Button>
          </Tooltip>
          <Popconfirm title="确定删除该录音文件？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // Inline audio player rendered as expanded row
  const expandedRowRender = (record: Recording) => (
    <div style={{ padding: '8px 48px' }}>
      <audio
        key={record.id}
        src={record.url}
        controls
        autoPlay
        style={{ width: '100%' }}
      />
    </div>
  )

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>录音管理</Typography.Title>
      <Card>
        <Space size={8} wrap style={{ marginBottom: 16 }}>
          <Input.Search
            placeholder="搜索文件名..."
            style={{ width: 280 }}
            allowClear
            onSearch={(v) => { setPage(1); setKeyword(v) }}
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
          expandable={{
            expandedRowKeys: playingId !== null ? [playingId] : [],
            expandedRowRender,
            showExpandColumn: false,
          }}
          pagination={{
            current: page, pageSize: 10, total,
            onChange: p => { setPage(p); setPlayingId(null) },
            showSizeChanger: false,
            showTotal: t => `共 ${t} 条`,
          }}
        />
      </Card>
    </div>
  )
}

export default RecordingManagement
