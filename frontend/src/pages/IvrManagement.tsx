import React, { useEffect, useState } from 'react';
import {
  Table, Card, Button, Tag, Space, Modal, Form, Input, InputNumber,
  Select, Switch, message, Tooltip, Popconfirm, Drawer,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, CodeOutlined, SoundOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import ivrService, { IVR, IvrOption } from '@/services/ivr';

const BASE = import.meta.env.VITE_API_URL || '';

const DEST_TYPES = [
  { label: '分机', value: 'extension' },
  { label: '语音队列', value: 'queue' },
  { label: '语音信箱', value: 'voicemail' },
  { label: '挂断', value: 'hangup' },
  { label: 'IVR(嵌套)', value: 'ivr' },
];

interface AudioFile { id: string; name: string; filename: string; asteriskPath: string; }

const IvrManagement: React.FC = () => {
  const [items, setItems] = useState<IVR[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialplanDrawer, setDialplanDrawer] = useState<{ open: boolean; content: string }>({ open: false, content: '' });
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [form] = Form.useForm();

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await ivrService.getAll();
      setItems(res.rows);
      setTotal(res.count);
    } catch { message.error('加载失败'); }
    finally { setLoading(false); }
  };

  const fetchAudioFiles = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${BASE}/api/audio-files`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setAudioFiles(data.audioFiles || data.rows || []);
    } catch {}
  };

  useEffect(() => { fetchItems(); fetchAudioFiles(); }, []);

  const openCreate = () => { setEditingId(null); form.resetFields(); setModalOpen(true); };
  const openEdit = (ivr: IVR) => {
    setEditingId(ivr.id);
    form.setFieldsValue(ivr);
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingId) {
        await ivrService.update(editingId, values);
        message.success('IVR 更新成功');
      } else {
        await ivrService.create(values);
        message.success('IVR 创建成功');
      }
      setModalOpen(false);
      fetchItems();
    } catch (e: any) { message.error(e.message || '保存失败'); }
  };

  const handleDelete = async (id: string) => {
    try { await ivrService.remove(id); message.success('已删除'); fetchItems(); }
    catch (e: any) { message.error(e.message); }
  };

  const handleDialplan = async (id: string) => {
    try {
      const res = await ivrService.getDialplan(id);
      const content = typeof res === 'string' ? res : (res as any).dialplan || JSON.stringify(res, null, 2);
      setDialplanDrawer({ open: true, content });
    } catch (e: any) { message.error('获取 Dialplan 失败'); }
  };

  const columns: ColumnsType<IVR> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '超时(秒)', dataIndex: 'timeout', key: 'timeout', width: 100 },
    { title: '最大重试', dataIndex: 'maxRetries', key: 'maxRetries', width: 100 },
    { title: '直接拨分机', dataIndex: 'directDial', key: 'directDial', render: v => <Switch checked={v} disabled size="small" /> },
    {
      title: '选项数量', key: 'options',
      render: (_, r) => <Tag>{(r.options || []).length} 个</Tag>,
    },
    {
      title: '操作', key: 'actions', render: (_, r) => (
        <Space>
          <Tooltip title="查看 Dialplan"><Button size="small" icon={<CodeOutlined />} onClick={() => handleDialplan(r.id)} /></Tooltip>
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
      <Card title="IVR 语音菜单" extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchItems}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增 IVR</Button>
        </Space>
      }>
        <Table<IVR> columns={columns} dataSource={items} rowKey="id" loading={loading}
          expandable={{
            expandedRowRender: (r) => (
              <div style={{ padding: '8px 16px' }}>
                <strong>按键选项：</strong>
                <Space wrap style={{ marginTop: 8 }}>
                  {(r.options || []).map((opt: IvrOption) => (
                    <Tag key={opt.digit} color="blue">
                      按 [{opt.digit}] → {DEST_TYPES.find(t => t.value === opt.destinationType)?.label} ({opt.destinationId})
                    </Tag>
                  ))}
                </Space>
              </div>
            ),
          }}
          pagination={{ total, showTotal: t => `共 ${t} 条` }}
        />
      </Card>

      <Modal title={editingId ? '编辑 IVR' : '新增 IVR'} open={modalOpen}
        onOk={handleSave} onCancel={() => setModalOpen(false)} okText="保存" cancelText="取消" width={720}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="描述"><Input /></Form.Item>
          <Form.Item name="greeting" label="欢迎语音">
            <Select
              placeholder="从已上传音频文件中选择，或手动输入 Asterisk 路径"
              allowClear
              showSearch
              optionFilterProp="label"
              options={audioFiles.map(f => ({
                label: f.name,
                value: f.asteriskPath || f.filename,
                title: f.filename,
              }))}
              dropdownRender={(menu) => (
                <>
                  {menu}
                  <div style={{ padding: '4px 8px', borderTop: '1px solid #f0f0f0', marginTop: 4 }}>
                    <Input
                      prefix={<SoundOutlined />}
                      placeholder="或手动输入路径，如 ivr/welcome"
                      onPressEnter={(e: any) => {
                        form.setFieldValue('greeting', e.target.value);
                      }}
                    />
                  </div>
                </>
              )}
            />
          </Form.Item>
          <Form.Item name="invalidMessage" label="无效输入提示音">
            <Select
              placeholder="从已上传音频文件中选择"
              allowClear
              showSearch
              optionFilterProp="label"
              options={audioFiles.map(f => ({ label: f.name, value: f.asteriskPath || f.filename }))}
              dropdownRender={(menu) => (
                <>
                  {menu}
                  <div style={{ padding: '4px 8px', borderTop: '1px solid #f0f0f0', marginTop: 4 }}>
                    <Input placeholder="或手动输入路径，如 ivr/invalid"
                      onPressEnter={(e: any) => form.setFieldValue('invalidMessage', e.target.value)} />
                  </div>
                </>
              )}
            />
          </Form.Item>
          <Space style={{ width: '100%' }} size={16}>
            <Form.Item name="timeout" label="等待超时(秒)" initialValue={5} style={{ flex: 1 }}>
              <InputNumber min={1} max={60} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="maxRetries" label="最大重试次数" initialValue={3} style={{ flex: 1 }}>
              <InputNumber min={1} max={10} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Form.Item name="directDial" label="允许直接拨分机" valuePropName="checked" initialValue={false}>
            <Switch />
          </Form.Item>

          <div style={{ fontWeight: 600, marginBottom: 8 }}>按键选项</div>
          <Form.List name="options">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name }) => (
                  <div key={key} style={{ display: 'flex', gap: 8, marginBottom: 8, background: '#fafafa', padding: 8, borderRadius: 4 }}>
                    <Form.Item name={[name, 'digit']} label="按键" style={{ marginBottom: 0, width: 80 }}>
                      <Input maxLength={1} placeholder="0-9,*,#" />
                    </Form.Item>
                    <Form.Item name={[name, 'label']} label="说明" style={{ marginBottom: 0, flex: 1 }}>
                      <Input placeholder="如：销售咨询" />
                    </Form.Item>
                    <Form.Item name={[name, 'destinationType']} label="目的地类型" style={{ marginBottom: 0, width: 140 }}>
                      <Select options={DEST_TYPES} />
                    </Form.Item>
                    <Form.Item name={[name, 'destinationId']} label="目的地 ID" style={{ marginBottom: 0, width: 100 }}>
                      <Input />
                    </Form.Item>
                    <Button danger size="small" style={{ marginTop: 30 }} onClick={() => remove(name)}>删除</Button>
                  </div>
                ))}
                <Button icon={<PlusOutlined />} onClick={() => add()} block>添加按键选项</Button>
              </>
            )}
          </Form.List>

          <div style={{ fontWeight: 600, marginTop: 16, marginBottom: 8 }}>超时/无效后的处理</div>
          <Space style={{ width: '100%' }} size={16}>
            <Form.Item name="timeoutDestinationType" label="超时转至" style={{ flex: 1 }}>
              <Select options={DEST_TYPES} allowClear />
            </Form.Item>
            <Form.Item name="timeoutDestinationId" label="目的地 ID" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      <Drawer title="Asterisk Dialplan 预览" open={dialplanDrawer.open}
        onClose={() => setDialplanDrawer({ open: false, content: '' })} width={600}>
        <pre style={{ fontSize: 12, background: '#111', color: '#0f0', padding: 16, borderRadius: 8, overflowX: 'auto' }}>
          {dialplanDrawer.content}
        </pre>
      </Drawer>
    </div>
  );
};

export default IvrManagement;
