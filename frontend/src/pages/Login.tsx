import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Spin } from 'antd';
import { PhoneOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '@/services/auth';
import { useAuthStore } from '@/store/authStore';
import Cookie from 'js-cookie';
import './Login.css';

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const setToken = useAuthStore((s) => s.setToken);

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const response: any = await authAPI.login({
        username: values.username,
        password: values.password,
      });
      
      // response is already response.data due to axios interceptor
      setUser(response.user);
      setToken(response.token);
      Cookie.set('token', response.token);
      
      message.success('登录成功');
      navigate('/dashboard');
    } catch (error: any) {
      message.error(error.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <Card className="login-card">
        <div className="login-header">
          <PhoneOutlined className="login-icon" />
          <h1>Telro 电销系统</h1>
          <p>Telemarketing System</p>
        </div>

        <Form
          name="login"
          onFinish={onFinish}
          layout="vertical"
          requiredMark={false}
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="输入用户名或邮箱" size="large" />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder="输入密码" size="large" />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={loading}
            >
              登录
            </Button>
          </Form.Item>
        </Form>

        <div className="login-footer">
          <p>默认账户: admin / admin123</p>
          <p>首次使用？联系管理员</p>
        </div>
      </Card>
    </div>
  );
};

export default Login;
