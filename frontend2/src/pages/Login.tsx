import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Form, Input, message, Typography } from 'antd'
import { LockOutlined, UserOutlined, PhoneOutlined } from '@ant-design/icons'
import { authService } from '@/services/authService'
import { useAuthStore } from '@/store/authStore'

const { Text } = Typography

interface LoginForm {
  username: string
  password: string
}

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const loginSuccess = useAuthStore((s) => s.loginSuccess)

  const onFinish = async (values: LoginForm) => {
    setLoading(true)
    try {
      const res = await authService.login(values.username, values.password)
      // 持久化 token + user 到 Cookie，更新 Zustand 状态
      loginSuccess(res)
      message.success('登录成功')
      navigate('/dashboard', { replace: true })
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        '用户名或密码错误'
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)',
      }}
    >
      <Card
        style={{ width: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
        styles={{ body: { padding: '40px 32px 24px' } }}
      >
        {/* Logo 区域 */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: '#1677ff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}
          >
            <PhoneOutlined style={{ fontSize: 24, color: '#fff' }} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a' }}>Telro 呼叫中心</div>
          <Text type="secondary" style={{ fontSize: 13 }}>Call Center Management System</Text>
        </div>

        <Form<LoginForm>
          name="login"
          onFinish={onFinish}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block loading={loading} size="large">
              登 录
            </Button>
          </Form.Item>
        </Form>

        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            © 2026 Telro · All rights reserved
          </Text>
        </div>
      </Card>
    </div>
  )
}

export default Login
