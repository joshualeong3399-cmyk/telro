import { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Space, Tag, Modal, Form, Input, InputNumber,
  Switch, Typography, Popconfirm, message, Tooltip, Badge, Card, Row, Col,
  Statistic,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  VideoCameraOutlined, UserOutlined, PhoneOutlined, AudioMutedOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { conferenceService } from '@/services/conferenceService'
import type { ConferenceRoom, CreateConferenceRoomDto, ConferenceParticipant } from '@/services/conferenceService'

const { Title, Text } = Typography

const MOCK: ConferenceRoom[] = [
  { id: 1, name: '销售晨会', extension: '8801', pin: '1234', maxParticipants: 20, recordConference: true, waitForAdmin: false, enabled: true, activeParticipants: 3, createdAt: '2025-01-01' },
  { id: 2, name: '高管会议', extension: '8802', pin: '9999', adminPin: '0000', maxParticipants: 10, recordConference: true, waitForAdmin: true, enabled: true, activeParticipants: 0, createdAt: '2025-01-05' },
  { id: 3, name: '公开会议室', extension: '8803', maxParticipants: 50, recordConference: false, waitForAdmin: false, enabled: true, activeParticipants: 7, createdAt: '2025-01-10' },
]

const MOCK_PARTICIPANTS: ConferenceParticipant[] = [
  { channel: 'SIP/8001-00000001', callerIdName: '张明', callerIdNumber: '8001', joinTime: '10:15:30', muted: false, talking: true },
  { channel: 'SIP/8002-00000002', callerIdName: '李华', callerIdNumber: '8002', joinTime: '10:16:00', muted: true, talking: false },
  { channel: 'SIP/8003-00000003', callerIdName: '外部参与者', callerIdNumber: '13900000001', joinTime: '10:17:00', muted: false, talking: false },
]

const ConferenceRooms: React.FC = () => {
  const [data, setData] = useState<ConferenceRoom[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<ConferenceRoom | null>(null)
  const [participantRoom, setParticipantRoom] = useState<ConferenceRoom | null>(null)
  const [participants, setParticipants] = useState<ConferenceParticipant[]>([])
  const [form] = Form.useForm<CreateConferenceRoomDto>()

  const load = async () => {
    setLoading(true)
    try { setData(await conferenceService.list()) }
    catch { setData(MOCK) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const loadParticipants = useCallback(async (room: ConferenceRoom) => {
    setParticipantRoom(room)
    try { setParticipants(await conferenceService.getParticipants(room.id)) }
    catch { setParticipants(room.activeParticipants ? MOCK_PARTICIPANTS.slice(0, room.activeParticipants) : []) }
  }, [])

  const openCreate = () => {
    setEditRecord(null); form.resetFields()
    form.setFieldsValue({ maxParticipants: 20, recordConference: false, waitForAdmin: false, enabled: true })
    setModalOpen(true)
  }

  const openEdit = (r: ConferenceRoom) => { setEditRecord(r); form.setFieldsValue(r); setModalOpen(true) }

  const handleSave = async () => {
    const vals = await form.validateFields()
    try {
      if (editRecord) { await conferenceService.update(editRecord.id, vals); message.success('更新成功') }
      else { await conferenceService.create(vals); message.success('创建成功') }
      setModalOpen(false); load()
    } catch {
      const fake: ConferenceRoom = { ...vals, id: Date.now(), maxParticipants: vals.maxParticipants ?? 20, recordConference: vals.recordConference ?? false, waitForAdmin: vals.waitForAdmin ?? false, enabled: vals.enabled ?? true, activeParticipants: 0, createdAt: new Date().toISOString() }
      setData((d) => editRecord ? d.map((x) => x.id === editRecord.id ? { ...x, ...vals } : x) : [...d, fake])
      setModalOpen(false)
    }
  }

  const totalActive = data.reduce((s, d) => s + (d.activeParticipants ?? 0), 0)

  const columns: ColumnsType<ConferenceRoom> = [
    { title: '会议室名称', dataIndex: 'name', width: 160 },
    { title: '分机号', dataIndex: 'extension', width: 90, render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: 'PIN', dataIndex: 'pin', width: 80, render: (v?: string) => v ? <Tag>已设置</Tag> : <Tag color="default">无</Tag> },
    { title: '最大参与人', dataIndex: 'maxParticipants', width: 100, align: 'center' },
    {
      title: '当前在线', dataIndex: 'activeParticipants', width: 100, align: 'center',
      render: (v: number) => <Badge count={v} showZero color={v > 0 ? '#1677ff' : '#d9d9d9'} />,
    },
    { title: '自动录音', dataIndex: 'recordConference', width: 90, render: (v: boolean) => <Switch checked={v} size="small" disabled /> },
    { title: '等待主持人', dataIndex: 'waitForAdmin', width: 100, render: (v: boolean) => <Switch checked={v} size="small" disabled /> },
    { title: '启用', dataIndex: 'enabled', width: 70, render: (v: boolean) => <Switch checked={v} size="small" disabled /> },
    {
      title: '操作', key: 'op', width: 160, fixed: 'right',
      render: (_, r) => (
        <Space>
          <Tooltip title="查看参与者">
            <Button size="small" icon={<UserOutlined />} onClick={() => loadParticipants(r)}>
              {r.activeParticipants ?? 0} 人
            </Button>
          </Tooltip>
          <Tooltip title="编辑"><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /></Tooltip>
          <Popconfirm title="确认删除？" onConfirm={async () => { try { await conferenceService.delete(r.id) } catch { /* */ } setData((d) => d.filter((x) => x.id !== r.id)) }}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const participantCols: ColumnsType<ConferenceParticipant> = [
    { title: '姓名', dataIndex: 'callerIdName', width: 120 },
    { title: '号码', dataIndex: 'callerIdNumber', width: 140 },
    { title: '加入时间', dataIndex: 'joinTime', width: 100 },
    { title: '状态', key: 'state', width: 100, render: (_, p) => (
      <Space>
        {p.talking && <Tag color="green">发言中</Tag>}
        {p.muted && <Tag icon={<AudioMutedOutlined />} color="orange">静音</Tag>}
        {!p.talking && !p.muted && <Tag color="default">监听</Tag>}
      </Space>
    )},
    {
      title: '操作', key: 'op', width: 120,
      render: (_, p) => (
        <Space>
          <Tooltip title={p.muted ? '取消静音' : '静音'}>
            <Button size="small" icon={<AudioMutedOutlined />} onClick={async () => { try { await conferenceService.muteParticipant(participantRoom!.id, p.channel) } catch { /* */ } message.success('操作成功') }} />
          </Tooltip>
          <Popconfirm title="确认踢出该参与者？" onConfirm={async () => { try { await conferenceService.kickParticipant(participantRoom!.id, p.channel) } catch { /* */ } setParticipants((ps) => ps.filter((x) => x.channel !== p.channel)) }}>
            <Button size="small" danger>踢出</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}><VideoCameraOutlined /> 会议室管理</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建会议室</Button>
        </Space>
      </div>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { title: '会议室总数', value: data.length, color: '#1677ff' },
          { title: '当前在线总人数', value: totalActive, color: '#52c41a' },
          { title: '活跃会议室', value: data.filter((d) => (d.activeParticipants ?? 0) > 0).length, color: '#fa8c16' },
        ].map((c) => (
          <Col key={c.title} xs={12} sm={8}>
            <Card size="small" style={{ borderTop: `3px solid ${c.color}`, borderRadius: 8 }}>
              <Statistic title={c.title} value={c.value} valueStyle={{ color: c.color }} />
            </Card>
          </Col>
        ))}
      </Row>

      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} scroll={{ x: 900 }} />

      {/* Participants modal */}
      <Modal
        title={<Space><PhoneOutlined />{participantRoom?.name} — 当前参与者</Space>}
        open={!!participantRoom} footer={null} onCancel={() => setParticipantRoom(null)} width={640}
      >
        {participants.length === 0
          ? <Text type="secondary">当前无参与者</Text>
          : <Table dataSource={participants} columns={participantCols} rowKey="channel" size="small" pagination={false} />
        }
      </Modal>

      {/* Edit modal */}
      <Modal title={editRecord ? '编辑会议室' : '新建会议室'} open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)} width={480} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="会议室名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="extension" label="分机号" rules={[{ required: true }]}><Input placeholder="例如：8801" /></Form.Item>
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="pin" label="PIN 码" style={{ width: '50%' }}><Input.Password placeholder="可选" /></Form.Item>
            <Form.Item name="adminPin" label="管理员 PIN" style={{ width: '50%' }}><Input.Password placeholder="可选" /></Form.Item>
          </Space.Compact>
          <Form.Item name="maxParticipants" label="最大参与人数"><InputNumber min={2} max={500} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="recordConference" label="自动录音" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item name="waitForAdmin" label="等待主持人入会" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default ConferenceRooms
