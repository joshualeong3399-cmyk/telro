import React, { useEffect, useState } from 'react';
import {
  Table, Card, Button, Tag, Space, Modal, Form, Input, InputNumber,
  Select, Switch, message, Tooltip, Popconfirm,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import outboundRouteService, { OutboundRoute } from '@/services/outboundRoute';
import sipTrunkService, { SipTrunk } from '@/services/sipTrunk';

const OutboundRoutes: React.FC = () => {
  const [routes, setRoutes] = useState<OutboundRoute[]>([]);
  const [trunks, setTrunks] = useState<SipTrunk[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testNumber, setTestNumber] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [routeRes, trunkRes] = await Promise.all([
        outboundRouteService.getAll(),
        sipTrunkService.getAll(),
      ]);
      setRoutes(routeRes.rows);
      setTotal(routeRes.count);
      setTrunks(trunkRes.rows);
    } catch { message.error('加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => { setEditingId(null); form.resetFields(); setModalOpen(true); };
  const openEdit = (r: OutboundRoute) => {
    setEditingId(r.id);
    form.setFieldsValue({ ...r, dialPatterns: (r.dialPatterns || []).join('\n') });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      // 将多行文本转为数组
      const dialPatterns = (values.dialPatterns || '')
        .split('\n').map((s: string) => s.trim()).filter(Boolean);
      const payload = { ...values, dialPatterns };

      if (editingId) {
        await outboundRouteService.update(editingId, payload);
        message.success('出站路由更新成功');
      } else {
        await outboundRouteService.create(payload);
        message.success('出站路由创建成功');
      }
      setModalOpen(false);
      fetchData();
    } catch (e: any) { message.error(e.message || '保存失败'); }
  };

  const handleDelete = async (id: string) => {
    try { await outboundRouteService.remove(id); message.success('已删除'); fetchData(); }
    catch (e: any) { message.error(e.message); }
  };

  const handleToggle = async (r: OutboundRoute) => {
    await outboundRouteService.setEnabled(r.id, !r.enabled);
    fetchData();
  };

  const handleTest = async () => {
    if (!testNumber) return;
    try {
      const res = await outboundRouteService.testMatch(testNumber);
      if (res.data) {
        setTestResult(`✅ 匹配路由: ${res.data.route?.name}，使用中继: ${res.data.trunk?.name}，最终号码: ${res.data.dialNumber}`);
      } else {
        setTestResult('❌ 无匹配路由');
      }
    } catch { setTestResult('测试出错'); }
  };

  const columns: ColumnsType<OutboundRoute> = [
    { title: '优先级', dataIndex: 'priority', key: 'priority', width: 80 },
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '拨号规则', dataIndex: 'dialPatterns', key: 'patterns',
      render: (patterns: string[]) => (patterns || []).slice(0, 3).map(p => <Tag key={p}>{p}</Tag>),
    },
    {
      title: '中继', key: 'trunk',
      render: (_, r) => r.sipTrunk ? <Tag color="blue">{r.sipTrunk.name}</Tag> : '—',
    },
    { title: '去前缀', dataIndex: 'stripDigits', key: 'strip', render: v => v > 0 ? `去掉前 ${v} 位` : '不处理' },
    { title: '加前缀', dataIndex: 'prepend', key: 'prepend', render: v => v || '—' },
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
      <Card title="出站路由管理" extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增出站路由</Button>
        </Space>
      }>
        {/* 拨号测试区 */}
        <div style={{ marginBottom: 16, background: '#f5f5f5', padding: 12, borderRadius: 8 }}>
          <Space>
            <span>拨号测试：</span>
            <Input value={testNumber} onChange={e => setTestNumber(e.target.value)}
              placeholder="输入号码测试匹配" style={{ width: 200 }} />
            <Button onClick={handleTest}>测试</Button>
            {testResult && <span style={{ color: testResult.startsWith('✅') ? '#52c41a' : '#f5222d' }}>{testResult}</span>}
          </Space>
        </div>

        <Table<OutboundRoute> columns={columns} dataSource={routes} rowKey="id" loading={loading}
          pagination={{ total, showTotal: t => `共 ${t} 条` }} />
      </Card>

      <Modal title={editingId ? '编辑出站路由' : '新增出站路由'} open={modalOpen}
        onOk={handleSave} onCancel={() => setModalOpen(false)} okText="保存" cancelText="取消" width={600}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="dialPatterns" label="拨号规则（每行一条，支持 X=0-9, N=2-9, .=任意长度）"
            help="例：9. 表示9开头任意长度；_0086X. 表示0086开头">
            <Input.TextArea rows={4} placeholder={'9.\nNXXNXXXXXX\n_0086X.'} />
          </Form.Item>
          <Form.Item name="sipTrunkId" label="使用中继">
            <Select allowClear placeholder="选择 SIP 中继">
              {trunks.map(t => <Select.Option key={t.id} value={t.id}>{t.name} ({t.host})</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="stripDigits" label="去掉前N位" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="prepend" label="号码前加前缀"><Input placeholder="如：0086" /></Form.Item>
          <Form.Item name="callerIdOverride" label="覆盖主叫号码（留空=使用分机号）"><Input /></Form.Item>
          <Form.Item name="priority" label="优先级（越小越优先）" initialValue={10}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="description" label="备注"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default OutboundRoutes;
