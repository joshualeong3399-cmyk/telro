import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Space,
  Switch,
  message,
  Tooltip,
  Typography,
  Badge,
  Avatar,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  UserOutlined,
  LockOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title } = Typography;

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface User {
  id: string;
  username: string;
  email: string;
  fullName?: string;
  role: 'admin' | 'operator' | 'merchant' | 'employee';
  department?: string;
  enabled: boolean;
  lastLogin?: string;
  createdAt: string;
  merchantId?: string;
}

const roleColors: Record<string, string> = {
  admin: 'red',
  operator: 'purple',
  merchant: 'blue',
  employee: 'default',
};

const roleLabels: Record<string, string> = {
  admin: '超级管理员',
  operator: '运营商',
  merchant: '商家',
  employee: '商家员工',
};

async function apiFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...opts?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [filterRole, setFilterRole] = useState<string>('');
  const [search, setSearch] = useState('');
  const [form] = Form.useForm();

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String((page - 1) * pageSize),
        ...(filterRole && { role: filterRole }),
        ...(search && { search }),
      });
      const data = await apiFetch(`/api/users?${params}`);
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filterRole, search]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const openCreate = () => {
    setEditUser(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (user: User) => {
    setEditUser(user);
    form.setFieldsValue({ ...user, password: '' });
    setModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      if (!values.password) delete values.password;
      if (editUser) {
        await apiFetch(`/api/users/${editUser.id}`, { method: 'PUT', body: JSON.stringify(values) });
        message.success('用户更新成功');
      } else {
        await apiFetch('/api/users', { method: 'POST', body: JSON.stringify(values) });
        message.success('用户创建成功');
      }
      setModalOpen(false);
      loadUsers();
    } catch (e: any) {
      message.error(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/users/${id}`, { method: 'DELETE' });
      message.success('用户已删除');
      loadUsers();
    } catch (e: any) {
      message.error(e.message);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await apiFetch(`/api/users/${id}/toggle`, { method: 'PATCH' });
      loadUsers();
    } catch (e: any) {
      message.error(e.message);
    }
  };

  const columns = [
    {
      title: '用户',
      key: 'user',
      render: (_: any, r: User) => (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} />
          <div>
            <div style={{ fontWeight: 500 }}>{r.fullName || r.username}</div>
            <div style={{ fontSize: 12, color: '#888' }}>{r.username} · {r.email}</div>
          </div>
        </Space>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      width: 120,
      render: (role: string) => <Tag color={roleColors[role]}>{roleLabels[role]}</Tag>,
    },
    {
      title: '部门',
      dataIndex: 'department',
      width: 120,
      render: (v: string) => v || '-',
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      width: 80,
      render: (v: boolean) => (
        <Badge status={v ? 'success' : 'default'} text={v ? '启用' : '停用'} />
      ),
    },
    {
      title: '最后登录',
      dataIndex: 'lastLogin',
      width: 160,
      render: (v: string) => v ? dayjs(v).format('MM-DD HH:mm') : '从未',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      width: 140,
      render: (_: any, r: User) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Tooltip title={r.enabled ? '停用' : '启用'}>
            <Button
              type="link"
              size="small"
              icon={r.enabled ? <LockOutlined /> : <UnlockOutlined />}
              onClick={() => handleToggle(r.id)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                Modal.confirm({
                  title: '确认删除',
                  content: `确定删除用户 "${r.username}" 吗？`,
                  onOk: () => handleDelete(r.id),
                });
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>👥 用户管理</Title>
        <Space>
          <Input.Search
            placeholder="搜索用户名/邮箱/姓名"
            allowClear
            style={{ width: 220 }}
            onSearch={(v) => { setSearch(v); setPage(1); }}
          />
          <Select
            placeholder="筛选角色"
            allowClear
            style={{ width: 140 }}
            onChange={(v) => { setFilterRole(v || ''); setPage(1); }}
          >
            <Select.Option value="admin">超级管理员</Select.Option>
            <Select.Option value="operator">运营商</Select.Option>
            <Select.Option value="merchant">商家</Select.Option>
            <Select.Option value="employee">商家员工</Select.Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={loadUsers} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建用户</Button>
        </Space>
      </div>

      <Table
        dataSource={users}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ current: page, pageSize, total, onChange: setPage, showTotal: (t) => `共 ${t} 条` }}
      />

      <Modal
        title={editUser ? '编辑用户' : '新建用户'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        okText={editUser ? '保存' : '创建'}
        width={520}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请填写用户名' }]}>
            <Input disabled={!!editUser} placeholder="登录用户名" />
          </Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email', message: '请填写有效邮箱' }]}>
            <Input placeholder="user@example.com" />
          </Form.Item>
          <Form.Item
            name="password"
            label={editUser ? '新密码（留空不修改）' : '密码'}
            rules={editUser ? [] : [{ required: true, min: 6, message: '密码至少6位' }]}
          >
            <Input.Password placeholder={editUser ? '不修改请留空' : '至少6位'} />
          </Form.Item>
          <Form.Item name="fullName" label="姓名">
            <Input placeholder="真实姓名（可选）" />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]} initialValue="employee">
            <Select>
              <Select.Option value="admin">超级管理员</Select.Option>
              <Select.Option value="operator">运营商</Select.Option>
              <Select.Option value="merchant">商家</Select.Option>
              <Select.Option value="employee">商家员工</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="department" label="部门">
            <Input placeholder="所属部门（可选）" />
          </Form.Item>
          <Form.Item name="enabled" label="状态" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserManagement;
