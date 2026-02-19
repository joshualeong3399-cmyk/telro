import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, InputNumber,
  Switch, Space, Tag, message, Popconfirm, Typography,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, MailOutlined, SyncOutlined } from '@ant-design/icons';
import api from '@/services/api';

const { Title } = Typography;

const ConferenceRooms: React.FC = () => {
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/conference');
      setRooms(r.data.rows || r.data);
    } catch (e: any) { message.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true); };
  const openEdit = (r: any) => { setEditing(r); form.setFieldsValue(r); setModalOpen(true); };

  const handleSave = async () => {
    try {
      const vals = await form.validateFields();
      if (editing) await api.put(`/conference/${editing.id}`, vals);
      else await api.post('/conference', vals);
      message.success('保存成功');
      setModalOpen(false);
      load();
    } catch (e: any) { message.error(e.response?.data?.error || e.message); }
  };

  const handleDelete = async (id: string) => {
    try { await api.delete(`/conference/${id}`); message.success('删除成功'); load(); }
    catch (e: any) { message.error(e.message); }
  };

  const columns = [
    { title: '房间号', dataIndex: 'number', width: 100 },
    { title: '名称', dataIndex: 'name' },
    { title: '描述', dataIndex: 'description' },
    { title: '最大人数', dataIndex: 'maxMembers', width: 100 },
    { title: '需要PIN', dataIndex: 'pinRequired', render: (v: boolean) => v ? <Tag color="orange">是</Tag> : <Tag>否</Tag>, width: 100 },
    { title: '录音', dataIndex: 'recordEnabled', render: (v: boolean) => v ? <Tag color="green">开启</Tag> : <Tag>关闭</Tag>, width: 80 },
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
        <Title level={4}><MailOutlined /> 会议室管理</Title>
        <Space>
          <Button icon={<SyncOutlined />} onClick={load}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建会议室</Button>
        </Space>
      </div>
      <Card>
        <Table rowKey="id" dataSource={rooms} columns={columns} loading={loading} />
      </Card>
      <Modal open={modalOpen} title={editing ? '编辑会议室' : '新建会议室'} onCancel={() => setModalOpen(false)} onOk={handleSave} width={560}>
        <Form form={form} layout="vertical">
          <Form.Item name="number" label="房间号码" rules={[{ required: true }]}><Input placeholder="如: 8000" /></Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="maxMembers" label="最大参与人数" initialValue={50}><InputNumber min={2} max={500} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="pinRequired" label="需要PIN码" valuePropName="checked" initialValue={false}><Switch /></Form.Item>
          <Form.Item name="pin" label="PIN码 (用户进入)"><Input.Password /></Form.Item>
          <Form.Item name="adminPin" label="管理员PIN码"><Input.Password /></Form.Item>
          <Form.Item name="recordEnabled" label="录音" valuePropName="checked" initialValue={false}><Switch /></Form.Item>
          <Form.Item name="musicOnHold" label="等待音乐" valuePropName="checked" initialValue={true}><Switch /></Form.Item>
          <Form.Item name="announceCount" label="播报人数" valuePropName="checked" initialValue={true}><Switch /></Form.Item>
          <Form.Item name="waitForHost" label="等待主持人" valuePropName="checked" initialValue={false}><Switch /></Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked" initialValue={true}><Switch /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ConferenceRooms;
