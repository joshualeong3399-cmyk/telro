import React, { useEffect, useState } from 'react';
import {
  Table, Card, Button, Tag, Space, Modal, Form, Input, Select,
  message, Tooltip, Popconfirm, Badge, Alert, Upload,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, ReloadOutlined, SearchOutlined,
  UploadOutlined, StopOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dncService, { DNCEntry } from '@/services/dnc';

const REASON_LABELS: Record<string, string> = {
  customer_request: '客户申请',
  regulatory: '法律要求',
  system: '系统自动',
  manual: '手动添加',
  imported: '批量导入',
  invalid_number: '无效号码',
};

const REASON_COLORS: Record<string, string> = {
  customer_request: 'blue',
  regulatory: 'red',
  system: 'orange',
  manual: 'default',
  imported: 'purple',
  invalid_number: 'volcano',
};

const DncManagement: React.FC = () => {
  const [items, setItems] = useState<DNCEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [checkNumber, setCheckNumber] = useState('');
  const [checkResult, setCheckResult] = useState<null | { blocked: boolean; reason?: string }>(null);
  const [importText, setImportText] = useState('');
  const [importReason, setImportReason] = useState('imported');
  const [form] = Form.useForm();

  const fetchItems = async (p = page) => {
    setLoading(true);
    try {
      const res = await dncService.getAll({ limit: 20, offset: (p - 1) * 20 });
      setItems(res.rows);
      setTotal(res.count);
    } catch { message.error('加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchItems(); }, []);

  const handleAdd = async () => {
    try {
      const values = await form.validateFields();
      await dncService.add(values);
      message.success('已添加到 DNC 黑名单');
      setModalOpen(false);
      form.resetFields();
      fetchItems();
    } catch (e: any) { message.error(e.response?.data?.message || e.message || '添加失败'); }
  };

  const handleDelete = async (id: string) => {
    try { await dncService.remove(id); message.success('已从黑名单移除'); fetchItems(); }
    catch (e: any) { message.error(e.message); }
  };

  const handleCheck = async () => {
    if (!checkNumber.trim()) return;
    try {
      const res = await dncService.check(checkNumber.trim());
      setCheckResult(res);
    } catch { message.error('查询失败'); }
  };

  const handleImport = async () => {
    const numbers = importText.split(/[\n,，]/)
      .map((s: string) => s.trim())
      .filter(Boolean);
    if (numbers.length === 0) { message.warning('请输入号码'); return; }
    try {
      const res = await dncService.bulkImport(numbers, importReason);
      message.success(`成功导入 ${res.imported} 条，跳过 ${res.skipped} 条重复`);
      setImportOpen(false);
      setImportText('');
      fetchItems();
    } catch (e: any) { message.error(e.message); }
  };

  const columns: ColumnsType<DNCEntry> = [
    { title: '手机号码', dataIndex: 'phoneNumber', key: 'phoneNumber', render: v => <span style={{ fontFamily: 'monospace' }}>{v}</span> },
    {
      title: '原因', dataIndex: 'reason', key: 'reason',
      render: v => <Tag color={REASON_COLORS[v]}>{REASON_LABELS[v] || v}</Tag>,
    },
    {
      title: '到期时间', dataIndex: 'expiresAt', key: 'expiresAt',
      render: v => v ? <Tag color="warning">{new Date(v).toLocaleDateString()}</Tag> : <Tag>永久</Tag>,
    },
    { title: '添加时间', dataIndex: 'createdAt', key: 'createdAt', render: v => new Date(v).toLocaleString() },
    {
      title: '操作', key: 'actions', render: (_, r) => (
        <Popconfirm title="确定从黑名单移除？" onConfirm={() => handleDelete(r.id)}>
          <Button size="small" danger icon={<DeleteOutlined />}>移除</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* 快速查询 */}
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <span style={{ fontWeight: 600 }}>快速查询：</span>
          <Input value={checkNumber} onChange={e => setCheckNumber(e.target.value)}
            onPressEnter={handleCheck} placeholder="输入号码检查是否在黑名单" style={{ width: 240 }} />
          <Button icon={<SearchOutlined />} onClick={handleCheck}>查询</Button>
          {checkResult !== null && (
            checkResult.blocked
              ? <Alert type="error" showIcon icon={<StopOutlined />}
                  message={`⛔ 号码在黑名单中（原因：${REASON_LABELS[checkResult.reason || ''] || checkResult.reason}）`} />
              : <Alert type="success" showIcon icon={<CheckCircleOutlined />} message="✅ 号码不在黑名单，可以拨打" />
          )}
        </Space>
      </Card>

      <Card title="DNC 黑名单管理" extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => fetchItems()}>刷新</Button>
          <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>批量导入</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>添加号码</Button>
        </Space>
      }>
        <Table<DNCEntry> columns={columns} dataSource={items} rowKey="id" loading={loading}
          pagination={{
            total, current: page, pageSize: 20,
            onChange: p => { setPage(p); fetchItems(p); },
            showTotal: t => `共 ${t} 条`,
          }}
        />
      </Card>

      {/* 添加单个号码 */}
      <Modal title="添加 DNC 黑名单号码" open={modalOpen}
        onOk={handleAdd} onCancel={() => setModalOpen(false)} okText="添加" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="phoneNumber" label="手机号码" rules={[{ required: true, message: '请输入手机号' }]}>
            <Input placeholder="如：13800138000" />
          </Form.Item>
          <Form.Item name="reason" label="原因" initialValue="manual" rules={[{ required: true }]}>
            <Select>
              {Object.entries(REASON_LABELS).map(([v, l]) => (
                <Select.Option key={v} value={v}>{l}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="expiresAt" label="到期时间（留空=永久）">
            <Input type="date" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量导入 */}
      <Modal title="批量导入 DNC 号码" open={importOpen}
        onOk={handleImport} onCancel={() => setImportOpen(false)} okText="导入" cancelText="取消">
        <div style={{ marginBottom: 12 }}>
          <span>原因分类：</span>
          <Select value={importReason} onChange={setImportReason} style={{ width: 160, marginLeft: 8 }}>
            {Object.entries(REASON_LABELS).map(([v, l]) => (
              <Select.Option key={v} value={v}>{l}</Select.Option>
            ))}
          </Select>
        </div>
        <Input.TextArea
          rows={10} value={importText} onChange={e => setImportText(e.target.value)}
          placeholder="每行一个号码，或逗号分隔&#10;13800000001&#10;13800000002&#10;13800000003"
        />
        <div style={{ marginTop: 8, color: '#888', fontSize: 12 }}>
          共 {importText.split(/[\n,，]/).map(s => s.trim()).filter(Boolean).length} 个号码
        </div>
      </Modal>
    </div>
  );
};

export default DncManagement;
