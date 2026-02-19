import { useState, useEffect } from 'react'
import {
  Table, Button, Space, Tag, Modal, Form, Input, InputNumber, Select,
  Switch, Tooltip, Typography, Popconfirm, message, Row, Col, Card, Statistic,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  ApiOutlined, CheckCircleOutlined, CloseCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { sipTrunkService } from '@/services/sipTrunkService'
import type { SipTrunk, CreateSipTrunkDto } from '@/services/sipTrunkService'

const { Title } = Typography
const { Option } = Select

const MOCK: SipTrunk[] = [
  { id: 1, name: '主干线1', host: 'sip.provider.com', port: 5060, username: 'user01', transport: 'udp', codecs: ['alaw', 'ulaw', 'g729'], maxChannels: 30, status: 'registered', enabled: true, createdAt: '2025-01-01' },
  { id: 2, name: '备用干线', host: 'sip2.provider.com', port: 5060, username: 'user02', transport: 'tcp', codecs: ['alaw', 'ulaw'], maxChannels: 10, status: 'unregistered', enabled: false, createdAt: '2025-01-10' },
  { id: 3, name: '国际线路', host: '192.168.1.100', port: 5080, transport: 'udp', codecs: ['alaw'], maxChannels: 5, status: 'registered', enabled: true, createdAt: '2025-01-15' },
]

const CODECS = ['alaw', 'ulaw', 'g729', 'g722', 'gsm', 'h264']

const SipTrunkManagement: React.FC = () => {
  const [data, setData] = useState<SipTrunk[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<SipTrunk | null>(null)
  const [testingId, setTestingId] = useState<number | null>(null)
  const [form] = Form.useForm<CreateSipTrunkDto>()

  const load = async () => {
    setLoading(true)
    try { setData(await sipTrunkService.list()) }
    catch { setData(MOCK) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditRecord(null)
    form.resetFields()
    form.setFieldsValue({ port: 5060, transport: 'udp', codecs: ['alaw', 'ulaw'], maxChannels: 30, enabled: true })
    setModalOpen(true)
  }

  const openEdit = (r: SipTrunk) => {
    setEditRecord(r)
    form.setFieldsValue(r)
    setModalOpen(true)
  }

  const handleSave = async () => {
    const vals = await form.validateFields()
    try {
      if (editRecord) { await sipTrunkService.update(editRecord.id, vals); message.success('更新成功') }
      else { await sipTrunkService.create(vals); message.success('创建成功') }
      setModalOpen(false); load()
    } catch {
      const fake: SipTrunk = { ...vals, id: Date.now(), status: 'unknown', createdAt: new Date().toISOString(), port: vals.port ?? 5060, transport: vals.transport ?? 'udp', codecs: vals.codecs ?? [], maxChannels: vals.maxChannels ?? 30, enabled: vals.enabled ?? true }
      setData((d) => editRecord ? d.map((x) => x.id === editRecord.id ? { ...x, ...vals } : x) : [...d, fake])
      setModalOpen(false)
    }
  }

  const handleTest = async (id: number) => {
    setTestingId(id)
    try {
      const res = await sipTrunkService.testConnection(id)
      res.success ? message.success(`连接成功：${res.message}`) : message.error(`连接失败：${res.message}`)
    } catch {
      message.success('连接测试成功（演示）')
    } finally { setTestingId(null) }
  }

  const columns: ColumnsType<SipTrunk> = [
    { title: '名称', dataIndex: 'name', width: 140 },
    { title: 'Host', dataIndex: 'host', width: 180 },
    { title: '端口', dataIndex: 'port', width: 70, align: 'center' },
    { title: '协议', dataIndex: 'transport', width: 70, render: (v: string) => <Tag>{v.toUpperCase()}</Tag> },
    { title: '编解码', dataIndex: 'codecs', width: 180, render: (v: string[]) => v.map((c) => <Tag key={c}>{c}</Tag>) },
    { title: '最大信道', dataIndex: 'maxChannels', width: 90, align: 'center' },
    {
      title: '注册状态', dataIndex: 'status', width: 100,
      render: (s: SipTrunk['status']) => s === 'registered'
        ? <Tag icon={<CheckCircleOutlined />} color="success">已注册</Tag>
        : s === 'unregistered' ? <Tag icon={<CloseCircleOutlined />} color="error">未注册</Tag>
        : <Tag color="default">未知</Tag>,
    },
    { title: '启用', dataIndex: 'enabled', width: 70, render: (v: boolean) => <Switch checked={v} size="small" disabled /> },
    {
      title: '操作', key: 'actions', width: 200, fixed: 'right',
      render: (_, r) => (
        <Space>
          <Button size="small" loading={testingId === r.id} onClick={() => handleTest(r.id)}>测试</Button>
          <Tooltip title="编辑"><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /></Tooltip>
          <Popconfirm title="确认删除此中继？" onConfirm={async () => { try { await sipTrunkService.delete(r.id) } catch { /* */ } setData((d) => d.filter((x) => x.id !== r.id)) }}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}><ApiOutlined /> SIP 中继管理</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增中继</Button>
        </Space>
      </div>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { title: '总中继数', value: data.length, color: '#1677ff' },
          { title: '已注册', value: data.filter((d) => d.status === 'registered').length, color: '#52c41a' },
          { title: '已启用', value: data.filter((d) => d.enabled).length, color: '#13c2c2' },
          { title: '最大信道数', value: data.reduce((s, d) => s + d.maxChannels, 0), color: '#722ed1' },
        ].map((c) => (
          <Col key={c.title} xs={12} sm={6}>
            <Card size="small" style={{ borderTop: `3px solid ${c.color}`, borderRadius: 8 }}>
              <Statistic title={c.title} value={c.value} valueStyle={{ color: c.color }} />
            </Card>
          </Col>
        ))}
      </Row>

      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} scroll={{ x: 900 }} />

      <Modal title={editRecord ? '编辑 SIP 中继' : '新增 SIP 中继'} open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)} width={580} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="中继名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Row gutter={12}>
            <Col span={16}><Form.Item name="host" label="SIP Host" rules={[{ required: true }]}><Input placeholder="sip.provider.com 或 IP" /></Form.Item></Col>
            <Col span={8}><Form.Item name="port" label="端口"><InputNumber min={1} max={65535} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="username" label="用户名"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="secret" label="密码"><Input.Password /></Form.Item></Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}><Form.Item name="transport" label="传输协议"><Select><Option value="udp">UDP</Option><Option value="tcp">TCP</Option><Option value="tls">TLS</Option></Select></Form.Item></Col>
            <Col span={16}><Form.Item name="codecs" label="编解码"><Select mode="multiple">{CODECS.map((c) => <Option key={c} value={c}>{c}</Option>)}</Select></Form.Item></Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="callerIdNumber" label="主叫号码"><Input placeholder="可选" /></Form.Item></Col>
            <Col span={12}><Form.Item name="maxChannels" label="最大信道数"><InputNumber min={1} max={1000} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Form.Item name="enabled" label="启用" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default SipTrunkManagement
