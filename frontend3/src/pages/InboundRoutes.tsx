import React, { useEffect, useState } from 'react';
import {
  Table, Card, Button, Tag, Space, Modal, Form, Input, InputNumber,
  Select, Switch, message, Tooltip, Popconfirm,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import inboundRouteService, { InboundRoute } from '@/services/inboundRoute';

const { Option } = Select;

const destTypeLabels: Record<string, string> = {
  extension: '分机', ivr: 'IVR', queue: '队列',
  voicemail: '语音信箱', hangup: '挂断', time_condition: '时间条件',
};

const InboundRoutes: React.FC = () => {
  const [routes, setRoutes] = useState<InboundRoute[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();

  const fetchRoutes = async () => {
    setLoading(true);
    try {
      const res = await inboundRouteService.getAll();
      setRoutes(res.rows);
      setTotal(res.count);
    } catch { message.error('加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRoutes(); }, []);

  const openCreate = () => { setEditingId(null); form.resetFields(); setModalOpen(true); };
  const openEdit = (r: InboundRoute) => { setEditingId(r.id); form.setFieldsValue(r); setModalOpen(true); };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingId) {
        await inboundRouteService.update(editingId, values);
        message.success('入站路由更新成功');
      } else {
        await inboundRouteService.create(values);
        message.success('入站路由创建成功');
      }
      setModalOpen(false);
      fetchRoutes();
    } catch (e: any) { message.error(e.message || '保存失败'); }
  };

  const handleDelete = async (id: string) => {
    try { await inboundRouteService.remove(id); message.success('已删除'); fetchRoutes(); }
    catch (e: any) { message.error(e.message); }
  };

  const handleToggle = async (r: InboundRoute) => {
    await inboundRouteService.setEnabled(r.id, !r.enabled);
    fetchRoutes();
  };

  const columns: ColumnsType<InboundRoute> = [
    { title: '优先级', dataIndex: 'priority', key: 'priority', width: 80 },
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: 'DID 号码', dataIndex: 'did', key: 'did', render: v => v || <Tag>匹配全部</Tag> },
    { title: '来电方匹配', dataIndex: 'callerIdMatch', key: 'cid', render: v => v || '—' },
    {
      title: '目标', key: 'dest', render: (_, r) => (
        <Space>
          <Tag color="blue">{destTypeLabels[r.destinationType]}</Tag>
          {r.destinationId && <span style={{ fontSize: 12, color: '#8c8c8c' }}>{r.destinationId.slice(0, 8)}…</span>}
        </Space>
      ),
    },
    { title: '启用', dataIndex: 'enabled', key: 'enabled', render: (v, r) => <Switch checked={v} size="small" onChange={() => handleToggle(r)} /> },
    {
      title: '操作', key: 'actions', render: (_, r) => (
        <Space>
          <Tooltip title="编辑"><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /></Tooltip>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card title="入站路由管理" extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchRoutes}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增入站路由</Button>
        </Space>
      }>
        <p style={{ color: '#8c8c8c', marginBottom: 16 }}>
          入站路由决定来电如何分配，按优先级从小到大依次匹配。
        </p>
        <Table<InboundRoute> columns={columns} dataSource={routes} rowKey="id" loading={loading}
          pagination={{ total, showTotal: t => `共 ${t} 条` }} />
      </Card>

      <Modal title={editingId ? '编辑入站路由' : '新增入站路由'} open={modalOpen}
        onOk={handleSave} onCancel={() => setModalOpen(false)} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="did" label="DID 号码（空=匹配全部）"><Input placeholder="如：13800138000" /></Form.Item>
          <Form.Item name="callerIdMatch" label="来电方号码匹配（前缀，空=全匹配）"><Input placeholder="如：138" /></Form.Item>
          <Form.Item name="destinationType" label="目标类型" initialValue="extension" rules={[{ required: true }]}>
            <Select>
              {Object.entries(destTypeLabels).map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="destinationId" label="目标 ID"><Input placeholder="填入分机/IVR/队列 UUID" /></Form.Item>
          <Form.Item name="priority" label="优先级（越小越优先）" initialValue={10}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="callerIdName" label="覆盖来电显示名称"><Input /></Form.Item>
          <Form.Item name="description" label="备注"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default InboundRoutes;
