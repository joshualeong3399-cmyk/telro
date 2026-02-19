import { useState, useEffect } from 'react'
import {
  Table, Button, Space, Tag, Modal, Form, Input, InputNumber,
  Switch, Typography, Popconfirm, message, Tooltip,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { outboundRouteService } from '@/services/outboundRouteService'
import type { OutboundRoute, CreateOutboundRouteDto } from '@/services/outboundRouteService'

const { Title } = Typography

const MOCK: OutboundRoute[] = [
  { id: 1, name: '本地通话', pattern: '_0NXXXXXXXX', stripDigits: 0, trunkId: 1, trunkName: '主干线1', priority: 1, enabled: true, createdAt: '2025-01-01', description: '本地11位号码' },
  { id: 2, name: '长途通话', pattern: '_0[^89]NXXXXXX', stripDigits: 0, trunkId: 1, trunkName: '主干线1', priority: 2, enabled: true, createdAt: '2025-01-05', description: '国内长途' },
  { id: 3, name: '国际通话', pattern: '_00.', stripDigits: 0, trunkId: 2, trunkName: '备用干线', priority: 3, enabled: false, createdAt: '2025-01-10', description: '国际00开头' },
]

const OutboundRoutes: React.FC = () => {
  const [data, setData] = useState<OutboundRoute[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<OutboundRoute | null>(null)
  const [form] = Form.useForm<CreateOutboundRouteDto>()

  const load = async () => {
    setLoading(true)
    try { setData(await outboundRouteService.list()) }
    catch { setData(MOCK) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditRecord(null); form.resetFields()
    form.setFieldsValue({ stripDigits: 0, priority: data.length + 1, enabled: true })
    setModalOpen(true)
  }

  const openEdit = (r: OutboundRoute) => { setEditRecord(r); form.setFieldsValue(r); setModalOpen(true) }

  const handleSave = async () => {
    const vals = await form.validateFields()
    try {
      if (editRecord) { await outboundRouteService.update(editRecord.id, vals); message.success('更新成功') }
      else { await outboundRouteService.create(vals); message.success('创建成功') }
      setModalOpen(false); load()
    } catch {
      const fake: OutboundRoute = { ...vals, id: Date.now(), trunkName: '中继', priority: vals.priority ?? data.length + 1, enabled: vals.enabled ?? true, createdAt: new Date().toISOString() }
      setData((d) => editRecord ? d.map((x) => x.id === editRecord.id ? { ...x, ...vals } : x) : [...d, fake])
      setModalOpen(false)
    }
  }

  const columns: ColumnsType<OutboundRoute> = [
    { title: '优先级', dataIndex: 'priority', width: 70, align: 'center' },
    { title: '名称', dataIndex: 'name', width: 160 },
    { title: '拨号模式', dataIndex: 'pattern', width: 180, render: (v: string) => <code style={{ background: '#f0f0f0', padding: '2px 6px', borderRadius: 4 }}>{v}</code> },
    { title: '去除前缀位数', dataIndex: 'stripDigits', width: 100, align: 'center' },
    { title: '前缀追加', dataIndex: 'prepend', width: 100, render: (v?: string) => v ?? '-' },
    { title: '绑定中继', dataIndex: 'trunkName', width: 130, render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: '备注', dataIndex: 'description', width: 160, ellipsis: true },
    { title: '启用', dataIndex: 'enabled', width: 70, render: (v: boolean) => <Switch checked={v} size="small" disabled /> },
    {
      title: '操作', key: 'actions', width: 100, fixed: 'right',
      render: (_, r) => (
        <Space>
          <Tooltip title="编辑"><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /></Tooltip>
          <Popconfirm title="确认删除？" onConfirm={async () => { try { await outboundRouteService.delete(r.id) } catch { /* */ } setData((d) => d.filter((x) => x.id !== r.id)) }}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>出站路由</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增路由</Button>
        </Space>
      </div>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} scroll={{ x: 900 }} />

      <Modal title={editRecord ? '编辑出站路由' : '新增出站路由'} open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)} width={520} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="路由名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="pattern" label="拨号模式" rules={[{ required: true }]} extra="支持 Asterisk 拨号规则，如 _9NXXNXXXXXX"><Input placeholder="_NXXXXXXXX" /></Form.Item>
          <Form.Item name="trunkId" label="绑定中继 ID" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} /></Form.Item>
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="stripDigits" label="去除前缀位数" style={{ width: '50%' }}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="prepend" label="追加前缀" style={{ width: '50%' }}><Input placeholder="可选" /></Form.Item>
          </Space.Compact>
          <Form.Item name="callerId" label="强制主叫 ID"><Input placeholder="可选，覆盖主叫号码" /></Form.Item>
          <Form.Item name="priority" label="优先级"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="description" label="备注"><Input /></Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default OutboundRoutes
