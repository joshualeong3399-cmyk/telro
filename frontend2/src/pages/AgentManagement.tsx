import { useState, useEffect, useCallback } from 'react'
import {
  Card, Table, Button, Input, Space, Tag, Modal, Form,
  Select, Popconfirm, Typography, message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { agentService } from '@/services/agentService'
import type { Agent, AgentStatus } from '@/services/agentService'

const STATUS_CONFIG: Record<AgentStatus, { label: string; color: string }> = {
  online:  { label: '在线', color: 'green' },
  busy:    { label: '忙碌', color: 'red' },
  away:    { label: '休息', color: 'orange' },
  offline: { label: '离线', color: 'default' },
}

const SKILL_GROUPS = ['销售组', '客服组', '技术支持组', 'VIP专属组', '投诉处理组']

const NAMES = ['张伟', '李娜', '王芳', '刘洋', '陈静', '赵磊', '孙敏', '钱军', '周婷', '吴杰']
const STATUSES: AgentStatus[] = ['online', 'busy', 'away', 'offline']

const MOCK_AGENTS: Agent[] = Array.from({ length: 25 }, (_, i) => ({
  id: i + 1,
  agentNo: `A${String(i + 1).padStart(3, '0')}`,
  name: NAMES[i % 10],
  extension: String(8001 + i),
  status: STATUSES[i % 4],
  skillGroup: SKILL_GROUPS[i % 5],
}))

const AgentManagement: React.FC = () => {
  const [data, setData] = useState<Agent[]>(MOCK_AGENTS)
  const [total, setTotal] = useState(MOCK_AGENTS.length)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Agent | null>(null)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [form] = Form.useForm()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await agentService.list({ page, pageSize: 10, keyword })
      setData(res.records)
      setTotal(res.total)
    } catch { /* use mock */ } finally { setLoading(false) }
  }, [page, keyword])

  useEffect(() => { fetchData() }, [fetchData])

  const openCreate = () => {
    setEditingItem(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (item: Agent) => {
    setEditingItem(item)
    form.setFieldsValue(item)
    setModalOpen(true)
  }

  const handleDelete = async (id: number) => {
    try { await agentService.remove(id) } catch { /* ignore */ }
    setData(prev => prev.filter(r => r.id !== id))
    setTotal(prev => prev - 1)
    message.success('删除成功')
  }

  const handleSubmit = async () => {
    setSubmitLoading(true)
    try {
      const values = await form.validateFields()
      if (editingItem) {
        try { await agentService.update(editingItem.id, values) } catch { /* ignore */ }
        setData(prev => prev.map(r => r.id === editingItem.id ? { ...r, ...values } : r))
        message.success('更新成功')
      } else {
        const optimistic: Agent = { ...values, id: Date.now() }
        try {
          const res = await agentService.create(values)
          setData(prev => [res, ...prev])
        } catch { setData(prev => [optimistic, ...prev]) }
        setTotal(prev => prev + 1)
        message.success('创建成功')
      }
      setModalOpen(false)
    } finally { setSubmitLoading(false) }
  }

  const columns: ColumnsType<Agent> = [
    { title: '坐席工号', dataIndex: 'agentNo', key: 'agentNo', width: 100 },
    { title: '姓名', dataIndex: 'name', key: 'name', width: 100 },
    { title: '分机号', dataIndex: 'extension', key: 'extension', width: 100 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (s: AgentStatus) => <Tag color={STATUS_CONFIG[s].color}>{STATUS_CONFIG[s].label}</Tag>,
      filters: Object.entries(STATUS_CONFIG).map(([v, c]) => ({ text: c.label, value: v })),
      onFilter: (value, record) => record.status === value,
    },
    { title: '技能组', dataIndex: 'skillGroup', key: 'skillGroup' },
    {
      title: '操作', key: 'action', width: 130, align: 'center',
      render: (_, record) => (
        <Space size={0}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除该坐席？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>坐席管理</Typography.Title>
      <Card>
        <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
          <Input.Search
            placeholder="搜索工号/姓名/分机号..."
            style={{ width: 280 }}
            allowClear
            onSearch={(v) => { setPage(1); setKeyword(v) }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建坐席</Button>
        </div>
        <Table
          dataSource={data}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="middle"
          pagination={{
            current: page, pageSize: 10, total,
            onChange: p => setPage(p),
            showSizeChanger: false,
            showTotal: t => `共 ${t} 条`,
          }}
        />
      </Card>

      <Modal
        title={editingItem ? '编辑坐席' : '新建坐席'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitLoading}
        destroyOnClose
        width={480}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="agentNo" label="坐席工号" rules={[{ required: true, message: '请输入坐席工号' }]}>
            <Input placeholder="如：A001" />
          </Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input placeholder="坐席姓名" />
          </Form.Item>
          <Form.Item name="extension" label="分机号" rules={[{ required: true, message: '请输入分机号' }]}>
            <Input placeholder="如：8001" />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]} initialValue="offline">
            <Select
              options={Object.entries(STATUS_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))}
            />
          </Form.Item>
          <Form.Item name="skillGroup" label="技能组" rules={[{ required: true, message: '请选择技能组' }]}>
            <Select
              placeholder="选择技能组"
              options={SKILL_GROUPS.map(g => ({ value: g, label: g }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default AgentManagement
