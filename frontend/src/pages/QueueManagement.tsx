import { useState } from 'react'
import { Card, Table, Button, Space, message, Modal, Form, Input, Select, InputNumber, Tag } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'

interface Queue {
  id: number
  name: string
  extension: string
  strategy: 'ringall' | 'leastrecent' | 'fewestcalls' | 'random' | 'rrmemory'
  timeout: number
  maxWait: number
  memberCount: number
  waitingCount: number
  status: 'active' | 'inactive'
  createdAt: string
}

const QueueManagement = () => {
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingQueue, setEditingQueue] = useState<Queue | null>(null)
  const [form] = Form.useForm()

  const [queues] = useState<Queue[]>([
    {
      id: 1,
      name: '销售队列',
      extension: '6001',
      strategy: 'ringall',
      timeout: 30,
      maxWait: 300,
      memberCount: 8,
      waitingCount: 3,
      status: 'active',
      createdAt: '2026-01-15 10:00:00',
    },
    {
      id: 2,
      name: '客服队列',
      extension: '6002',
      strategy: 'leastrecent',
      timeout: 25,
      maxWait: 600,
      memberCount: 12,
      waitingCount: 5,
      status: 'active',
      createdAt: '2026-01-20 14:30:00',
    },
    {
      id: 3,
      name: '技术支持',
      extension: '6003',
      strategy: 'fewestcalls',
      timeout: 20,
      maxWait: 300,
      memberCount: 5,
      waitingCount: 0,
      status: 'active',
      createdAt: '2026-02-01 09:00:00',
    },
  ])

  const strategyMap = {
    ringall: '全部响铃',
    leastrecent: '最少最近接听',
    fewestcalls: '最少接听次数',
    random: '随机分配',
    rrmemory: '轮询记忆',
  }

  const columns: ColumnsType<Queue> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 70,
    },
    {
      title: '队列名称',
      dataIndex: 'name',
      width: 150,
    },
    {
      title: '队列号码',
      dataIndex: 'extension',
      width: 120,
    },
    {
      title: '分配策略',
      dataIndex: 'strategy',
      width: 150,
      render: (strategy: Queue['strategy']) => strategyMap[strategy],
    },
    {
      title: '响铃超时',
      dataIndex: 'timeout',
      width: 100,
      render: (timeout) => `${timeout} 秒`,
    },
    {
      title: '最大等待',
      dataIndex: 'maxWait',
      width: 100,
      render: (maxWait) => `${maxWait} 秒`,
    },
    {
      title: '成员数',
      dataIndex: 'memberCount',
      width: 100,
      render: (count) => <Tag color="blue">{count} 人</Tag>,
    },
    {
      title: '排队数',
      dataIndex: 'waitingCount',
      width: 100,
      render: (count) => (
        <Tag color={count > 0 ? 'orange' : 'default'}>{count} 人</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: Queue['status']) => (
        <Tag color={status === 'active' ? 'green' : 'default'}>
          {status === 'active' ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
    },
    {
      title: '操作',
      fixed: 'right',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ]

  const handleAdd = () => {
    setEditingQueue(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (queue: Queue) => {
    setEditingQueue(queue)
    form.setFieldsValue(queue)
    setModalVisible(true)
  }

  const handleDelete = (_id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除此队列吗？删除后将无法恢复。',
      okText: '确定',
      cancelText: '取消',
      onOk: () => {
        message.success('删除成功')
      },
    })
  }

  const handleSubmit = async () => {
    try {
      await form.validateFields()
      setLoading(true)
      setModalVisible(false)
    } catch {
      // validation errors shown by form
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="呼叫队列管理"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新建队列
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={queues}
          rowKey="id"
          scroll={{ x: 1300 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Card>

      <Modal
        title={editingQueue ? '编辑队列' : '新建队列'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={loading}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 24 }}>
          <Form.Item
            name="name"
            label="队列名称"
            rules={[{ required: true, message: '请输入队列名称' }]}
          >
            <Input placeholder="例如：销售队列" />
          </Form.Item>

          <Form.Item
            name="extension"
            label="队列号码"
            rules={[
              { required: true, message: '请输入队列号码' },
              { pattern: /^\d{4,6}$/, message: '队列号码为 4-6 位数字' },
            ]}
          >
            <Input placeholder="例如：6001" maxLength={6} />
          </Form.Item>

          <Form.Item
            name="strategy"
            label="分配策略"
            rules={[{ required: true, message: '请选择分配策略' }]}
          >
            <Select placeholder="选择呼叫分配策略">
              <Select.Option value="ringall">全部响铃（所有成员同时响铃）</Select.Option>
              <Select.Option value="leastrecent">最少最近接听（优先分配给最久未接听的坐席）</Select.Option>
              <Select.Option value="fewestcalls">最少接听次数（优先分配给接听次数最少的坐席）</Select.Option>
              <Select.Option value="random">随机分配</Select.Option>
              <Select.Option value="rrmemory">轮询记忆（轮流分配并记住上次位置）</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="timeout"
            label="响铃超时"
            rules={[{ required: true, message: '请输入响铃超时时间' }]}
            initialValue={30}
          >
            <InputNumber min={5} max={300} addonAfter="秒" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="maxWait"
            label="最大等待时间"
            rules={[{ required: true, message: '请输入最大等待时间' }]}
            initialValue={300}
          >
            <InputNumber min={30} max={3600} addonAfter="秒" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="announceFrequency" label="播报频率" initialValue={60}>
            <InputNumber min={0} max={300} addonAfter="秒" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="status" label="队列状态" initialValue="active">
            <Select>
              <Select.Option value="active">启用</Select.Option>
              <Select.Option value="inactive">禁用</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default QueueManagement
