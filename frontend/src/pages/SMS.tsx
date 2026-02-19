import React, { useState, useEffect, useCallback } from 'react';
import {
  Layout,
  Menu,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Badge,
  Space,
  Tag,
  Typography,
  message,
  Tooltip,
  Empty,
  Drawer,
} from 'antd';
import {
  InboxOutlined,
  SendOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  PlusOutlined,
  MailOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Sider, Content } = Layout;
const { TextArea } = Input;
const { Title, Text } = Typography;

const BASE = import.meta.env.VITE_API_URL || '';

interface SmsMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  direction: 'inbound' | 'outbound';
  status: 'draft' | 'sending' | 'sent' | 'delivered' | 'failed' | 'received';
  sipTrunkId?: string;
  readAt?: string;
  sentAt?: string;
  createdAt: string;
}

interface SmsStats {
  inbox: number;
  sent: number;
  draft: number;
  failed: number;
}

const statusColors: Record<string, string> = {
  draft: 'default',
  sending: 'processing',
  sent: 'success',
  delivered: 'success',
  failed: 'error',
  received: 'blue',
};

const statusLabels: Record<string, string> = {
  draft: '草稿',
  sending: '发送中',
  sent: '已发送',
  delivered: '已送达',
  failed: '发送失败',
  received: '已接收',
};

const folderLabels: Record<string, string> = {
  inbox: '收件箱',
  sent: '已发送',
  draft: '草稿箱',
  outbox: '发件箱',
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

const SMS: React.FC = () => {
  const [folder, setFolder] = useState('inbox');
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<SmsStats>({ inbox: 0, sent: 0, draft: 0, failed: 0 });
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [composeOpen, setComposeOpen] = useState(false);
  const [viewMsg, setViewMsg] = useState<SmsMessage | null>(null);
  const [trunks, setTrunks] = useState<{ id: string; name: string }[]>([]);
  const [form] = Form.useForm();

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const offset = (page - 1) * pageSize;
      const data = await apiFetch(`/api/sms?folder=${folder}&limit=${pageSize}&offset=${offset}`);
      setMessages(data.messages || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [folder, page, pageSize]);

  const loadStats = useCallback(async () => {
    try {
      const s = await apiFetch('/api/sms/stats');
      setStats(s);
    } catch {}
  }, []);

  const loadTrunks = useCallback(async () => {
    try {
      const data = await apiFetch('/api/sip-trunks');
      const all = data.sipTrunks || data.trunks || data.rows || [];
      // Only show trunks that are enabled for SMS
      setTrunks(all.filter((t: any) => t.supportsSms).map((t: any) => ({ id: t.id, name: t.name })));
    } catch {}
  }, []);

  useEffect(() => {
    loadMessages();
    loadStats();
  }, [loadMessages, loadStats]);

  useEffect(() => {
    loadTrunks();
  }, [loadTrunks]);

  const handleSend = async (values: any) => {
    try {
      await apiFetch('/api/sms/send', { method: 'POST', body: JSON.stringify(values) });
      message.success('短信已发送');
      setComposeOpen(false);
      form.resetFields();
      loadMessages();
      loadStats();
    } catch (e: any) {
      message.error(e.message);
    }
  };

  const handleSaveDraft = async () => {
    try {
      const values = await form.validateFields(['from', 'to', 'body']);
      await apiFetch('/api/sms/draft', { method: 'POST', body: JSON.stringify(values) });
      message.success('已保存为草稿');
      setComposeOpen(false);
      form.resetFields();
      loadMessages();
      loadStats();
    } catch (e: any) {
      if (e.message) message.error(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/sms/${id}`, { method: 'DELETE' });
      message.success('已删除');
      loadMessages();
      loadStats();
    } catch (e: any) {
      message.error(e.message);
    }
  };

  const handleSendDraft = async (id: string) => {
    try {
      await apiFetch(`/api/sms/${id}/send`, { method: 'POST' });
      message.success('草稿已发送');
      loadMessages();
      loadStats();
    } catch (e: any) {
      message.error(e.message);
    }
  };

  const handleView = async (msg: SmsMessage) => {
    setViewMsg(msg);
    if (!msg.readAt && msg.direction === 'inbound') {
      await apiFetch(`/api/sms/${msg.id}`).catch(() => {});
      loadStats();
    }
  };

  const columns = [
    {
      title: folder === 'inbox' ? '发送方' : '接收方',
      dataIndex: folder === 'inbox' ? 'from' : 'to',
      width: 140,
      render: (v: string, record: SmsMessage) => (
        <span style={{ fontWeight: !record.readAt && record.direction === 'inbound' ? 'bold' : 'normal' }}>
          {v}
        </span>
      ),
    },
    {
      title: '内容',
      dataIndex: 'body',
      ellipsis: true,
      render: (v: string, record: SmsMessage) => (
        <span
          style={{ cursor: 'pointer', fontWeight: !record.readAt && record.direction === 'inbound' ? 'bold' : 'normal' }}
          onClick={() => handleView(record)}
        >
          {v}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (s: string) => <Tag color={statusColors[s]}>{statusLabels[s]}</Tag>,
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      width: 120,
      render: (_: any, record: SmsMessage) => (
        <Space size="small">
          {record.status === 'draft' && (
            <Tooltip title="发送草稿">
              <Button type="link" size="small" icon={<SendOutlined />} onClick={() => handleSendDraft(record.id)} />
            </Tooltip>
          )}
          <Tooltip title="删除">
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                Modal.confirm({
                  title: '确认删除',
                  content: '确定要删除这条短信吗？',
                  onOk: () => handleDelete(record.id),
                });
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const menuItems = [
    { key: 'inbox', icon: <InboxOutlined />, label: <span>收件箱 <Badge count={stats.inbox} size="small" /></span> },
    { key: 'sent', icon: <CheckCircleOutlined />, label: <span>已发送 <Badge count={stats.sent} size="small" showZero={false} /></span> },
    { key: 'outbox', icon: <SendOutlined />, label: '发件箱' },
    { key: 'draft', icon: <EditOutlined />, label: <span>草稿箱 <Badge count={stats.draft} size="small" /></span> },
  ];

  return (
    <Layout style={{ background: '#fff', borderRadius: 8, minHeight: 600, overflow: 'hidden' }}>
      <Sider width={200} style={{ background: '#fafafa', borderRight: '1px solid #f0f0f0' }}>
        <div style={{ padding: '16px 16px 8px' }}>
          <Button type="primary" icon={<PlusOutlined />} block onClick={() => setComposeOpen(true)}>
            写短信
          </Button>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[folder]}
          items={menuItems}
          onClick={({ key }) => { setFolder(key); setPage(1); }}
          style={{ background: 'transparent', border: 'none' }}
        />
      </Sider>

      <Content style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Title level={5} style={{ margin: 0 }}>
            <MailOutlined /> {folderLabels[folder]}（{total}）
          </Title>
          <Button icon={<ReloadOutlined />} onClick={loadMessages} loading={loading}>刷新</Button>
        </div>

        <Table
          dataSource={messages}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{ current: page, pageSize, total, onChange: (p) => setPage(p), showSizeChanger: false }}
          locale={{ emptyText: <Empty description="暂无短信" /> }}
        />
      </Content>

      {/* 写短信弹窗 */}
      <Modal
        title="写短信"
        open={composeOpen}
        onCancel={() => { setComposeOpen(false); form.resetFields(); }}
        footer={[
          <Button key="draft" onClick={handleSaveDraft}>保存草稿</Button>,
          <Button key="send" type="primary" icon={<SendOutlined />} onClick={() => form.submit()}>发送</Button>,
        ]}
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={handleSend}>
          <Form.Item name="from" label="发送方号码" rules={[{ required: true, message: '请填写发送方号码' }]}>
            <Input placeholder="例: 18812345678" />
          </Form.Item>
          <Form.Item name="to" label="接收方号码" rules={[{ required: true, message: '请填写接收方号码' }]}>
            <Input placeholder="例: 13900001234" />
          </Form.Item>
          <Form.Item name="sipTrunkId" label="使用线路">
            <Select placeholder="选择SIP线路（可选）" allowClear>
              {trunks.map((t) => (
                <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="body" label="短信内容" rules={[{ required: true, message: '请输入短信内容' }]}>
            <TextArea rows={5} showCount maxLength={500} placeholder="请输入短信内容" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 查看短信 */}
      <Drawer
        title={viewMsg?.direction === 'inbound' ? `来自 ${viewMsg?.from}` : `发给 ${viewMsg?.to}`}
        open={!!viewMsg}
        onClose={() => setViewMsg(null)}
        width={400}
      >
        {viewMsg && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary">时间：</Text>
              <Text>{dayjs(viewMsg.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Text>
            </div>
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary">状态：</Text>
              <Tag color={statusColors[viewMsg.status]}>{statusLabels[viewMsg.status]}</Tag>
            </div>
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary">方向：</Text>
              <Tag color={viewMsg.direction === 'inbound' ? 'blue' : 'green'}>
                {viewMsg.direction === 'inbound' ? '收到' : '发出'}
              </Tag>
            </div>
            <div style={{
              background: '#f5f5f5',
              borderRadius: 8,
              padding: 16,
              marginTop: 12,
              whiteSpace: 'pre-wrap',
              lineHeight: 1.8,
            }}>
              {viewMsg.body}
            </div>
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={() => { setViewMsg(null); handleDelete(viewMsg.id); }}
              >
                删除
              </Button>
            </div>
          </div>
        )}
      </Drawer>
    </Layout>
  );
};

export default SMS;
