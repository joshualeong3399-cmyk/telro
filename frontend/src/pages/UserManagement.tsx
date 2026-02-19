import { useState } from 'react'
import {
  Table, Button, Space, Typography, Input, Select, Tag, Modal, Form,
  Row, Col, Card, Statistic, Switch, message, Popconfirm, Tooltip,
} from 'antd'
import {
  UserOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  KeyOutlined, TeamOutlined, ReloadOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { Option } = Select

type UserRole = 'admin' | 'operator' | 'merchant' | 'employee'

interface UserRecord {
  id: number
  username: string
  displayName: string
  email: string
  role: UserRole
  extensionNumber?: string
  enabled: boolean
  lastLogin?: string
  createdAt: string
}

const ROLE_COLOR: Record<UserRole, string> = {
  admin: 'red', operator: 'orange', merchant: 'blue', employee: 'green',
}
const ROLE_TEXT: Record<UserRole, string> = {
  admin: '管理员', operator: '运营商', merchant: '商家', employee: '员工',
}

const MOCK: UserRecord[] = [
  { id: 1, username: 'admin', displayName: '系统管理员', email: 'admin@telro.com', role: 'admin', enabled: true, lastLogin: dayjs().subtract(10, 'minute').toISOString(), createdAt: dayjs().subtract(365, 'day').toISOString() },
  { id: 2, username: 'operator1', displayName: '张运营', email: 'op1@telro.com', role: 'operator', extensionNumber: '8001', enabled: true, lastLogin: dayjs().subtract(2, 'hour').toISOString(), createdAt: dayjs().subtract(180, 'day').toISOString() },
  { id: 3, username: 'merchant_a', displayName: '商家A', email: 'merchant_a@example.com', role: 'merchant', enabled: true, lastLogin: dayjs().subtract(1, 'day').toISOString(), createdAt: dayjs().subtract(90, 'day').toISOString() },
  { id: 4, username: 'agent001', displayName: '李小明', email: 'agent001@telro.com', role: 'employee', extensionNumber: '1001', enabled: true, lastLogin: dayjs().subtract(30, 'minute').toISOString(), createdAt: dayjs().subtract(60, 'day').toISOString() },
  { id: 5, username: 'agent002', displayName: '王芳', email: 'agent002@telro.com', role: 'employee', extensionNumber: '1002', enabled: false, lastLogin: dayjs().subtract(30, 'day').toISOString(), createdAt: dayjs().subtract(60, 'day').toISOString() },
  { id: 6, username: 'agent003', displayName: '赵磊', email: 'agent003@telro.com', role: 'employee', extensionNumber: '1003', enabled: true, lastLogin: dayjs().subtract(5, 'hour').toISOString(), createdAt: dayjs().subtract(45, 'day').toISOString() },
  { id: 7, username: 'merchant_b', displayName: '商家B', email: 'merchant_b@example.com', role: 'merchant', enabled: false, createdAt: dayjs().subtract(20, 'day').toISOString() },
]

const ROLES: UserRole[] = ['admin', 'operator', 'merchant', 'employee']

const UserManagement: React.FC = () => {
  const [data, setData] = useState<UserRecord[]>(MOCK)
  const [editOpen, setEditOpen] = useState(false)
  const [pwdOpen, setPwdOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<UserRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('')
  const [form] = Form.useForm()
  const [pwdForm] = Form.useForm()

  const filtered = data.filter((u) => {
    if (roleFilter && u.role !== roleFilter) return false
    if (search && !u.username.includes(search) && !u.displayName.includes(search) && !u.email.includes(search)) return false
    return true
  })

  const stats = {
    total: data.length,
    byRole: ROLES.map((r) => ({ role: r, count: data.filter((u) => u.role === r).length })),
    enabled: data.filter((u) => u.enabled).length,
  }

  const openCreate = () => {
    setEditTarget(null)
    form.resetFields()
    form.setFieldsValue({ enabled: true })
    setEditOpen(true)
  }
  const openEdit = (u: UserRecord) => {
    setEditTarget(u)
    form.setFieldsValue({ ...u })
    setEditOpen(true)
  }
  const openReset = (u: UserRecord) => { setEditTarget(u); pwdForm.resetFields(); setPwdOpen(true) }

  const handleSave = async () => {
    const values = await form.validateFields()
    setSaving(true)
    await new Promise((r) => setTimeout(r, 600))
    if (editTarget) {
      setData((prev) => prev.map((u) => u.id === editTarget.id ? { ...u, ...values } : u))
      message.success('用户信息已更新')
    } else {
      const nu: UserRecord = { ...values, id: Date.now(), createdAt: new Date().toISOString(), enabled: values.enabled ?? true }
      setData((prev) => [nu, ...prev])
      message.success('用户已创建')
    }
    setSaving(false)
    setEditOpen(false)
  }

  const handleDelete = (id: number) => {
    setData((prev) => prev.filter((u) => u.id !== id))
    message.success('用户已删除')
  }

  const handleToggle = (id: number, enabled: boolean) => {
    setData((prev) => prev.map((u) => u.id === id ? { ...u, enabled } : u))
    message.success(enabled ? '用户已启用' : '用户已停用')
  }

  const handleResetPwd = async () => {
    await pwdForm.validateFields()
    setSaving(true)
    await new Promise((r) => setTimeout(r, 500))
    message.success(`用户 ${editTarget?.displayName} 密码已重置`)
    setSaving(false)
    setPwdOpen(false)
  }

  const columns: ColumnsType<UserRecord> = [
    { title: '用户名', dataIndex: 'username', width: 120, render: (v) => <><UserOutlined style={{ marginRight: 6 }} /><Text strong>{v}</Text></> },
    { title: '显示名称', dataIndex: 'displayName', width: 120 },
    { title: '邮箱', dataIndex: 'email', width: 180, ellipsis: true },
    {
      title: '角色', dataIndex: 'role', width: 100,
      render: (v: UserRole) => <Tag color={ROLE_COLOR[v]}>{ROLE_TEXT[v]}</Tag>,
    },
    { title: '分机号', dataIndex: 'extensionNumber', width: 90, render: (v) => v || <Text type="secondary">—</Text> },
    {
      title: '状态', dataIndex: 'enabled', width: 90,
      render: (v: boolean, r) => <Switch checked={v} size="small" onChange={(c) => handleToggle(r.id, c)} checkedChildren="启用" unCheckedChildren="停用" />,
    },
    {
      title: '最后登录', dataIndex: 'lastLogin', width: 150, ellipsis: true,
      render: (v) => v ? dayjs(v).format('MM-DD HH:mm') : <Text type="secondary">从未登录</Text>,
    },
    {
      title: '操作', width: 160, align: 'center' as const,
      render: (_, r) => (
        <Space size={0}>
          <Tooltip title="编辑"><Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /></Tooltip>
          <Tooltip title="重置密码"><Button type="link" size="small" icon={<KeyOutlined />} onClick={() => openReset(r)} /></Tooltip>
          <Popconfirm title="确定删除该用户？" onConfirm={() => handleDelete(r.id)}>
            <Tooltip title="删除"><Button type="link" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}><TeamOutlined /> 用户管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>创建用户</Button>
      </div>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderTop: '3px solid #1677ff', borderRadius: 8 }}>
            <Statistic title="总用户数" value={stats.total} valueStyle={{ color: '#1677ff', fontSize: 22 }} />
          </Card>
        </Col>
        {stats.byRole.map((b) => (
          <Col key={b.role} xs={12} sm={6} md={4} lg={3}>
            <Card size="small" style={{ borderTop: `3px solid ${ROLE_COLOR[b.role]}`, borderRadius: 8 }}>
              <Statistic title={ROLE_TEXT[b.role]} value={b.count} valueStyle={{ color: ROLE_COLOR[b.role], fontSize: 22 }} />
            </Card>
          </Col>
        ))}
        <Col xs={12} sm={6} md={4} lg={3}>
          <Card size="small" style={{ borderTop: '3px solid #52c41a', borderRadius: 8 }}>
            <Statistic title="已启用" value={stats.enabled} valueStyle={{ color: '#52c41a', fontSize: 22 }} />
          </Card>
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Select placeholder="角色筛选" allowClear style={{ width: 120 }} onChange={(v) => setRoleFilter(v || '')}>
            {ROLES.map((r) => <Option key={r} value={r}>{ROLE_TEXT[r]}</Option>)}
          </Select>
          <Input.Search
            placeholder="搜索用户名/姓名/邮箱" allowClear style={{ width: 240 }}
            onSearch={setSearch}
          />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setRoleFilter('') }}>重置</Button>
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={filtered}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `共 ${t} 位用户` }}
      />

      {/* Create / Edit Modal */}
      <Modal
        title={editTarget ? `编辑用户：${editTarget.displayName}` : '创建用户'}
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
                <Input disabled={!!editTarget} prefix={<UserOutlined />} placeholder="登录用户名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="displayName" label="显示名称" rules={[{ required: true }]}>
                <Input placeholder="真实姓名/昵称" />
              </Form.Item>
            </Col>
          </Row>
          {!editTarget && (
            <Form.Item name="password" label="初始密码" rules={[{ required: true, min: 6, message: '密码至少6位' }]}>
              <Input.Password placeholder="请设置初始密码" />
            </Form.Item>
          )}
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item name="email" label="邮箱" rules={[{ type: 'email', message: '邮箱格式不正确' }]}>
                <Input placeholder="user@example.com" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="role" label="角色" rules={[{ required: true }]}>
                <Select placeholder="选择角色">
                  {ROLES.map((r) => <Option key={r} value={r}><Tag color={ROLE_COLOR[r]}>{ROLE_TEXT[r]}</Tag></Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="extensionNumber" label="关联分机">
                <Input placeholder="分机号（可选）" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="enabled" label="账号状态" valuePropName="checked" initialValue>
                <Switch checkedChildren="启用" unCheckedChildren="停用" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        title={<><KeyOutlined /> 重置密码：{editTarget?.displayName}</>}
        open={pwdOpen}
        onCancel={() => setPwdOpen(false)}
        onOk={handleResetPwd}
        confirmLoading={saving}
        okText="确认重置"
        cancelText="取消"
        width={400}
      >
        <Form form={pwdForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="newPassword" label="新密码" rules={[{ required: true, min: 6, message: '密码至少6位' }]}>
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item
            name="confirmPassword" label="确认密码"
            rules={[
              { required: true, message: '请再次输入密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) return Promise.resolve()
                  return Promise.reject(new Error('两次输入的密码不一致'))
                },
              }),
            ]}
          >
            <Input.Password placeholder="再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default UserManagement
