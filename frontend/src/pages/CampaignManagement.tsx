import { useState } from 'react'
import { Card, Table, Button, Space, message, Modal, Form, Input, Select, DatePicker, Switch, Tag, Tooltip } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined, PauseCircleOutlined, CopyOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'

const { TextArea } = Input
const { RangePicker } = DatePicker

interface Campaign {
  id: number
  name: string
  status: 'active' | 'paused' | 'completed' | 'pending'
  customerList: string
  totalCount: number
  completedCount: number
  successCount: number
  successRate: number
  aiFlowId?: number
  aiFlowName?: string
  startTime: string
  endTime?: string
  createdAt: string
}

const CampaignManagement = () => {
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  const [form] = Form.useForm()

  // 模拟数据
  const [campaigns] = useState<Campaign[]>([
    {
      id: 1,
      name: '春季促销活动',
      status: 'active',
      customerList: '客户列表A',
      totalCount: 1000,
      completedCount: 350,
      successCount: 120,
      successRate: 34.29,
      aiFlowId: 1,
      aiFlowName: '保险销售话术',
      startTime: '2026-02-15 09:00:00',
      createdAt: '2026-02-10 10:00:00',
    },
    {
      id: 2,
      name: '客户回访调研',
      status: 'paused',
      customerList: '客户列表B',
      totalCount: 500,
      completedCount: 200,
      successCount: 150,
      successRate: 75.00,
      startTime: '2026-02-12 14:00:00',
      createdAt: '2026-02-08 15:30:00',
    },
    {
      id: 3,
      name: '贷款邀约活动',
      status: 'completed',
      customerList: '客户列表C',
      totalCount: 800,
      completedCount: 800,
      successCount: 240,
      successRate: 30.00,
      aiFlowId: 2,
      aiFlowName: '金融产品推广',
      startTime: '2026-02-01 10:00:00',
      endTime: '2026-02-10 18:00:00',
      createdAt: '2026-01-28 11:00:00',
    },
  ])

  const statusConfig = {
    active: { text: '进行中', color: 'green' },
    paused: { text: '已暂停', color: 'orange' },
    completed: { text: '已完成', color: 'blue' },
    pending: { text: '待开始', color: 'default' },
  }

  const columns: ColumnsType<Campaign> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 70,
    },
    {
      title: '活动名称',
      dataIndex: 'name',
      width: 180,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: Campaign['status']) => (
        <Tag color={statusConfig[status].color}>{statusConfig[status].text}</Tag>
      ),
    },
    {
      title: '客户列表',
      dataIndex: 'customerList',
      width: 150,
    },
    {
      title: '进度',
      width: 200,
      render: (_, record) => {
        const progress = ((record.completedCount / record.totalCount) * 100).toFixed(1)
        return (
          <div>
            <div style={{ marginBottom: 4 }}>
              {record.completedCount} / {record.totalCount} ({progress}%)
            </div>
            <div style={{ width: '100%', height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${progress}%`,
                  height: '100%',
                  background: record.status === 'completed' ? '#52c41a' : '#1677ff',
                  transition: 'width 0.3s',
                }}
              />
            </div>
          </div>
        )
      },
    },
    {
      title: '成功数/率',
      width: 120,
      render: (_, record) => (
        <div>
          <div>{record.successCount}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{record.successRate.toFixed(2)}%</div>
        </div>
      ),
    },
    {
      title: 'AI 流程',
      dataIndex: 'aiFlowName',
      width: 150,
      render: (name) => name || <span style={{ color: '#999' }}>未绑定</span>,
    },
    {
      title: '开始时间',
      dataIndex: 'startTime',
      width: 160,
    },
    {
      title: '操作',
      fixed: 'right',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          {record.status === 'active' && (
            <Tooltip title="暂停">
              <Button
                type="link"
                size="small"
                icon={<PauseCircleOutlined />}
                onClick={() => handlePause(record.id)}
              />
            </Tooltip>
          )}
          {record.status === 'paused' && (
            <Tooltip title="继续">
              <Button
                type="link"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => handleResume(record.id)}
              />
            </Tooltip>
          )}
          <Tooltip title="编辑">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Tooltip title="复制">
            <Button
              type="link"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => handleCopy(record.id)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.id)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

  const handleAdd = () => {
    setEditingCampaign(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (campaign: Campaign) => {
    setEditingCampaign(campaign)
    form.setFieldsValue(campaign)
    setModalVisible(true)
  }

  const handleDelete = (_id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除此群呼活动吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: () => {
        message.success('删除成功')
      },
    })
  }

  const handleCopy = (id: number) => {
    message.success(`已复制活动 #${id}`)
  }

  const handlePause = (id: number) => {
    message.success(`已暂停活动 #${id}`)
  }

  const handleResume = (id: number) => {
    message.success(`已恢复活动 #${id}`)
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
        title="群呼活动管理"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新建活动
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={campaigns}
          rowKey="id"
          scroll={{ x: 1400 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Card>

      <Modal
        title={editingCampaign ? '编辑活动' : '新建活动'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={loading}
        width={700}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 24 }}>
          <Form.Item
            name="name"
            label="活动名称"
            rules={[{ required: true, message: '请输入活动名称' }]}
          >
            <Input placeholder="例如：春季促销活动" />
          </Form.Item>

          <Form.Item
            name="customerListId"
            label="客户列表"
            rules={[{ required: true, message: '请选择客户列表' }]}
          >
            <Select placeholder="选择客户列表">
              <Select.Option value={1}>客户列表A（1000 人）</Select.Option>
              <Select.Option value={2}>客户列表B（500 人）</Select.Option>
              <Select.Option value={3}>客户列表C（800 人）</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="aiFlowId" label="AI 流程（可选）">
            <Select placeholder="选择 AI 话术流程" allowClear>
              <Select.Option value={1}>保险销售话术</Select.Option>
              <Select.Option value={2}>金融产品推广</Select.Option>
              <Select.Option value={3}>电商客户回访</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="timeRange"
            label="执行时间"
            rules={[{ required: true, message: '请选择执行时间' }]}
          >
            <RangePicker showTime style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="maxConcurrent" label="最大并发数" initialValue={10}>
            <Input type="number" min={1} max={100} addonAfter="路" />
          </Form.Item>

          <Form.Item name="retryTimes" label="重拨次数" initialValue={2}>
            <Input type="number" min={0} max={5} addonAfter="次" />
          </Form.Item>

          <Form.Item name="dtmfEnabled" label="DTMF 按键检测" valuePropName="checked" initialValue={false}>
            <Switch />
          </Form.Item>

          <Form.Item name="description" label="活动描述">
            <TextArea rows={3} placeholder="填写活动描述信息" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default CampaignManagement
