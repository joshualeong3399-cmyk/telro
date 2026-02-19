import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, InputNumber, Select,
  Switch, Space, Tag, message, Popconfirm, Typography,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, TeamOutlined, SyncOutlined } from '@ant-design/icons';
import api from '@/services/api';

const { Title } = Typography;
const { Option } = Select;

const API = '/ring-groups';

const RingGroups: React.FC = () => {
  const [groups, setGroups] = useState<any[]>([]);
  const [extensions, setExtensions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const [rg, ext] = await Promise.all([
        api.get(API),
        api.get('/extensions'),
      ]);
      setGroups(rg.data.rows || rg.data);
      setExtensions(ext.data.rows || ext.data);
    } catch (e: any) { message.error(e.response?.data?.error || e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true); };
  const openEdit = (r: any) => { setEditing(r); form.setFieldsValue({ ...r }); setModalOpen(true); };

  const handleSave = async () => {
    try {
      const vals = await form.validateFields();
      if (editing) await api.put(`${API}/${editing.id}`, vals);
      else await api.post(API, vals);
      message.success('保存成功');
      setModalOpen(false);
      load();
    } catch (e: any) { message.error(e.response?.data?.error || e.message); }
  };

  const handleDelete = async (id: string) => {
    try { await api.delete(`${API}/${id}`); message.success('删除成功'); load(); }
    catch (e: any) { message.error(e.response?.data?.error || e.message); }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try { await api.patch(`${API}/${id}/enabled`, { enabled }); load(); }
    catch (e: any) { message.error(e.response?.data?.error || e.message); }
  };

  const columns = [
    { title: '号码', dataIndex: 'number', width: 100 },
    { title: '名称', dataIndex: 'name' },
    {
      title: '成员', dataIndex: 'members',
      render: (m: string[]) => (m || []).map(n => <Tag key={n}>{n}</Tag>),
    },
    {
      title: '振铃策略', dataIndex: 'strategy',
      render: (v: string) => ({ ringall: '同时振铃', hunt: '顺序振铃', memoryhunt: '记忆轮询', firstavailable: '第一可用', firstnotonphone: '第一空闲' }[v] || v),
    },
    { title: '振铃时长(秒)', dataIndex: 'ringTime' },
    {
      title: '状态', dataIndex: 'enabled',
      render: (v: boolean, r: any) => (
        <Switch checked={v} onChange={(c) => handleToggle(r.id, c)} size="small" />
      ),
    },
    {
      title: '操作', render: (_: any, r: any) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(r)}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
            <Button icon={<DeleteOutlined />} size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4}><TeamOutlined /> 振铃组管理</Title>
        <Space>
          <Button icon={<SyncOutlined />} onClick={load}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建振铃组</Button>
        </Space>
      </div>

      <Card>
        <Table rowKey="id" dataSource={groups} columns={columns} loading={loading} />
      </Card>

      <Modal
        open={modalOpen}
        title={editing ? '编辑振铃组' : '新建振铃组'}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="number" label="振铃组号码" rules={[{ required: true }]}>
            <Input placeholder="如: 6000" />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="members" label="成员分机">
            <Select mode="multiple" placeholder="选择分机号码">
              {extensions.map((e: any) => (
                <Option key={e.number} value={e.number}>{e.number} - {e.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="strategy" label="振铃策略" initialValue="ringall">
            <Select>
              <Option value="ringall">同时振铃 (Ring All)</Option>
              <Option value="hunt">顺序振铃 (Hunt)</Option>
              <Option value="memoryhunt">记忆轮询 (Memory Hunt)</Option>
              <Option value="firstavailable">第一可用</Option>
              <Option value="firstnotonphone">第一空闲</Option>
            </Select>
          </Form.Item>
          <Form.Item name="ringTime" label="振铃时长(秒)" initialValue={20}>
            <InputNumber min={5} max={120} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="failoverType" label="无人接听时转接" initialValue="hangup">
            <Select>
              <Option value="hangup">挂断</Option>
              <Option value="voicemail">语音信箱</Option>
              <Option value="ivr">IVR</Option>
              <Option value="queue">队列</Option>
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

export default RingGroups;
