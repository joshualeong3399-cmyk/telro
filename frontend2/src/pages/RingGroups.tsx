import { useState, useEffect } from 'react'
import {
  Table, Button, Space, Tag, Modal, Form, Input, InputNumber, Select,
  Switch, Typography, Popconfirm, message, Tooltip, Transfer,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, TeamOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { ringGroupService } from '@/services/ringGroupService'
import type { RingGroup, RingStrategy, CreateRingGroupDto } from '@/services/ringGroupService'

const { Title } = Typography
const { Option } = Select

const STRATEGY_LABELS: Record<RingStrategy, string> = {
  ringall: '同时振铃', hunt: '顺序振铃', memoryhunt: '记忆顺序',
  firstavailable: '第一个空闲', random: '随机',
}

const MOCK: RingGroup[] = [
  { id: 1, name: '销售组A', extension: '7001', strategy: 'ringall', ringTimeout: 30, members: [{ extensionId: 1, extensionNumber: '8001', name: '张明', order: 1 }, { extensionId: 2, extensionNumber: '8002', name: '李华', order: 2 }], enabled: true, createdAt: '2025-01-01' },
  { id: 2, name: '客服组', extension: '7002', strategy: 'hunt', ringTimeout: 20, members: [{ extensionId: 3, extensionNumber: '8003', name: '王芳', order: 1 }], enabled: true, createdAt: '2025-01-05' },
  { id: 3, name: '技术支持', extension: '7003', strategy: 'random', ringTimeout: 25, members: [], enabled: false, failoverDestination: '9000', createdAt: '2025-01-10' },
]

// Mock available extensions for Transfer component
const AVAILABLE_EXTENSIONS = [
  { key: '1', title: '8001 - 张明' },
  { key: '2', title: '8002 - 李华' },
  { key: '3', title: '8003 - 王芳' },
  { key: '4', title: '8004 - 陈刚' },
  { key: '5', title: '8005 - 刘梅' },
]

const RingGroups: React.FC = () => {
  const [data, setData] = useState<RingGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<RingGroup | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [targetKeys, setTargetKeys] = useState<string[]>([])
  const [form] = Form.useForm<CreateRingGroupDto>()

  const load = async () => {
    setLoading(true)
    try { setData(await ringGroupService.list()) }
    catch { setData(MOCK) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditRecord(null); form.resetFields()
    form.setFieldsValue({ strategy: 'ringall', ringTimeout: 30, enabled: true })
    setTargetKeys([])
    setModalOpen(true)
  }

  const openEdit = (r: RingGroup) => {
    setEditRecord(r)
    form.setFieldsValue(r)
    setTargetKeys(r.members.map((m) => String(m.extensionId)))
    setModalOpen(true)
  }

  const handleSave = async () => {
    const vals = await form.validateFields()
    const dto: CreateRingGroupDto = { ...vals, memberIds: targetKeys.map(Number) }
    try {
      if (editRecord) { await ringGroupService.update(editRecord.id, dto); message.success('更新成功') }
      else { await ringGroupService.create(dto); message.success('创建成功') }
      setModalOpen(false); load()
    } catch {
      const fake: RingGroup = { ...dto, id: Date.now(), members: [], enabled: dto.enabled ?? true, createdAt: new Date().toISOString() }
      setData((d) => editRecord ? d.map((x) => x.id === editRecord.id ? { ...x, ...dto } : x) : [...d, fake])
      setModalOpen(false)
    }
  }

  const columns: ColumnsType<RingGroup> = [
    { title: '名称', dataIndex: 'name', width: 160 },
    { title: '分机号', dataIndex: 'extension', width: 90, render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: '振铃策略', dataIndex: 'strategy', width: 120, render: (v: RingStrategy) => <Tag>{STRATEGY_LABELS[v]}</Tag> },
    { title: '超时（秒）', dataIndex: 'ringTimeout', width: 100, align: 'center' },
    {
      title: '成员', dataIndex: 'members', width: 220,
      render: (members: RingGroup['members']) => members.length > 0
        ? members.map((m) => <Tag key={m.extensionId}>{m.extensionNumber} {m.name}</Tag>)
        : <Tag color="default">无成员</Tag>,
    },
    { title: '溢出目标', dataIndex: 'failoverDestination', width: 100, render: (v?: string) => v ?? '-' },
    { title: '启用', dataIndex: 'enabled', width: 70, render: (v: boolean) => <Switch checked={v} size="small" disabled /> },
    {
      title: '操作', key: 'op', width: 100, fixed: 'right',
      render: (_, r) => (
        <Space>
          <Tooltip title="编辑"><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /></Tooltip>
          <Popconfirm title="确认删除？" onConfirm={async () => { try { await ringGroupService.delete(r.id) } catch { /* */ } setData((d) => d.filter((x) => x.id !== r.id)) }}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}><TeamOutlined /> 振铃组管理</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建振铃组</Button>
        </Space>
      </div>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} scroll={{ x: 900 }} />

      <Modal title={editRecord ? '编辑振铃组' : '新建振铃组'} open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)} width={620} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="振铃组名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="extension" label="分机号" rules={[{ required: true }]}><Input placeholder="例如：7001" /></Form.Item>
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="strategy" label="振铃策略" style={{ width: '60%' }}>
              <Select>{Object.entries(STRATEGY_LABELS).map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}</Select>
            </Form.Item>
            <Form.Item name="ringTimeout" label="超时（秒）" style={{ width: '40%' }}>
              <InputNumber min={5} max={120} style={{ width: '100%' }} />
            </Form.Item>
          </Space.Compact>
          <Form.Item label="成员分机">
            <Transfer
              dataSource={AVAILABLE_EXTENSIONS}
              titles={['可用分机', '已选成员']}
              targetKeys={targetKeys}
              selectedKeys={selectedKeys}
              onChange={(keys) => setTargetKeys(keys as string[])}
              onSelectChange={(src, tgt) => setSelectedKeys([...src, ...tgt] as string[])}
              render={(item) => item.title ?? item.key}
              listStyle={{ width: 220, height: 200 }}
            />
          </Form.Item>
          <Form.Item name="failoverDestination" label="溢出目标（可选）"><Input placeholder="分机号/队列名" /></Form.Item>
          <Form.Item name="description" label="备注"><Input /></Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default RingGroups
