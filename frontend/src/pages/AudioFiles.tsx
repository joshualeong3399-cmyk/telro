import { useState, useEffect, useRef } from 'react'
import {
  Table, Button, Space, Tag, Typography, Popconfirm, message, Tooltip,
  Upload, Card, Row, Col, Statistic, Input, Progress, Modal, Form, Select,
} from 'antd'
import {
  UploadOutlined, DeleteOutlined, ReloadOutlined, PlayCircleOutlined,
  PauseCircleOutlined, SoundOutlined, EditOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { UploadProps } from 'antd'
import { audioFileService } from '@/services/audioFileService'
import type { AudioFile } from '@/services/audioFileService'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { Option } = Select

function fmtDuration(s: number) {
  const m = Math.floor(s / 60); const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}
function fmtSize(bytes: number) {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${Math.round(bytes / 1024)} KB`
}

const CATEGORIES = ['提示音', '等待音乐', 'IVR 话术', '问候语', '其他']

const MOCK: AudioFile[] = [
  { id: 1, name: '欢迎语', filename: 'welcome.wav', duration: 8, size: 128000, format: 'wav', category: '问候语', usedIn: ['主菜单 IVR'], createdAt: '2025-01-01' },
  { id: 2, name: '等待音乐', filename: 'hold_music.mp3', duration: 180, size: 2880000, format: 'mp3', category: '等待音乐', usedIn: ['销售队列', '客服队列'], createdAt: '2025-01-05' },
  { id: 3, name: '非工作时间提示', filename: 'afterhours.wav', duration: 12, size: 192000, format: 'wav', category: 'IVR 话术', usedIn: ['非工作时间 IVR'], createdAt: '2025-01-10' },
  { id: 4, name: '按键提示', filename: 'dtmf_menu.wav', duration: 20, size: 320000, format: 'wav', category: 'IVR 话术', usedIn: [], createdAt: '2025-01-15' },
]

const AudioFiles: React.FC = () => {
  const [data, setData] = useState<AudioFile[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<AudioFile | null>(null)
  const [playingId, setPlayingId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [form] = Form.useForm()
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const load = async () => {
    setLoading(true)
    try { setData(await audioFileService.list()) }
    catch { setData(MOCK) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handlePlay = (id: number) => {
    if (playingId === id) { audioRef.current?.pause(); setPlayingId(null); return }
    audioRef.current?.pause()
    const audio = new Audio(audioFileService.getPlayUrl(id))
    audio.onerror = () => { message.info('音频播放演示（实际需后端支持）') }
    audio.onended = () => setPlayingId(null)
    audioRef.current = audio
    audio.play().catch(() => { message.info('音频播放演示模式'); setPlayingId(id); setTimeout(() => setPlayingId(null), 3000) })
    setPlayingId(id)
  }

  const uploadProps: UploadProps = {
    accept: '.wav,.mp3,.gsm',
    showUploadList: false,
    beforeUpload: (file) => {
      const isValid = ['audio/wav', 'audio/mpeg', 'audio/x-wav'].includes(file.type) || file.name.match(/\.(wav|mp3|gsm)$/i)
      if (!isValid) { message.error('只支持 WAV、MP3、GSM 格式'); return Upload.LIST_IGNORE }
      if (file.size > 20 * 1024 * 1024) { message.error('文件不能超过 20MB'); return Upload.LIST_IGNORE }
      return true
    },
    customRequest: async ({ file, onSuccess, onError: _onError, onProgress: _onProgress }) => {
      setUploading(true); setUploadProgress(0)
      const interval = setInterval(() => setUploadProgress((p) => Math.min(p + 20, 90)), 300)
      try {
        const res = await audioFileService.upload(file as File, { name: (file as File).name.replace(/\.[^.]+$/, ''), category: '其他' })
        setData((d) => [res, ...d])
        message.success(`${(file as File).name} 上传成功`)
        onSuccess?.({})
      } catch {
        const fake: AudioFile = { id: Date.now(), name: (file as File).name.replace(/\.[^.]+$/, ''), filename: (file as File).name, duration: 0, size: (file as File).size, format: (file as File).name.split('.').pop() ?? 'wav', usedIn: [], createdAt: new Date().toISOString() }
        setData((d) => [fake, ...d])
        message.success(`${(file as File).name} 上传成功（演示）`)
        onSuccess?.({})
      } finally {
        clearInterval(interval); setUploadProgress(100)
        setTimeout(() => { setUploading(false); setUploadProgress(0) }, 500)
      }
    },
  }

  const handleEdit = (r: AudioFile) => { setEditRecord(r); form.setFieldsValue(r); setEditModalOpen(true) }
  const handleEditSave = async () => {
    const vals = await form.validateFields()
    try { await audioFileService.update(editRecord!.id, vals) } catch { /* */ }
    setData((d) => d.map((x) => x.id === editRecord!.id ? { ...x, ...vals } : x))
    setEditModalOpen(false); message.success('更新成功')
  }

  const filtered = data.filter((d) => !search || d.name.includes(search) || d.filename.includes(search))

  const columns: ColumnsType<AudioFile> = [
    {
      title: '名称', dataIndex: 'name', width: 160,
      render: (v: string, r) => (
        <Space>
          <SoundOutlined style={{ color: playingId === r.id ? '#1677ff' : '#bbb' }} />
          <Text strong>{v}</Text>
        </Space>
      ),
    },
    { title: '文件名', dataIndex: 'filename', width: 180, render: (v: string) => <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text> },
    { title: '格式', dataIndex: 'format', width: 70, render: (v: string) => <Tag>{v.toUpperCase()}</Tag> },
    { title: '时长', dataIndex: 'duration', width: 80, render: (v: number) => fmtDuration(v) },
    { title: '大小', dataIndex: 'size', width: 90, render: (v: number) => fmtSize(v) },
    { title: '分类', dataIndex: 'category', width: 100, render: (v?: string) => v ? <Tag color="blue">{v}</Tag> : '-' },
    {
      title: '使用情况', dataIndex: 'usedIn', width: 180,
      render: (v: string[]) => v.length > 0
        ? v.map((n) => <Tag key={n} color="cyan">{n}</Tag>)
        : <Tag color="default">未使用</Tag>,
    },
    { title: '上传时间', dataIndex: 'createdAt', width: 120, render: (v: string) => dayjs(v).format('MM-DD HH:mm') },
    {
      title: '操作', key: 'op', width: 140, fixed: 'right',
      render: (_, r) => (
        <Space>
          <Tooltip title={playingId === r.id ? '停止' : '播放'}>
            <Button size="small" type={playingId === r.id ? 'primary' : 'default'} icon={playingId === r.id ? <PauseCircleOutlined /> : <PlayCircleOutlined />} onClick={() => handlePlay(r.id)} />
          </Tooltip>
          <Tooltip title="重命名"><Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)} /></Tooltip>
          <Popconfirm title={r.usedIn.length > 0 ? `该文件被 ${r.usedIn.length} 处使用，确认删除？` : '确认删除？'} onConfirm={async () => { try { await audioFileService.delete(r.id) } catch { /* */ } setData((d) => d.filter((x) => x.id !== r.id)) }}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const totalSize = data.reduce((s, d) => s + d.size, 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}><SoundOutlined /> 音频文件管理</Title>
        <Space>
          <Input.Search placeholder="搜索文件名" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 200 }} allowClear />
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
          <Upload {...uploadProps}>
            <Button type="primary" icon={<UploadOutlined />} loading={uploading}>上传音频</Button>
          </Upload>
        </Space>
      </div>

      {uploading && <Progress percent={uploadProgress} style={{ marginBottom: 12 }} />}

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { title: '文件总数', value: data.length, color: '#1677ff', suffix: '个' },
          { title: '总占用空间', value: fmtSize(totalSize), color: '#722ed1', suffix: '' },
          { title: '在用文件', value: data.filter((d) => d.usedIn.length > 0).length, color: '#52c41a', suffix: '个' },
        ].map((c) => (
          <Col key={c.title} xs={12} sm={8}>
            <Card size="small" style={{ borderTop: `3px solid ${c.color}`, borderRadius: 8 }}>
              <Statistic title={c.title} value={c.value} suffix={c.suffix} valueStyle={{ color: c.color }} />
            </Card>
          </Col>
        ))}
      </Row>

      <Table columns={columns} dataSource={filtered} rowKey="id" loading={loading} scroll={{ x: 1000 }} />

      <Modal title="编辑音频文件" open={editModalOpen} onOk={handleEditSave} onCancel={() => setEditModalOpen(false)} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="文件名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="category" label="分类"><Select allowClear placeholder="选择分类">{CATEGORIES.map((c) => <Option key={c} value={c}>{c}</Option>)}</Select></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default AudioFiles
