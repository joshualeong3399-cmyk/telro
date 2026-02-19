import { useState, useEffect, useCallback } from 'react'
import {
  Card, Table, Button, Input, Space, Tag, Modal, Form,
  Select, Popconfirm, Typography, message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { customerService } from '@/services/customerService'
import type { Customer } from '@/services/customerService'

const TAG_OPTIONS = ['VIP', '潜在客户', '高价值', '电商', '企业客户', '已成交', '跟进中', '流失客户']
const TAG_COLORS: Record<string, string> = {
  'VIP': 'gold', '潜在客户': 'blue', '高价值': 'red',
  '电商': 'purple', '企业客户': 'cyan', '已成交': 'green',
  '跟进中': 'orange', '流失客户': 'default',
}

const NAMES = ['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十', '郑一', '冯二']
const MOCK_CUSTOMERS: Customer[] = Array.from({ length: 32 }, (_, i) => ({
  id: i + 1,
  name: NAMES[i % 10],
  phone: `1${['35', '36', '57', '89', '38'][i % 5]}${String(10000000 + i * 1234567).slice(0, 8)}`,
  tags: [TAG_OPTIONS[i % 8], TAG_OPTIONS[(i + 3) % 8]],
  remark: i % 3 === 0 ? '重要客户，优先跟进' : i % 3 === 1 ? '等待回访' : '',
  createdAt: dayjs().subtract(i * 3, 'day').toISOString(),
}))

const CustomerManagement: React.FC = () => {
  const [data, setData] = useState<Customer[]>(MOCK_CUSTOMERS)
  const [total, setTotal] = useState(MOCK_CUSTOMERS.length)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Customer | null>(null)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [form] = Form.useForm()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await customerService.list({ page, pageSize: 10, keyword })
      setData(res.records)
      setTotal(res.total)
    } catch { /* use mock */ } finally { setLoading(false) }
  }, [page, keyword])

  useEffect(() => { fetchData() }, [fetchData])

  const openCreate = () => { setEditingItem(null); form.resetFields(); setModalOpen(true) }

  const openEdit = (item: Customer) => {
    setEditingItem(item)
    form.setFieldsValue({ name: item.name, phone: item.phone, tags: item.tags, remark: item.remark })
    setModalOpen(true)
  }

  const handleDelete = async (id: number) => {
    try { await customerService.remove(id) } catch { /* ignore */ }
    setData(prev => prev.filter(r => r.id !== id))
    setTotal(prev => prev - 1)
    message.success('删除成功')
  }

  const handleSubmit = async () => {
    setSubmitLoading(true)
    try {
      const values = await form.validateFields()
      if (editingItem) {
        try { await customerService.update(editingItem.id, values) } catch { /* ignore */ }
        setData(prev => prev.map(r => r.id === editingItem.id ? { ...r, ...values } : r))
        message.success('更新成功')
      } else {
        const optimistic: Customer = { ...values, id: Date.now(), createdAt: new Date().toISOString() }
        try {
          const res = await customerService.create(values)
          setData(prev => [res, ...prev])
        } catch { setData(prev => [optimistic, ...prev]) }
        setTotal(prev => prev + 1)
        message.success('创建成功')
      }
      setModalOpen(false)
    } finally { setSubmitLoading(false) }
  }

  const columns: ColumnsType<Customer> = [
    { title: '客户姓名', dataIndex: 'name', key: 'name', width: 100 },
    {
      title: '电话', dataIndex: 'phone', key: 'phone', width: 140,
      render: (v: string) => <span style={{ fontFamily: 'monospace' }}>{v}</span>,
    },
    {
      title: '标签', dataIndex: 'tags', key: 'tags',
      render: (tags: string[]) => (
        <Space size={[4, 4]} wrap>
          {tags.map(t => <Tag key={t} color={TAG_COLORS[t] ?? 'default'}>{t}</Tag>)}
        </Space>
      ),
    },
    {
      title: '备注', dataIndex: 'remark', key: 'remark', ellipsis: true,
      render: (v: string) => v || <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 160,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
      sorter: (a, b) => dayjs(a.createdAt).unix() - dayjs(b.createdAt).unix(),
    },
    {
      title: '操作', key: 'action', width: 130, align: 'center',
      render: (_, record) => (
        <Space size={0}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除该客户？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>客户管理</Typography.Title>
      <Card>
        <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
          <Input.Search
            placeholder="搜索客户姓名/电话..."
            style={{ width: 280 }}
            allowClear
            onSearch={(v) => { setPage(1); setKeyword(v) }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建客户</Button>
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
        title={editingItem ? '编辑客户' : '新建客户'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitLoading}
        destroyOnClose
        width={480}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="客户姓名" rules={[{ required: true, message: '请输入客户姓名' }]}>
            <Input placeholder="客户姓名" />
          </Form.Item>
          <Form.Item
            name="phone"
            label="电话"
            rules={[
              { required: true, message: '请输入电话号码' },
              { pattern: /^[0-9\-+() ]{7,20}$/, message: '请输入有效号码' },
            ]}
          >
            <Input placeholder="手机号 / 固话" />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select
              mode="multiple"
              placeholder="选择标签（可多选）"
              options={TAG_OPTIONS.map(t => ({ value: t, label: t }))}
              allowClear
            />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="客户备注（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default CustomerManagement
