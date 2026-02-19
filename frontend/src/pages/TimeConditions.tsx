import React, { useEffect, useState } from 'react';
import {
  Table, Card, Button, Tag, Space, Modal, Form, Input, Select,
  Switch, message, Tooltip, Popconfirm, TimePicker, Checkbox, Badge, Radio,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import timeConditionService, { TimeCondition } from '@/services/timeCondition';

const DAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const DEST_TYPES = [
  { label: '分机', value: 'extension' },
  { label: 'IVR', value: 'ivr' },
  { label: '语音队列', value: 'queue' },
  { label: '挂断', value: 'hangup' },
];

const FORCE_MODES = [
  { label: '自动（按时间表）', value: 'auto' },
  { label: '强制开启', value: 'force_open' },
  { label: '强制关闭', value: 'force_closed' },
];

const TimeConditions: React.FC = () => {
  const [items, setItems] = useState<TimeCondition[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusMap, setStatusMap] = useState<Record<string, boolean>>({});
  const [form] = Form.useForm();

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await timeConditionService.getAll();
      setItems(res.rows);
      setTotal(res.count);
    } catch { message.error('加载失败'); }
    finally { setLoading(false); }
  };

  const checkStatus = async (ids: string[]) => {
    const map: Record<string, boolean> = {};
    await Promise.all(ids.map(async id => {
      try {
        const res = await timeConditionService.check(id);
        map[id] = res.matched;
      } catch { map[id] = false; }
    }));
    setStatusMap(map);
  };

  useEffect(() => { fetchItems(); }, []);
  useEffect(() => {
    if (items.length > 0) checkStatus(items.map(i => i.id));
    const t = setInterval(() => {
      if (items.length > 0) checkStatus(items.map(i => i.id));
    }, 30000);
    return () => clearInterval(t);
  }, [items]);

  const openCreate = () => { setEditingId(null); form.resetFields(); setModalOpen(true); };
  const openEdit = (tc: TimeCondition) => {
    setEditingId(tc.id);
    const timeRanges = (tc.timeRanges || []).map((r: any) => ({
      ...r,
      start: r.startTime ? dayjs(r.startTime, 'HH:mm') : null,
      end: r.endTime ? dayjs(r.endTime, 'HH:mm') : null,
    }));
    form.setFieldsValue({ ...tc, timeRanges });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const timeRanges = (values.timeRanges || []).map((r: any) => ({
        days: r.days || [],
        startTime: r.start ? r.start.format('HH:mm') : '00:00',
        endTime: r.end ? r.end.format('HH:mm') : '23:59',
      }));
      const payload = { ...values, timeRanges };

      if (editingId) {
        await timeConditionService.update(editingId, payload);
        message.success('时间条件更新成功');
      } else {
        await timeConditionService.create(payload);
        message.success('时间条件创建成功');
      }
      setModalOpen(false);
      fetchItems();
    } catch (e: any) { message.error(e.message || '保存失败'); }
  };

  const handleDelete = async (id: string) => {
    try { await timeConditionService.remove(id); message.success('已删除'); fetchItems(); }
    catch (e: any) { message.error(e.message); }
  };

  const handleForceMode = async (id: string, mode: string) => {
    try {
      await timeConditionService.setForceMode(id, mode as 'auto' | 'force_open' | 'force_closed');
      message.success('模式已更新');
      fetchItems();
    } catch (e: any) { message.error(e.message); }
  };

  const columns: ColumnsType<TimeCondition> = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '当前状态', key: 'status',
      render: (_, r) => statusMap[r.id] !== undefined
        ? (statusMap[r.id] ? <Badge status="success" text="时间内" /> : <Badge status="error" text="时间外" />)
        : <Badge status="processing" text="检测中" />,
    },
    {
      title: '强制模式', dataIndex: 'forceMode', key: 'forceMode',
      render: (mode, r) => (
        <Select value={mode} size="small" style={{ width: 140 }}
          onChange={v => handleForceMode(r.id, v)}>
          {FORCE_MODES.map(m => <Select.Option key={m.value} value={m.value}>{m.label}</Select.Option>)}
        </Select>
      ),
    },
    {
      title: '时间内目的地', key: 'match',
      render: (_, r) => r.matchDestinationType
        ? <Tag color="green">{DEST_TYPES.find(d => d.value === r.matchDestinationType)?.label} {r.matchDestinationId}</Tag>
        : '—',
    },
    {
      title: '时间外目的地', key: 'nomatch',
      render: (_, r) => r.noMatchDestinationType
        ? <Tag color="red">{DEST_TYPES.find(d => d.value === r.noMatchDestinationType)?.label} {r.noMatchDestinationId}</Tag>
        : '—',
    },
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
      <Card title="时间条件管理" extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchItems}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增时间条件</Button>
        </Space>
      }>
        <Table<TimeCondition> columns={columns} dataSource={items} rowKey="id" loading={loading}
          expandable={{
            expandedRowRender: (r) => (
              <div style={{ padding: '8px 16px' }}>
                {(r.timeRanges || []).map((tr: any, i: number) => (
                  <div key={i} style={{ marginBottom: 4 }}>
                    <Tag>时间段 {i + 1}</Tag>
                    {(tr.days || []).map((d: number) => <Tag key={d} color="blue">{DAYS[d]}</Tag>)}
                    <span style={{ marginLeft: 8 }}>{tr.startTime} — {tr.endTime}</span>
                  </div>
                ))}
                {(r.holidays || []).length > 0 && (
                  <div><Tag color="orange">节假日</Tag>{(r.holidays || []).join('、')}</div>
                )}
              </div>
            ),
          }}
          pagination={{ total, showTotal: t => `共 ${t} 条` }}
        />
      </Card>

      <Modal title={editingId ? '编辑时间条件' : '新增时间条件'} open={modalOpen}
        onOk={handleSave} onCancel={() => setModalOpen(false)} okText="保存" cancelText="取消" width={680}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="描述"><Input /></Form.Item>
          <Form.Item name="forceMode" label="强制模式" initialValue="auto">
            <Radio.Group options={FORCE_MODES} />
          </Form.Item>

          <div style={{ fontWeight: 600, marginBottom: 8 }}>时间表</div>
          <Form.List name="timeRanges">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name }) => (
                  <div key={key} style={{ background: '#fafafa', padding: 12, borderRadius: 6, marginBottom: 8 }}>
                    <Form.Item name={[name, 'days']} label="适用星期">
                      <Checkbox.Group options={DAYS.map((d, i) => ({ label: d, value: i }))} />
                    </Form.Item>
                    <Space>
                      <Form.Item name={[name, 'start']} label="开始时间" style={{ marginBottom: 0 }}>
                        <TimePicker format="HH:mm" minuteStep={15} />
                      </Form.Item>
                      <Form.Item name={[name, 'end']} label="结束时间" style={{ marginBottom: 0 }}>
                        <TimePicker format="HH:mm" minuteStep={15} />
                      </Form.Item>
                      <Button danger size="small" onClick={() => remove(name)} style={{ marginTop: 24 }}>删除</Button>
                    </Space>
                  </div>
                ))}
                <Button icon={<PlusOutlined />} onClick={() => add()} block>添加时间段</Button>
              </>
            )}
          </Form.List>

          <Form.Item name="holidays" label="节假日（格式：YYYY-MM-DD，多个逗号分隔）" style={{ marginTop: 12 }}>
            <Input placeholder="2024-01-01,2024-02-10" />
          </Form.Item>

          <div style={{ fontWeight: 600, margin: '16px 0 8px' }}>时间条件成立时（时间内）</div>
          <Space style={{ width: '100%' }}>
            <Form.Item name="matchDestinationType" label="类型" style={{ flex: 1 }}>
              <Select options={DEST_TYPES} allowClear />
            </Form.Item>
            <Form.Item name="matchDestinationId" label="目的地 ID" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </Space>

          <div style={{ fontWeight: 600, marginBottom: 8 }}>时间条件不成立时（时间外）</div>
          <Space style={{ width: '100%' }}>
            <Form.Item name="noMatchDestinationType" label="类型" style={{ flex: 1 }}>
              <Select options={DEST_TYPES} allowClear />
            </Form.Item>
            <Form.Item name="noMatchDestinationId" label="目的地 ID" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
};

export default TimeConditions;
