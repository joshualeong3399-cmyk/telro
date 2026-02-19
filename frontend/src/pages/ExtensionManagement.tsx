import { useState, useEffect, useCallback } from 'react'
import {
  Card, Table, Button, Input, Space, Tag, Modal, Form,
  Select, Popconfirm, Typography, message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { extensionService } from '@/services/extensionService'
import type { Extension, ExtensionType, ExtensionStatus } from '@/services/extensionService'

const TYPE_COLORS: Record<ExtensionType, string> = { SIP: 'blue', PJSIP: 'cyan', IAX: 'purple' }
const STATUS_CONFIG: Record<ExtensionStatus, { label: string; color: string }> = {
  registered:   { label: '已注册', color: 'green' },
  unregistered: { label: '未注册', color: 'default' },
}
const EXT_TYPES: ExtensionType[] = ['SIP', 'PJSIP', 'IAX']

const NAMES = ['张伟', '李娜', '王芳', '刘洋', '陈静', '赵磊', '孙敏', '钱军', '周婷', '吴杰']
const MOCK_EXTENSIONS: Extension[] = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  number: String(8001 + i),
  name: NAMES[i % 10],
  type: EXT_TYPES[i % 3],
  status: i % 4 === 3 ? 'unregistered' : 'registered',
  registeredIp: i % 4 === 3 ? '' : `192.168.${Math.floor(i / 5)}.${100 + i}`,
}))

const ExtensionManagement: React.FC = () => {
  const [data, setData] = useState<Extension[]>(MOCK_EXTENSIONS)
  const [total, setTotal] = useState(MOCK_EXTENSIONS.length)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Extension | null>(null)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [form] = Form.useForm()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await extensionService.list({ page, pageSize: 10, keyword })
      setData(res.records)
      setTotal(res.total)
    } catch { /* use mock */ } finally { setLoading(false) }
  }, [page, keyword])

  useEffect(() => { fetchData() }, [fetchData])

  const openCreate = () => { setEditingItem(null); form.resetFields(); setModalOpen(true) }

  const openEdit = (item: Extension) => {
    setEditingItem(item)
    form.setFieldsValue(item)
    setModalOpen(true)
  }

  const handleDelete = async (id: number) => {
    try { await extensionService.remove(id) } catch { /* ignore */ }
    setData(prev => prev.filter(r => r.id !== id))
    setTotal(prev => prev - 1)
    message.success('删除成功')
  }

  const handleSubmit = async () => {
    setSubmitLoading(true)
    try {
      const values = await form.validateFields()
      if (editingItem) {
        try { await extensionService.update(editingItem.id, values) } catch { /* ignore */ }
        setData(prev => prev.map(r => r.id === editingItem.id ? { ...r, ...values } : r))
        message.success('更新成功')
      } else {
        const optimistic: Extension = { ...values, id: Date.now(), registeredIp: '' }
        try {
          const res = await extensionService.create(values)
          setData(prev => [res, ...prev])
        } catch { setData(prev => [optimistic, ...prev]) }
        setTotal(prev => prev + 1)
        message.success('创建成功')
      }
      setModalOpen(false)
    } finally { setSubmitLoading(false) }
  }

  const columns: ColumnsType<Extension> = [
    { title: '分机号', dataIndex: 'number', key: 'number', width: 90 },
    { title: '姓名', dataIndex: 'name', key: 'name', width: 100 },
    {
      title: '类型', dataIndex: 'type', key: 'type', width: 80,
      render: (t: ExtensionType) => <Tag color={TYPE_COLORS[t]}>{t}</Tag>,
      filters: EXT_TYPES.map(t => ({ text: t, value: t })),
      onFilter: (value, record) => record.type === value,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (s: ExtensionStatus) => (
        <Tag color={STATUS_CONFIG[s].color}>{STATUS_CONFIG[s].label}</Tag>
      ),
      filters: Object.entries(STATUS_CONFIG).map(([v, c]) => ({ text: c.label, value: v })),
      onFilter: (value, record) => record.status === value,
    },
    {
      title: '注册 IP', dataIndex: 'registeredIp', key: 'registeredIp',
      render: (v: string) =>
        v ? <span style={{ fontFamily: 'monospace' }}>{v}</span> : <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: '操作', key: 'action', width: 130, align: 'center',
      render: (_, record) => (
        <Space size={0}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除该分机？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>分机管理</Typography.Title>
      <Card>
        <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
          <Input.Search
            placeholder="搜索分机号/姓名..."
            style={{ width: 280 }}
            allowClear
            onSearch={(v) => { setPage(1); setKeyword(v) }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建分机</Button>
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
        title={editingItem ? '编辑分机' : '新建分机'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitLoading}
        destroyOnClose
        width={440}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="number" label="分机号" rules={[{ required: true, message: '请输入分机号' }]}>
            <Input placeholder="如：8001" />
          </Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input placeholder="分机所属人姓名" />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]} initialValue="PJSIP">
            <Select options={EXT_TYPES.map(t => ({ value: t, label: t }))} />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]} initialValue="unregistered">
            <Select
              options={[
                { value: 'registered', label: '已注册' },
                { value: 'unregistered', label: '未注册' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default ExtensionManagement
