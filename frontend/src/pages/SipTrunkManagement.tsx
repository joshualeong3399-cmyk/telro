import React, { useEffect, useState } from 'react';
import {
  Table, Card, Button, Tag, Space, Modal, Form, Input, InputNumber,
  Select, Switch, message, Tooltip, Popconfirm, Badge,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ApiOutlined,
  ReloadOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import sipTrunkService, { SipTrunk } from '@/services/sipTrunk';

const { Option } = Select;

const statusMap: Record<string, { color: string; label: string }> = {
  active:   { color: 'green',   label: '在线' },
  inactive: { color: 'default', label: '离线' },
  error:    { color: 'red',     label: '错误' },
};

const SipTrunkManagement: React.FC = () => {
  const [trunks, setTrunks] = useState<SipTrunk[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [form] = Form.useForm();

  const fetchTrunks = async () => {
    setLoading(true);
    try {
      const res = await sipTrunkService.getAll();
      setTrunks(res.rows);
      setTotal(res.count);
    } catch { message.error('加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTrunks(); }, []);

  const openCreate = () => { setEditingId(null); form.resetFields(); setModalOpen(true); };
  const openEdit = (t: SipTrunk) => {
    setEditingId(t.id);
    form.setFieldsValue(t);
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingId) {
        await sipTrunkService.update(editingId, values);
        message.success('SIP 中继更新成功');
      } else {
        await sipTrunkService.create(values);
        message.success('SIP 中继创建成功');
      }
      setModalOpen(false);
      fetchTrunks();
    } catch (e: any) { message.error(e.message || '保存失败'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await sipTrunkService.remove(id);
      message.success('已删除');
      fetchTrunks();
    } catch (e: any) { message.error(e.message || '删除失败'); }
  };

  const handleTest = async (t: SipTrunk) => {
    setTestingId(t.id);
    try {
      const res = await sipTrunkService.test(t.id);
      message.success(`连通性测试: ${res.data?.status ?? '完成'}`);
      fetchTrunks();
    } catch (e: any) { message.error(e.message || '测试失败'); }
    finally { setTestingId(null); }
  };

  const handleToggle = async (t: SipTrunk) => {
    try {
      await sipTrunkService.setEnabled(t.id, !t.enabled);
      fetchTrunks();
    } catch (e: any) { message.error(e.message); }
  };

  const columns: ColumnsType<SipTrunk> = [
    { title: '名称', dataIndex: 'name', key: 'name', render: (v, r) => <><Badge color={statusMap[r.status]?.color} />{' '}{v}</> },
    { title: '运营商', dataIndex: 'provider', key: 'provider', render: v => v || '—' },
    { title: '主机', dataIndex: 'host', key: 'host', render: (v, r) => `${v}:${r.port}` },
    { title: '协议', dataIndex: 'protocol', key: 'protocol', render: v => <Tag>{v}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', render: s => <Tag color={statusMap[s]?.color}>{statusMap[s]?.label}</Tag> },
    { title: '费率/分钟', dataIndex: 'ratePerMinute', key: 'rate', render: v => `¥${Number(v).toFixed(4)}` },
    { title: '优先级', dataIndex: 'priority', key: 'priority' },
    { title: '支持SMS', dataIndex: 'supportsSms', key: 'sms', render: (v: boolean) => v ? <Tag color="green">✓ 支持</Tag> : <Tag color="default">—</Tag> },
    { title: '启用', dataIndex: 'enabled', key: 'enabled', render: (v, r) => <Switch checked={v} size="small" onChange={() => handleToggle(r)} /> },
    {
      title: '操作', key: 'actions', render: (_, r) => (
        <Space>
          <Tooltip title="连通测试"><Button size="small" icon={<ApiOutlined />} loading={testingId === r.id} onClick={() => handleTest(r)} /></Tooltip>
          <Tooltip title="编辑"><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /></Tooltip>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)} okText="删除" cancelText="取消">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card title="SIP 中继管理" extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchTrunks}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增中继</Button>
        </Space>
      }>
        <Table<SipTrunk> columns={columns} dataSource={trunks} rowKey="id" loading={loading}
          pagination={{ total, showTotal: t => `共 ${t} 条` }} />
      </Card>

      <Modal title={editingId ? '编辑 SIP 中继' : '新增 SIP 中继'} open={modalOpen}
        onOk={handleSave} onCancel={() => setModalOpen(false)} width={640} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="provider" label="运营商"><Input placeholder="如：阿里云/腾讯云" /></Form.Item>
          <Form.Item name="host" label="主机地址" rules={[{ required: true }]}><Input placeholder="sip.example.com 或 IP" /></Form.Item>
          <Form.Item name="port" label="端口" initialValue={5060}><InputNumber min={1} max={65535} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="protocol" label="协议" initialValue="SIP">
            <Select><Option value="SIP">SIP/UDP</Option><Option value="TCP">TCP</Option><Option value="TLS">TLS</Option></Select>
          </Form.Item>
          <Form.Item name="username" label="用户名"><Input /></Form.Item>
          <Form.Item name="secret" label="密码"><Input.Password /></Form.Item>
          <Form.Item name="authid" label="Auth ID"><Input /></Form.Item>
          <Form.Item name="fromuser" label="From User"><Input /></Form.Item>
          <Form.Item name="fromdomain" label="From Domain"><Input /></Form.Item>
          <Form.Item name="context" label="Context" initialValue="from-trunk"><Input /></Form.Item>
          <Form.Item name="ratePerMinute" label="费率/分钟（¥）" initialValue={0.05}>
            <InputNumber min={0} step={0.001} precision={4} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="priority" label="优先级（越小越优先）" initialValue={10}>
            <InputNumber min={1} max={999} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="supportsSms" label="支持 SMS 发送" valuePropName="checked" initialValue={false}>
            <Switch checkedChildren="支持" unCheckedChildren="不支持" />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.supportsSms !== cur.supportsSms}
          >
            {({ getFieldValue }) => getFieldValue('supportsSms') && (
              <>
                <Form.Item name="smsApiUrl" label="SMS 网关 URL">
                  <Input placeholder="https://api.twilio.com/... 或阿里云短信接口" />
                </Form.Item>
                <Form.Item name="smsApiKey" label="API Key / Account SID">
                  <Input placeholder="Account SID 或 AccessKeyId" />
                </Form.Item>
                <Form.Item name="smsApiSecret" label="API Secret / Auth Token">
                  <Input.Password placeholder="Auth Token 或 AccessKeySecret" />
                </Form.Item>
              </>
            )}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SipTrunkManagement;
