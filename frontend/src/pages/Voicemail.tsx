import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, Space, Tag,
  message, Popconfirm, Typography, Switch,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, InboxOutlined,
  AudioOutlined, SyncOutlined,
} from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;
const { Option } = Select;

const Voicemail: React.FC = () => {
  const [boxes, setBoxes] = useState<any[]>([]);
  const [extensions, setExtensions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBox, setEditingBox] = useState<any>(null);
  const [messagesMap, setMessagesMap] = useState<Record<string, any>>({});
  const [loadingMessages, setLoadingMessages] = useState<string | null>(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get('/api/voicemail');
      setBoxes(r.data.rows || r.data);
    } catch (e: any) { message.error(e.message); }
    finally { setLoading(false); }
  };

  const loadExtensions = async () => {
    try {
      const r = await axios.get('/api/extensions');
      setExtensions(r.data.rows || r.data);
    } catch {}
  };

  useEffect(() => { load(); loadExtensions(); }, []);

  const openCreate = () => {
    setEditingBox(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (box: any) => {
    setEditingBox(box);
    form.setFieldsValue({
      extensionId: box.extensionId,
      password: box.password,
      email: box.email,
      emailAttach: box.emailAttach,
      deleteAfterEmail: box.deleteAfterEmail,
      maxMessages: box.maxMessages,
      maxMessageLength: box.maxMessageLength,
      timezone: box.timezone,
      enabled: box.enabled,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const vals = await form.validateFields();
      if (editingBox) {
        await axios.put(`/api/voicemail/${editingBox.id}`, vals);
        message.success('更新成功');
      } else {
        await axios.post('/api/voicemail', vals);
        message.success('创建成功');
      }
      setModalOpen(false);
      form.resetFields();
      load();
    } catch (e: any) { message.error(e.response?.data?.error || e.message); }
  };

  const handleDelete = async (id: string) => {
    try { await axios.delete(`/api/voicemail/${id}`); message.success('删除成功'); load(); }
    catch (e: any) { message.error(e.message); }
  };

  const loadMessages = async (boxId: string) => {
    setLoadingMessages(boxId);
    try {
      const r = await axios.get(`/api/voicemail/${boxId}/messages`);
      setMessagesMap(prev => ({ ...prev, [boxId]: r.data }));
    } catch (e: any) { message.error(e.message); }
    finally { setLoadingMessages(null); }
  };

  const deleteMessage = async (boxId: string, folder: string, msgNum: string) => {
    try {
      await axios.delete(`/api/voicemail/${boxId}/messages/${folder}/${msgNum}`);
      message.success('消息已删除');
      loadMessages(boxId);
    } catch (e: any) { message.error(e.message); }
  };

  const columns = [
    {
      title: '分机', dataIndex: 'extension',
      render: (_: any, r: any) => r.extension ? `${r.extension.number} - ${r.extension.name}` : r.extensionId,
    },
    { title: '邮箱', dataIndex: 'mailbox', render: (v: string) => <Tag>{v}</Tag> },
    {
      title: '邮件通知',
      render: (_: any, r: any) => r.email ? (
        <Space>
          <Text>{r.email}</Text>
          {r.emailAttach && <Tag color="blue">附件发送</Tag>}
          {r.deleteAfterEmail && <Tag color="orange">发后删除</Tag>}
        </Space>
      ) : <Text type="secondary">未设置</Text>,
    },
    {
      title: '状态',
      render: (_: any, r: any) => <Tag color={r.enabled ? 'green' : 'default'}>{r.enabled ? '启用' : '停用'}</Tag>,
    },
    {
      title: '操作', render: (_: any, r: any) => (
        <Space>
          <Button icon={<InboxOutlined />} size="small" loading={loadingMessages === r.id}
            onClick={() => loadMessages(r.id)}>查看消息</Button>
          <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(r)}>编辑</Button>
          <Popconfirm title="确认删除?" onConfirm={() => handleDelete(r.id)}>
            <Button icon={<DeleteOutlined />} size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const expandedRowRender = (record: any) => {
    const msgs = messagesMap[record.id];
    if (!msgs) return <Text type="secondary">点击"查看消息"加载留言</Text>;
    const allMsgs = [
      ...(msgs.INBOX || []).map((m: any) => ({ ...m, folder: 'INBOX' })),
      ...(msgs.Old || []).map((m: any) => ({ ...m, folder: 'Old' })),
    ];
    if (allMsgs.length === 0) return <Text type="secondary">无留言</Text>;
    return (
      <Table
        dataSource={allMsgs}
        rowKey="msgnum"
        size="small"
        columns={[
          { title: '状态', dataIndex: 'folder', render: (v: string) => <Tag color={v === 'INBOX' ? 'blue' : 'default'}>{v === 'INBOX' ? '未读' : '已读'}</Tag> },
          { title: '来电号码', dataIndex: 'callerid' },
          { title: '时间', dataIndex: 'origtime', render: (v: number) => v ? new Date(v * 1000).toLocaleString() : '-' },
          { title: '时长', dataIndex: 'duration', render: (v: number) => v ? `${v}秒` : '-' },
          {
            title: '操作', render: (_: any, m: any) => (
              <Space>
                <Button
                  size="small"
                  icon={<AudioOutlined />}
                  href={`/api/voicemail/${record.id}/messages/${m.folder}/${m.msgnum}/audio`}
                  target="_blank"
                >
                  播放
                </Button>
                <Popconfirm title="删除此留言?" onConfirm={() => deleteMessage(record.id, m.folder, m.msgnum)}>
                  <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
        pagination={false}
      />
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4}><InboxOutlined /> 语音信箱管理</Title>
        <Space>
          <Button icon={<SyncOutlined />} onClick={load}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建信箱</Button>
        </Space>
      </div>

      <Card>
        <Table
          rowKey="id"
          dataSource={boxes}
          columns={columns}
          loading={loading}
          expandable={{ expandedRowRender, rowExpandable: () => true }}
        />
      </Card>

      <Modal
        open={modalOpen}
        title={editingBox ? '编辑语音信箱' : '新建语音信箱'}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        onOk={handleSave}
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {!editingBox && (
            <Form.Item name="extensionId" label="绑定分机" rules={[{ required: true }]}>
              <Select showSearch optionFilterProp="children" placeholder="选择分机">
                {extensions.map(e => (
                  <Option key={e.id} value={e.id}>{e.number} - {e.name}</Option>
                ))}
              </Select>
            </Form.Item>
          )}
          <Form.Item name="password" label="密码（拨号收听时输入）" rules={[{ required: true }]}>
            <Input.Password placeholder="4-8位数字" />
          </Form.Item>
          <Form.Item name="email" label="邮件通知地址">
            <Input placeholder="留空则不发送邮件通知" type="email" />
          </Form.Item>
          <Form.Item name="emailAttach" label="邮件附件" valuePropName="checked" initialValue={false}>
            <Switch checkedChildren="附音频" unCheckedChildren="仅通知" />
          </Form.Item>
          <Form.Item name="deleteAfterEmail" label="发送后删除" valuePropName="checked" initialValue={false}>
            <Switch />
          </Form.Item>
          <Form.Item name="maxMessages" label="最大留言数" initialValue={100}>
            <Select>
              <Option value={50}>50</Option>
              <Option value={100}>100</Option>
              <Option value={200}>200</Option>
            </Select>
          </Form.Item>
          <Form.Item name="timezone" label="时区" initialValue="Asia/Shanghai">
            <Select>
              <Option value="Asia/Shanghai">亚洲/上海</Option>
              <Option value="Asia/Hong_Kong">亚洲/香港</Option>
              <Option value="UTC">UTC</Option>
            </Select>
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Voicemail;
