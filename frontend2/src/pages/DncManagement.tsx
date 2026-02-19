import { useState } from 'react'
import { Card, Table, Button, Space, message, Modal, Form, Input, Upload, Tag, Popconfirm } from 'antd'
import { PlusOutlined, DeleteOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { UploadProps } from 'antd'

interface DncRecord {
  id: number
  phoneNumber: string
  reason: string
  source: 'manual' | 'auto' | 'import'
  createdBy: string
  createdAt: string
}

const DncManagement = () => {
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [uploadModalVisible, setUploadModalVisible] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [form] = Form.useForm()

  const [dncList] = useState<DncRecord[]>([
    {
      id: 1,
      phoneNumber: '13800138000',
      reason: '用户主动要求加入黑名单',
      source: 'manual',
      createdBy: 'admin',
      createdAt: '2026-02-15 10:30:00',
    },
    {
      id: 2,
      phoneNumber: '13900139000',
      reason: '多次投诉骚扰',
      source: 'auto',
      createdBy: 'system',
      createdAt: '2026-02-14 16:20:00',
    },
    {
      id: 3,
      phoneNumber: '13700137000',
      reason: '批量导入黑名单',
      source: 'import',
      createdBy: 'operator01',
      createdAt: '2026-02-10 09:00:00',
    },
  ])

  const sourceMap = {
    manual: { text: '手动添加', color: 'blue' },
    auto: { text: '自动添加', color: 'orange' },
    import: { text: '批量导入', color: 'green' },
  }

  const columns: ColumnsType<DncRecord> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 70,
    },
    {
      title: '电话号码',
      dataIndex: 'phoneNumber',
      width: 150,
    },
    {
      title: '加入原因',
      dataIndex: 'reason',
      ellipsis: true,
    },
    {
      title: '来源',
      dataIndex: 'source',
      width: 120,
      render: (source: DncRecord['source']) => (
        <Tag color={sourceMap[source].color}>{sourceMap[source].text}</Tag>
      ),
    },
    {
      title: '添加人',
      dataIndex: 'createdBy',
      width: 120,
    },
    {
      title: '添加时间',
      dataIndex: 'createdAt',
      width: 170,
    },
    {
      title: '操作',
      fixed: 'right',
      width: 100,
      render: (_, record) => (
        <Popconfirm
          title="确认移除"
          description="确定要将此号码从黑名单中移除吗？"
          onConfirm={() => handleDelete(record.id)}
          okText="确定"
          cancelText="取消"
        >
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>
            移除
          </Button>
        </Popconfirm>
      ),
    },
  ]

  const uploadProps: UploadProps = {
    name: 'file',
    accept: '.txt,.csv,.xlsx',
    beforeUpload: (file) => {
      const isValidType = file.type === 'text/plain' || 
                          file.type === 'text/csv' || 
                          file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      if (!isValidType) {
        message.error('仅支持 TXT、CSV、XLSX 格式文件！')
        return false
      }
      const isLt10M = file.size / 1024 / 1024 < 10
      if (!isLt10M) {
        message.error('文件大小不能超过 10MB！')
        return false
      }
      return false // 阻止自动上传
    },
    onChange: (_info) => {
      // file list handled by Upload component
    },
  }

  const handleAdd = () => {
    form.resetFields()
    setModalVisible(true)
  }

  const handleDelete = (id: number) => {
    message.success(`已移除号码 #${id}`)
  }

  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要移除的号码')
      return
    }
    Modal.confirm({
      title: '批量移除确认',
      content: `确定要移除选中的 ${selectedRowKeys.length} 个号码吗？`,
      okText: '确定',
      cancelText: '取消',
      onOk: () => {
        message.success(`已批量移除 ${selectedRowKeys.length} 个号码`)
        setSelectedRowKeys([])
      },
    })
  }

  const handleExport = () => {
    message.success('导出功能开发中')
  }

  const handleImport = () => {
    setUploadModalVisible(true)
  }

  const handleUploadSubmit = () => {
    message.success('批量导入成功')
    setUploadModalVisible(false)
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
        title="DNC 黑名单管理"
        extra={
          <Space>
            <Button icon={<UploadOutlined />} onClick={handleImport}>
              批量导入
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              导出列表
            </Button>
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={handleBatchDelete}
              disabled={selectedRowKeys.length === 0}
            >
              批量移除 ({selectedRowKeys.length})
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              手动添加
            </Button>
          </Space>
        }
      >
        <Table
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          columns={columns}
          dataSource={dncList}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条黑名单号码`,
          }}
        />
      </Card>

      {/* 手动添加 Modal */}
      <Modal
        title="手动添加黑名单"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={loading}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 24 }}>
          <Form.Item
            name="phoneNumber"
            label="电话号码"
            rules={[
              { required: true, message: '请输入电话号码' },
              { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号码' },
            ]}
          >
            <Input placeholder="例如：13800138000" maxLength={11} />
          </Form.Item>

          <Form.Item
            name="reason"
            label="加入原因"
            rules={[{ required: true, message: '请输入加入原因' }]}
          >
            <Input.TextArea rows={3} placeholder="填写号码加入黑名单的原因" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量导入 Modal */}
      <Modal
        title="批量导入黑名单"
        open={uploadModalVisible}
        onOk={handleUploadSubmit}
        onCancel={() => setUploadModalVisible(false)}
        width={600}
      >
        <div style={{ padding: '24px 0' }}>
          <Upload.Dragger {...uploadProps} maxCount={1}>
            <p className="ant-upload-drag-icon">
              <UploadOutlined style={{ fontSize: 48, color: '#1677ff' }} />
            </p>
            <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
            <p className="ant-upload-hint">
              支持 TXT、CSV、XLSX 格式，每行一个手机号码
            </p>
          </Upload.Dragger>

          <div style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
            <p style={{ margin: 0, fontSize: 12, color: '#666' }}>
              <strong>文件格式要求：</strong>
            </p>
            <ul style={{ margin: '8px 0', paddingLeft: 20, fontSize: 12, color: '#666' }}>
              <li>TXT 文件：每行一个手机号码</li>
              <li>CSV 文件：第一列为手机号码</li>
              <li>XLSX 文件：第一列为手机号码</li>
              <li>单次最多导入 10000 条</li>
            </ul>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default DncManagement
