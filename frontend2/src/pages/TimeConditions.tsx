import { useState, useEffect } from 'react'
import {
  Table, Button, Space, Tag, Modal, Form, Input, Select,
  Switch, Typography, Popconfirm, message, Tooltip, TimePicker, Checkbox,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, ClockCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { timeConditionService } from '@/services/timeConditionService'
import type { TimeCondition, TimeRule, CreateTimeConditionDto } from '@/services/timeConditionService'

const { Title, Text } = Typography

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const TIMEZONES = ['Asia/Shanghai', 'Asia/Tokyo', 'America/New_York', 'Europe/London', 'UTC']

const MOCK: TimeCondition[] = [
  {
    id: 1, name: '工作时间', timezone: 'Asia/Shanghai',
    rules: [{ weekdays: [1,2,3,4,5], startTime: '09:00', endTime: '18:00' }],
    matchAction: '销售队列', noMatchAction: '非工作 IVR', enabled: true, createdAt: '2025-01-01',
  },
  {
    id: 2, name: '午休时间', timezone: 'Asia/Shanghai',
    rules: [{ weekdays: [1,2,3,4,5], startTime: '12:00', endTime: '13:30' }],
    matchAction: '语音信箱', noMatchAction: '销售队列', enabled: true, createdAt: '2025-01-05',
  },
]

const TimeConditions: React.FC = () => {
  const [data, setData] = useState<TimeCondition[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<TimeCondition | null>(null)
  const [ruleRows, setRuleRows] = useState<TimeRule[]>([{ weekdays: [1,2,3,4,5], startTime: '09:00', endTime: '18:00' }])
  const [form] = Form.useForm<CreateTimeConditionDto>()

  const load = async () => {
    setLoading(true)
    try { setData(await timeConditionService.list()) }
    catch { setData(MOCK) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditRecord(null); form.resetFields()
    form.setFieldsValue({ timezone: 'Asia/Shanghai', enabled: true })
    setRuleRows([{ weekdays: [1,2,3,4,5], startTime: '09:00', endTime: '18:00' }])
    setModalOpen(true)
  }

  const openEdit = (r: TimeCondition) => {
    setEditRecord(r); form.setFieldsValue(r)
    setRuleRows(r.rules)
    setModalOpen(true)
  }

  const handleSave = async () => {
    const vals = await form.validateFields()
    const dto: CreateTimeConditionDto = { ...vals, rules: ruleRows }
    try {
      if (editRecord) { await timeConditionService.update(editRecord.id, dto); message.success('更新成功') }
      else { await timeConditionService.create(dto); message.success('创建成功') }
      setModalOpen(false); load()
    } catch {
      const fake: TimeCondition = { ...dto, id: Date.now(), enabled: dto.enabled ?? true, createdAt: new Date().toISOString() }
      setData((d) => editRecord ? d.map((x) => x.id === editRecord.id ? { ...x, ...dto } : x) : [...d, fake])
      setModalOpen(false)
    }
  }

  const updateRule = (idx: number, patch: Partial<TimeRule>) => {
    setRuleRows((rows) => rows.map((r, i) => i === idx ? { ...r, ...patch } : r))
  }

  const columns: ColumnsType<TimeCondition> = [
    { title: '名称', dataIndex: 'name', width: 160 },
    { title: '时区', dataIndex: 'timezone', width: 130 },
    {
      title: '规则', key: 'rules', width: 260,
      render: (_, r) => r.rules.map((rule, i) => (
        <div key={i} style={{ marginBottom: 4 }}>
          <Tag color="blue">{rule.weekdays.map((d) => `周${WEEKDAYS[d]}`).join('/')}</Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>{rule.startTime} – {rule.endTime}</Text>
        </div>
      )),
    },
    {
      title: '匹配动作', key: 'actions_col', width: 220,
      render: (_, r) => (
        <Space direction="vertical" size={2}>
          <Space size={4}><Tag color="green">匹配</Tag><Text>{r.matchAction}</Text></Space>
          <Space size={4}><Tag color="red">不匹配</Tag><Text>{r.noMatchAction}</Text></Space>
        </Space>
      ),
    },
    { title: '启用', dataIndex: 'enabled', width: 70, render: (v: boolean) => <Switch checked={v} size="small" disabled /> },
    {
      title: '操作', key: 'op', width: 100, fixed: 'right',
      render: (_, r) => (
        <Space>
          <Tooltip title="编辑"><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /></Tooltip>
          <Popconfirm title="确认删除？" onConfirm={async () => { try { await timeConditionService.delete(r.id) } catch { /* */ } setData((d) => d.filter((x) => x.id !== r.id)) }}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}><ClockCircleOutlined /> 时间条件</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建</Button>
        </Space>
      </div>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} scroll={{ x: 860 }} />

      <Modal title={editRecord ? '编辑时间条件' : '新建时间条件'} open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)} width={560} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="timezone" label="时区">
            <Select>{TIMEZONES.map((t) => <Select.Option key={t} value={t}>{t}</Select.Option>)}</Select>
          </Form.Item>

          <Form.Item label="时间规则">
            {ruleRows.map((rule, idx) => (
              <div key={idx} style={{ background: '#fafafa', padding: 12, borderRadius: 8, marginBottom: 8, border: '1px solid #f0f0f0' }}>
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary" style={{ marginRight: 8 }}>星期：</Text>
                  <Checkbox.Group
                    options={WEEKDAYS.map((d, i) => ({ label: `周${d}`, value: i }))}
                    value={rule.weekdays}
                    onChange={(v) => updateRule(idx, { weekdays: v as number[] })}
                  />
                </div>
                <Space>
                  <Text type="secondary">时间段：</Text>
                  <TimePicker format="HH:mm" value={dayjs(rule.startTime, 'HH:mm')} onChange={(v) => updateRule(idx, { startTime: v?.format('HH:mm') ?? rule.startTime })} />
                  <span>—</span>
                  <TimePicker format="HH:mm" value={dayjs(rule.endTime, 'HH:mm')} onChange={(v) => updateRule(idx, { endTime: v?.format('HH:mm') ?? rule.endTime })} />
                  {ruleRows.length > 1 && (
                    <Button size="small" danger onClick={() => setRuleRows((r) => r.filter((_, i) => i !== idx))}>删除</Button>
                  )}
                </Space>
              </div>
            ))}
            <Button size="small" onClick={() => setRuleRows((r) => [...r, { weekdays: [1,2,3,4,5], startTime: '09:00', endTime: '18:00' }])}>
              + 添加规则
            </Button>
          </Form.Item>

          <Form.Item name="matchAction" label="匹配时目标" rules={[{ required: true }]}><Input placeholder="队列名/分机号/IVR 名" /></Form.Item>
          <Form.Item name="noMatchAction" label="不匹配时目标" rules={[{ required: true }]}><Input placeholder="队列名/分机号/IVR 名" /></Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default TimeConditions
