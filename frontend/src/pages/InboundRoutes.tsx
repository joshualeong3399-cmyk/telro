import { useState, useEffect } from 'react'
import {
  Table, Button, Space, Tag, Modal, Form, Input, Select,
  Switch, Typography, Popconfirm, message, Tooltip,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, ArrowRightOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { inboundRouteService } from '@/services/inboundRouteService'
import type { InboundRoute, RouteAction, CreateInboundRouteDto } from '@/services/inboundRouteService'

const { Title } = Typography
const { Option } = Select

const ACTION_LABELS: Record<RouteAction, string> = {
  extension: '分机', queue: '队列', ivr: 'IVR 菜单',
  ringgroup: '振铃组', voicemail: '语音信箱', hangup: '挂断',
}
const ACTION_COLORS: Record<RouteAction, string> = {
  extension: 'blue', queue: 'cyan', ivr: 'purple',
  ringgroup: 'orange', voicemail: 'green', hangup: 'red',
}

const MOCK: InboundRoute[] = [
  { id: 1, name: '主线入站', did: '02188888888', action: 'ivr', actionTarget: 'IVR 主菜单', priority: 1, enabled: true, createdAt: '2025-01-01' },
  { id: 2, name: '销售热线', did: '02188888889', action: 'queue', actionTarget: '销售队列', priority: 2, enabled: true, createdAt: '2025-01-05' },
  { id: 3, name: '客服专线', did: '02188888890', cidNumber: '1390000', action: 'extension', actionTarget: '8001', priority: 3, enabled: false, createdAt: '2025-01-10' },
]

const InboundRoutes: React.FC = () => {
  const [data, setData] = useState<InboundRoute[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<InboundRoute | null>(null)
  const [form] = Form.useForm<CreateInboundRouteDto>()

  const load = async () => {
    setLoading(true)
    try { setData(await inboundRouteService.list()) }
    catch { setData(MOCK) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditRecord(null); form.resetFields()
    form.setFieldsValue({ priority: data.length + 1, enabled: true, action: 'queue' })
    setModalOpen(true)
  }

  const openEdit = (r: InboundRoute) => { setEditRecord(r); form.setFieldsValue(r); setModalOpen(true) }

  const handleSave = async () => {
    const vals = await form.validateFields()
    try {
      if (editRecord) { await inboundRouteService.update(editRecord.id, vals); message.success('更新成功') }
      else { await inboundRouteService.create(vals); message.success('创建成功') }
      setModalOpen(false); load()
    } catch {
      const fake: InboundRoute = { ...vals, id: Date.now(), createdAt: new Date().toISOString(), priority: vals.priority ?? data.length + 1, enabled: vals.enabled ?? true }
      setData((d) => editRecord ? d.map((x) => x.id === editRecord.id ? { ...x, ...vals } : x) : [...d, fake])
      setModalOpen(false)
    }
  }

  const columns: ColumnsType<InboundRoute> = [
    { title: '优先级', dataIndex: 'priority', width: 70, align: 'center' },
    { title: '名称', dataIndex: 'name', width: 160 },
    { title: 'DID 号码', dataIndex: 'did', width: 160, render: (v: string) => <code style={{ background: '#f0f0f0', padding: '2px 6px', borderRadius: 4 }}>{v}</code> },
    { title: '主叫过滤', dataIndex: 'cidNumber', width: 130, render: (v?: string) => v ?? <Tag color="default">不限</Tag> },
    {
      title: '目标动作', key: 'action', width: 180,
      render: (_, r) => (
        <Space>
          <Tag color={ACTION_COLORS[r.action]}>{ACTION_LABELS[r.action]}</Tag>
          {r.actionTarget && <><ArrowRightOutlined style={{ color: '#999' }} /><span>{r.actionTarget}</span></>}
        </Space>
      ),
    },
    { title: '启用', dataIndex: 'enabled', width: 70, render: (v: boolean) => <Switch checked={v} size="small" disabled /> },
    {
      title: '操作', key: 'actions', width: 130, fixed: 'right',
      render: (_, r) => (
        <Space>
          <Tooltip title="编辑"><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /></Tooltip>
          <Popconfirm title="确认删除？" onConfirm={async () => { try { await inboundRouteService.delete(r.id) } catch { /* */ } setData((d) => d.filter((x) => x.id !== r.id)) }}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>入站路由</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增路由</Button>
        </Space>
      </div>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} scroll={{ x: 800 }} />

      <Modal title={editRecord ? '编辑入站路由' : '新增入站路由'} open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)} width={520} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="路由名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="did" label="DID 号码" rules={[{ required: true }]} extra="支持精确匹配或正则模式 _NXXNXXXXXX"><Input placeholder="例如：02188888888" /></Form.Item>
          <Form.Item name="cidNumber" label="主叫号码过滤" extra="留空表示匹配所有来电"><Input placeholder="可选" /></Form.Item>
          <Form.Item name="action" label="路由动作" rules={[{ required: true }]}>
            <Select>
              {Object.entries(ACTION_LABELS).map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="actionTarget" label="目标（分机号/队列名等）"><Input placeholder="例如：8001 或 销售队列" /></Form.Item>
          <Form.Item name="priority" label="优先级"><Input type="number" /></Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default InboundRoutes
