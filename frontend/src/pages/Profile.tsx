import { useState } from 'react'
import {
  Card, Form, Input, Button, Typography, Space, Tag, Divider,
  Row, Col, Avatar, message, Descriptions,
} from 'antd'
import {
  UserOutlined, LockOutlined, EditOutlined, SaveOutlined,
  MailOutlined, PhoneOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '@/store/authStore'

const { Title, Text } = Typography

const ROLE_COLOR: Record<string, string> = {
  admin: 'red', operator: 'orange', merchant: 'blue', employee: 'green',
}
const ROLE_TEXT: Record<string, string> = {
  admin: '管理员', operator: '运营商', merchant: '商家', employee: '员工',
}

const Profile: React.FC = () => {
  const { user } = useAuthStore()
  const [editingInfo, setEditingInfo] = useState(false)
  const [savingInfo, setSavingInfo] = useState(false)
  const [savingPwd, setSavingPwd] = useState(false)
  const [infoForm] = Form.useForm()
  const [pwdForm] = Form.useForm()

  const handleSaveInfo = async () => {
    await infoForm.validateFields()
    setSavingInfo(true)
    await new Promise((r) => setTimeout(r, 600))
    message.success('个人信息已更新')
    setSavingInfo(false)
    setEditingInfo(false)
  }

  const handleChangePwd = async () => {
    const values = await pwdForm.validateFields()
    if (values.newPassword !== values.confirmPassword) {
      message.error('两次输入的密码不一致')
      return
    }
    setSavingPwd(true)
    await new Promise((r) => setTimeout(r, 600))
    message.success('密码已修改，下次登录请使用新密码')
    pwdForm.resetFields()
    setSavingPwd(false)
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <Title level={4} style={{ marginBottom: 20 }}><UserOutlined /> 个人信息</Title>

      {/* 基本信息卡片 */}
      <Card
        title="账号信息"
        extra={
          editingInfo
            ? <Space>
                <Button size="small" onClick={() => setEditingInfo(false)}>取消</Button>
                <Button size="small" type="primary" icon={<SaveOutlined />} loading={savingInfo} onClick={handleSaveInfo}>保存</Button>
              </Space>
            : <Button size="small" icon={<EditOutlined />} onClick={() => { infoForm.setFieldsValue({ displayName: user?.displayName ?? '', email: '' }); setEditingInfo(true) }}>编辑</Button>
        }
        style={{ marginBottom: 16 }}
      >
        <Row gutter={24} align="middle">
          <Col flex="none">
            <Avatar size={72} style={{ background: '#1677ff', fontSize: 28 }}>
              {(user?.displayName ?? user?.username ?? 'U').charAt(0).toUpperCase()}
            </Avatar>
          </Col>
          <Col flex="auto">
            {editingInfo ? (
              <Form form={infoForm} layout="vertical">
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item name="displayName" label="显示名称" rules={[{ required: true, message: '请输入显示名称' }]}>
                      <Input prefix={<UserOutlined />} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="email" label="邮箱" rules={[{ type: 'email', message: '邮箱格式不正确' }]}>
                      <Input prefix={<MailOutlined />} placeholder="your@email.com" />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item name="phone" label="联系电话">
                  <Input prefix={<PhoneOutlined />} placeholder="可选" />
                </Form.Item>
              </Form>
            ) : (
              <Descriptions column={1} size="small">
                <Descriptions.Item label="用户名">
                  <Text strong>{user?.username ?? '—'}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="显示名称">
                  {user?.displayName ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="角色">
                  <Tag color={ROLE_COLOR[user?.role ?? ''] ?? 'default'}>
                    {ROLE_TEXT[user?.role ?? ''] ?? user?.role ?? '—'}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
            )}
          </Col>
        </Row>
      </Card>

      {/* 修改密码卡片 */}
      <Card title={<><LockOutlined /> 修改密码</>}>
        <Form form={pwdForm} layout="vertical" style={{ maxWidth: 400 }}>
          <Form.Item
            name="currentPassword"
            label="当前密码"
            rules={[{ required: true, message: '请输入当前密码' }]}
          >
            <Input.Password placeholder="请输入当前密码" />
          </Form.Item>
          <Divider style={{ margin: '8px 0' }} />
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[{ required: true, min: 6, message: '密码至少6位' }]}
          >
            <Input.Password placeholder="请输入新密码（至少6位）" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            rules={[
              { required: true, message: '请确认新密码' },
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
          <Form.Item>
            <Button type="primary" icon={<LockOutlined />} loading={savingPwd} onClick={handleChangePwd}>
              确认修改密码
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default Profile
