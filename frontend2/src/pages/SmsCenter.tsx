import { useState, useCallback } from 'react'
import {
  Table, Button, Space, Typography, Input, Select, Tag, Modal, Form,
  DatePicker, Row, Col, Card, Statistic, Tooltip, Badge, message,
} from 'antd'
import {
  MessageOutlined, SendOutlined, ReloadOutlined, PhoneOutlined,
  CheckCircleOutlined, CloseCircleOutlined, SyncOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'

const { Title } = Typography
const { RangePicker } = DatePicker
const { Option } = Select
const { TextArea } = Input

type SmsStatus = 'pending' | 'sent' | 'delivered' | 'failed'
type SmsDirection = 'inbound' | 'outbound'

interface SmsRecord {
  id: number
  direction: SmsDirection
  from: string
  to: string
  body: string
  status: SmsStatus
  createdAt: string
  sentAt?: string
  errorMsg?: string
}

const STATUS_COLOR: Record<SmsStatus, string> = {
  pending: 'orange', sent: 'blue', delivered: 'green', failed: 'red',
}
const STATUS_TEXT: Record<SmsStatus, string> = {
  pending: '待发送', sent: '已发送', delivered: '已送达', failed: '发送失败',
}
const STATUS_ICON: Record<SmsStatus, React.ReactNode> = {
  pending: <SyncOutlined spin />, sent: <CheckCircleOutlined />,
  delivered: <CheckCircleOutlined />, failed: <CloseCircleOutlined />,
}

const MOCK: SmsRecord[] = [
  { id: 1, direction: 'outbound', from: '10086', to: '13800138001', body: '您的验证码是：523847，5分钟内有效。', status: 'delivered', createdAt: dayjs().subtract(10, 'minute').toISOString(), sentAt: dayjs().subtract(9, 'minute').toISOString() },
  { id: 2, direction: 'inbound', from: '13912345678', to: '10086', body: '我想了解一下你们的套餐详情。', status: 'delivered', createdAt: dayjs().subtract(20, 'minute').toISOString() },
  { id: 3, direction: 'outbound', from: '10086', to: '13700137002', body: '亲爱的用户，您的订单已确认，预计3个工作日内发货。', status: 'sent', createdAt: dayjs().subtract(1, 'hour').toISOString(), sentAt: dayjs().subtract(59, 'minute').toISOString() },
  { id: 4, direction: 'outbound', from: '10086', to: '13600136003', body: '系统维护通知：今晚22:00-24:00服务暂停。', status: 'failed', createdAt: dayjs().subtract(2, 'hour').toISOString(), errorMsg: '号码不存在' },
  { id: 5, direction: 'inbound', from: '15011223344', to: '10086', body: '退订', status: 'delivered', createdAt: dayjs().subtract(3, 'hour').toISOString() },
  { id: 6, direction: 'outbound', from: '10086', to: '18888888888', body: '您好，这是一条测试短信，请忽略。', status: 'pending', createdAt: dayjs().subtract(5, 'minute').toISOString() },
]

const SmsCenter: React.FC = () => {
  const [data, setData] = useState<SmsRecord[]>(MOCK)
  const [filtered, setFiltered] = useState<SmsRecord[]>(MOCK)
  const [sendOpen, setSendOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')
  const [dirFilter, setDirFilter] = useState<SmsDirection | ''>('')
  const [statusFilter, setStatusFilter] = useState<SmsStatus | ''>('')
  const [form] = Form.useForm()

  const applyFilter = useCallback((
    list: SmsRecord[], dir: string, stat: string, q: string,
  ) => {
    setFiltered(list.filter((r) => {
      if (dir && r.direction !== dir) return false
      if (stat && r.status !== stat) return false
      if (q && !r.from.includes(q) && !r.to.includes(q) && !r.body.includes(q)) return false
      return true
    }))
  }, [])

  const onFilter = (dir = dirFilter, stat = statusFilter, q = search) => {
    setDirFilter(dir as SmsDirection | '')
    setStatusFilter(stat as SmsStatus | '')
    setSearch(q)
    applyFilter(data, dir, stat, q)
  }

  const handleSend = async () => {
    const values = await form.validateFields()
    setSending(true)
    await new Promise((r) => setTimeout(r, 800))
    const rec: SmsRecord = {
      id: Date.now(), direction: 'outbound', from: '10086',
      to: values.to, body: values.body, status: 'pending',
      createdAt: new Date().toISOString(),
    }
    const next = [rec, ...data]
    setData(next)
    applyFilter(next, dirFilter, statusFilter, search)
    message.success('短信已加入发送队列')
    form.resetFields()
    setSendOpen(false)
    setSending(false)
  }

  const handleRetry = (id: number) => {
    const next = data.map((r) => r.id === id ? { ...r, status: 'pending' as SmsStatus } : r)
    setData(next)
    applyFilter(next, dirFilter, statusFilter, search)
    message.info('已重新加入发送队列')
  }

  const stats = { total: data.length, delivered: data.filter((r) => r.status === 'delivered').length, failed: data.filter((r) => r.status === 'failed').length, inbound: data.filter((r) => r.direction === 'inbound').length }

  const columns: ColumnsType<SmsRecord> = [
    {
      title: '方向', dataIndex: 'direction', width: 80,
      render: (v: SmsDirection) => <Tag color={v === 'inbound' ? 'cyan' : 'geekblue'}>{v === 'inbound' ? '上行' : '下行'}</Tag>,
    },
    { title: '发送方', dataIndex: 'from', width: 130, render: (v: string) => <><PhoneOutlined style={{ marginRight: 4 }} />{v}</> },
    { title: '接收方', dataIndex: 'to', width: 130, render: (v: string) => <><PhoneOutlined style={{ marginRight: 4 }} />{v}</> },
    {
      title: '短信内容', dataIndex: 'body', ellipsis: true,
      render: (v: string) => <Tooltip title={v}><span style={{ cursor: 'default' }}>{v.length > 40 ? `${v.slice(0, 40)}…` : v}</span></Tooltip>,
    },
    {
      title: '状态', dataIndex: 'status', width: 110,
      render: (v: SmsStatus, r) => (
        <Tooltip title={v === 'failed' ? r.errorMsg : undefined}>
          <Badge status={v === 'delivered' ? 'success' : v === 'failed' ? 'error' : v === 'sent' ? 'processing' : 'warning'} />
          <Tag color={STATUS_COLOR[v]} style={{ marginLeft: 4 }}>{STATUS_ICON[v]} {STATUS_TEXT[v]}</Tag>
        </Tooltip>
      ),
    },
    {
      title: '时间', dataIndex: 'createdAt', width: 150,
      render: (v: string) => dayjs(v).format('MM-DD HH:mm:ss'),
      sorter: (a, b) => dayjs(a.createdAt).unix() - dayjs(b.createdAt).unix(),
    },
    {
      title: '操作', width: 100, align: 'center' as const,
      render: (_, r) => r.status === 'failed' ? (
        <Button size="small" type="link" icon={<ReloadOutlined />} onClick={() => handleRetry(r.id)}>重试</Button>
      ) : null,
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}><MessageOutlined /> 短信中心</Title>
        <Button type="primary" icon={<SendOutlined />} onClick={() => setSendOpen(true)}>发送短信</Button>
      </div>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { title: '短信总量', value: stats.total, color: '#1677ff' },
          { title: '已送达', value: stats.delivered, color: '#52c41a' },
          { title: '发送失败', value: stats.failed, color: '#ff4d4f' },
          { title: '上行短信', value: stats.inbound, color: '#fa8c16' },
        ].map((c) => (
          <Col key={c.title} xs={12} sm={6}>
            <Card size="small" style={{ borderTop: `3px solid ${c.color}`, borderRadius: 8 }}>
              <Statistic title={c.title} value={c.value} valueStyle={{ color: c.color, fontSize: 22 }} />
            </Card>
          </Col>
        ))}
      </Row>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Select placeholder="方向" allowClear style={{ width: 100 }} onChange={(v) => onFilter(v || '', statusFilter, search)}>
            <Option value="inbound">上行</Option>
            <Option value="outbound">下行</Option>
          </Select>
          <Select placeholder="状态" allowClear style={{ width: 120 }} onChange={(v) => onFilter(dirFilter, v || '', search)}>
            <Option value="pending">待发送</Option>
            <Option value="sent">已发送</Option>
            <Option value="delivered">已送达</Option>
            <Option value="failed">发送失败</Option>
          </Select>
          <Input.Search
            placeholder="搜索号码/内容" allowClear style={{ width: 220 }}
            onSearch={(v) => onFilter(dirFilter, statusFilter, v)}
          />
          <RangePicker format="YYYY-MM-DD" />
          <Button icon={<ReloadOutlined />} onClick={() => { setFiltered(data); setDirFilter(''); setStatusFilter(''); setSearch('') }}>重置</Button>
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={filtered}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
      />

      <Modal
        title={<><SendOutlined /> 发送短信</>}
        open={sendOpen}
        onCancel={() => { setSendOpen(false); form.resetFields() }}
        onOk={handleSend}
        confirmLoading={sending}
        okText="发送"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="to" label="接收号码" rules={[{ required: true, message: '请输入接收号码' }, { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' }]}>
            <Input prefix={<PhoneOutlined />} placeholder="请输入手机号码" />
          </Form.Item>
          <Form.Item name="body" label="短信内容" rules={[{ required: true, message: '请输入短信内容' }, { max: 500, message: '最多500字符' }]}>
            <TextArea rows={4} showCount maxLength={500} placeholder="请输入短信内容..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default SmsCenter
