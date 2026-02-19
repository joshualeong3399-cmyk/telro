import { useState, useEffect, useRef } from 'react'
import {
  Table, Button, Space, Tag, Typography, Popconfirm, message, Tooltip,
  Select, Badge, Slider, Card, Row, Col, Statistic, Empty,
} from 'antd'
import {
  DeleteOutlined, ReloadOutlined, PlayCircleOutlined, PauseCircleOutlined,
  MailOutlined, AudioOutlined, CheckOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { voicemailService } from '@/services/voicemailService'
import type { Voicemail } from '@/services/voicemailService'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { Option } = Select

function fmtDuration(s: number) {
  const m = Math.floor(s / 60); const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

const MOCK: Voicemail[] = [
  { id: 1, mailbox: '8001', callerId: '张三', callerIdNumber: '13812345678', duration: 42, folder: 'INBOX', listened: false, filename: 'msg0001.wav', createdAt: '2025-02-19 09:15:00' },
  { id: 2, mailbox: '8001', callerId: '李四', callerIdNumber: '13987654321', duration: 78, folder: 'INBOX', listened: true, filename: 'msg0002.wav', createdAt: '2025-02-18 16:30:00', transcription: '您好，我想咨询一下产品价格，请回电...' },
  { id: 3, mailbox: '8002', callerId: '未知', callerIdNumber: '02155551234', duration: 15, folder: 'Old', listened: true, filename: 'msg0003.wav', createdAt: '2025-02-17 14:00:00' },
  { id: 4, mailbox: '8003', callerId: '客户A', callerIdNumber: '13600001111', duration: 120, folder: 'INBOX', listened: false, filename: 'msg0004.wav', createdAt: '2025-02-19 10:00:00', transcription: '我是客户A，关于上次签约的事情需要确认一些细节...' },
]

interface AudioPlayerState {
  voicemailId: number
  playing: boolean
  progress: number   // 0-100
  duration: number
  currentTime: number
}

const VoicemailPage: React.FC = () => {
  const [data, setData] = useState<Voicemail[]>([])
  const [loading, setLoading] = useState(false)
  const [folderFilter, setFolderFilter] = useState<string>('INBOX')
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([])
  const [player, setPlayer] = useState<AudioPlayerState | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await voicemailService.list({ folder: folderFilter })
      setData(res.data)
    } catch {
      setData(MOCK.filter((m) => m.folder === folderFilter))
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [folderFilter])

  const stopPlayer = () => {
    audioRef.current?.pause()
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setPlayer(null)
  }

  const handlePlay = async (vm: Voicemail) => {
    if (player?.voicemailId === vm.id) { stopPlayer(); return }
    stopPlayer()
    // Mark as listened
    try { await voicemailService.markListened(vm.id) } catch { /* */ }
    setData((d) => d.map((x) => x.id === vm.id ? { ...x, listened: true } : x))

    const url = voicemailService.getAudioUrl(vm.id)
    const audio = new Audio(url)
    audio.onerror = () => {
      // Demo: simulate playback
      setPlayer({ voicemailId: vm.id, playing: true, progress: 0, duration: vm.duration, currentTime: 0 })
      timerRef.current = setInterval(() => {
        setPlayer((p) => {
          if (!p || p.currentTime >= p.duration) { if (timerRef.current) clearInterval(timerRef.current); return null }
          const next = p.currentTime + 1
          return { ...p, currentTime: next, progress: Math.round((next / p.duration) * 100) }
        })
      }, 1000)
    }
    audioRef.current = audio
    audio.play().catch(() => audio.onerror?.(new Event('error')))
    setPlayer({ voicemailId: vm.id, playing: true, progress: 0, duration: vm.duration, currentTime: 0 })
  }

  const handleDelete = async (id: number) => {
    try { await voicemailService.delete(id) } catch { /* */ }
    setData((d) => d.filter((x) => x.id !== id))
  }

  const handleBatchDelete = async () => {
    try { await voicemailService.deleteBatch(selectedRowKeys) } catch { /* */ }
    setData((d) => d.filter((x) => !selectedRowKeys.includes(x.id)))
    setSelectedRowKeys([])
    message.success('已删除所选留言')
  }

  const columns: ColumnsType<Voicemail> = [
    {
      title: '状态', dataIndex: 'listened', width: 70, align: 'center',
      render: (v: boolean) => v ? <Badge status="default" /> : <Badge status="processing" text="" />,
    },
    { title: '信箱', dataIndex: 'mailbox', width: 80, render: (v: string) => <Tag>{v}</Tag> },
    { title: '来电显示', key: 'caller', width: 170, render: (_, r) => <><Text>{r.callerId}</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>{r.callerIdNumber}</Text></> },
    { title: '时长', dataIndex: 'duration', width: 80, render: (v: number) => <Tag icon={<AudioOutlined />}>{fmtDuration(v)}</Tag> },
    {
      title: '转写内容', dataIndex: 'transcription', width: 260, ellipsis: true,
      render: (v?: string) => v ? <Text type="secondary" italic>{v}</Text> : <Text type="secondary">—</Text>,
    },
    { title: '时间', dataIndex: 'createdAt', width: 150, render: (v: string) => dayjs(v).format('MM-DD HH:mm') },
    {
      title: '操作', key: 'op', width: 120, fixed: 'right',
      render: (_, r) => (
        <Space>
          <Tooltip title={player?.voicemailId === r.id ? '停止' : '播放'}>
            <Button
              size="small"
              type={player?.voicemailId === r.id ? 'primary' : 'default'}
              icon={player?.voicemailId === r.id ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={() => handlePlay(r)}
            />
          </Tooltip>
          {!r.listened && (
            <Tooltip title="标记已读">
              <Button size="small" icon={<CheckOutlined />} onClick={async () => { try { await voicemailService.markListened(r.id) } catch { /* */ } setData((d) => d.map((x) => x.id === r.id ? { ...x, listened: true } : x)) }} />
            </Tooltip>
          )}
          <Popconfirm title="确认删除此留言？" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const unread = data.filter((d) => !d.listened).length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}><MailOutlined /> 语音信箱</Title>
        <Space>
          <Select value={folderFilter} onChange={setFolderFilter} style={{ width: 120 }}>
            {['INBOX', 'Old', 'Work', 'Family', 'Friends'].map((f) => <Option key={f} value={f}>{f}</Option>)}
          </Select>
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
          {selectedRowKeys.length > 0 && (
            <Popconfirm title={`确认删除 ${selectedRowKeys.length} 条留言？`} onConfirm={handleBatchDelete}>
              <Button danger>批量删除 ({selectedRowKeys.length})</Button>
            </Popconfirm>
          )}
        </Space>
      </div>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { title: '总留言数', value: data.length, color: '#1677ff' },
          { title: '未读', value: unread, color: '#fa541c' },
        ].map((c) => (
          <Col key={c.title} xs={12} sm={6}>
            <Card size="small" style={{ borderTop: `3px solid ${c.color}`, borderRadius: 8 }}>
              <Statistic title={c.title} value={c.value} valueStyle={{ color: c.color }} />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Player bar */}
      {player && (
        <Card size="small" style={{ marginBottom: 16, background: '#e6f4ff', border: '1px solid #91caff' }}>
          <Space style={{ width: '100%' }} align="center">
            <PlayCircleOutlined style={{ color: '#1677ff', fontSize: 20 }} />
            <Text strong style={{ minWidth: 80 }}>{fmtDuration(player.currentTime)} / {fmtDuration(player.duration)}</Text>
            <Slider value={player.progress} style={{ flex: 1, minWidth: 200 }} tooltip={{ formatter: null }} />
            <Button size="small" onClick={stopPlayer}>停止</Button>
          </Space>
        </Card>
      )}

      {data.length === 0 && !loading
        ? <Empty description="当前文件夹无留言" />
        : (
          <Table
            columns={columns}
            dataSource={data}
            rowKey="id"
            loading={loading}
            scroll={{ x: 860 }}
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys as number[]),
            }}
            rowClassName={(r) => r.listened ? '' : 'voicemail-unread'}
          />
        )
      }
      <style>{`.voicemail-unread td { font-weight: 600; }`}</style>
    </div>
  )
}

export default VoicemailPage
