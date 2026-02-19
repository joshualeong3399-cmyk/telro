import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  message,
  Tag,
  Upload,
  Progress,
  Statistic,
  Row,
  Col,
  Card,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { queueAPI, Queue, QueueTask } from '@/services/queue';
import type { UploadFile } from 'antd/es/upload/interface';

const QueueManagement: React.FC = () => {
  const [form] = Form.useForm();
  const [queues, setQueues] = useState<Queue[]>([]);
  const [selectedQueue, setSelectedQueue] = useState<Queue | null>(null);
  const [tasks, setTasks] = useState<QueueTask[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [taskModalVisible, setTaskModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  useEffect(() => {
    fetchQueues();
  }, []);

  useEffect(() => {
    if (selectedQueue) {
      fetchQueueDetails(selectedQueue.id);
    }
  }, [selectedQueue]);

  const fetchQueues = async () => {
    setLoading(true);
    try {
      const response = await queueAPI.getList({ limit: 100 });
      setQueues(response.data.data ?? (response.data as any));
    } catch (error) {
      message.error('加载队列列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchQueueDetails = async (queueId: string) => {
    try {
      const [tasksRes, statsRes] = await Promise.all([
        queueAPI.getTasks(queueId, { limit: 100 }),
        queueAPI.getStats(queueId),
      ]);
      setTasks(tasksRes.data.data ?? (tasksRes.data as any));
      setStats(statsRes);
    } catch (error) {
      message.error('加载队列详情失败');
    }
  };

  const handleAddQueue = () => {
    setEditingId(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEditQueue = (queue: Queue) => {
    setEditingId(queue.id);
    form.setFieldsValue(queue);
    setModalVisible(true);
  };

  const handleSubmitQueue = async (values: any) => {
    setLoading(true);
    try {
      if (editingId) {
        await queueAPI.update(editingId, values);
        setQueues(queues.map((q) => (q.id === editingId ? { ...q, ...values } : q)));
        message.success('队列已更新');
      } else {
        const response = await queueAPI.create(values);
        setQueues([response.data, ...queues]);
        message.success('队列已创建');
      }
      setModalVisible(false);
    } catch (error: any) {
      message.error(error.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQueue = async (id: string) => {
    try {
      await queueAPI.delete(id);
      setQueues(queues.filter((q) => q.id !== id));
      if (selectedQueue?.id === id) setSelectedQueue(null);
      message.success('队列已删除');
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  const handleStartQueue = async (queueId: string) => {
    try {
      await queueAPI.start(queueId);
      setQueues(
        queues.map((q) => (q.id === queueId ? { ...q, status: 'active' } : q))
      );
      message.success('队列已启动');
    } catch (error: any) {
      message.error(error.message || '启动失败');
    }
  };

  const handlePauseQueue = async (queueId: string) => {
    try {
      await queueAPI.pause(queueId);
      setQueues(
        queues.map((q) => (q.id === queueId ? { ...q, status: 'paused' } : q))
      );
      message.success('队列已暂停');
    } catch (error: any) {
      message.error(error.message || '暂停失败');
    }
  };

  const handleUploadTasks = async (phoneNumbers: string[]) => {
    if (!selectedQueue) {
      message.error('请先选择队列');
      return;
    }
    try {
      await queueAPI.addTasks(selectedQueue.id, {
        phoneNumbers,
        maxAttempts: 3,
      });
      await fetchQueueDetails(selectedQueue.id);
      setTaskModalVisible(false);
      message.success('任务已上传');
    } catch (error: any) {
      message.error(error.message || '上传失败');
    }
  };

  const queueColumns = [
    { title: '队列名称', dataIndex: 'name', key: 'name' },
    { title: '分机', dataIndex: 'extensionId', key: 'extension' },
    { title: '策略', dataIndex: 'strategy', key: 'strategy' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colors: any = { active: 'green', paused: 'orange', stopped: 'default' };
        const labels: any = { active: '运行中', paused: '已暂停', stopped: '已停止' };
        return <Tag color={colors[status]}>{labels[status]}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record: Queue) => (
        <Space>
          {record.status === 'active' ? (
            <Button
              type="text"
              size="small"
              icon={<PauseCircleOutlined />}
              onClick={() => handlePauseQueue(record.id)}
            />
          ) : (
            <Button
              type="text"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleStartQueue(record.id)}
            />
          )}
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditQueue(record)}
          />
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteQueue(record.id)}
          />
        </Space>
      ),
    },
  ];

  const taskColumns = [
    { title: '电话号码', dataIndex: 'phoneNumber', key: 'phone' },
    { title: '尝试次数', dataIndex: 'attempts', key: 'attempts' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colors: any = { pending: 'default', processing: 'processing', completed: 'success', failed: 'error' };
        const labels: any = { pending: '待处理', processing: '处理中', completed: '已完成', failed: '失败' };
        return <Tag color={colors[status]}>{labels[status]}</Tag>;
      },
    },
    { title: '结果', dataIndex: 'result', key: 'result' },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '16px' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddQueue}>
          新建队列
        </Button>
      </div>

      <Table
        columns={queueColumns}
        dataSource={queues}
        loading={loading}
        rowKey="id"
        onRow={(record) => ({
          onClick: () => setSelectedQueue(record),
          style: {
            cursor: 'pointer',
            backgroundColor: selectedQueue?.id === record.id ? '#e6f7ff' : undefined,
          },
        })}
        pagination={{ pageSize: 10 }}
      />

      {selectedQueue && stats && (
        <>
          <div style={{ marginTop: '24px' }}>
            <Row gutter={16} style={{ marginBottom: '16px' }}>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic title="总任务" value={stats.total} />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic title="已完成" value={stats.completed} />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic title="失败" value={stats.failed} />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic title="成功率" value={(stats.completed / stats.total * 100).toFixed(1)} suffix="%" />
                </Card>
              </Col>
            </Row>
          </div>

          <Card
            title={`${selectedQueue.name} - 任务列表`}
            extra={
              <Button type="primary" onClick={() => setTaskModalVisible(true)}>
                导入号码
              </Button>
            }
          >
            <Table
              columns={taskColumns}
              dataSource={tasks}
              rowKey="id"
              pagination={{ pageSize: 20 }}
            />
          </Card>
        </>
      )}

      <Modal
        title={editingId ? '编辑队列' : '新建队列'}
        open={modalVisible}
        onOk={() => form.submit()}
        onCancel={() => setModalVisible(false)}
        loading={loading}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmitQueue}>
          <Form.Item
            name="name"
            label="队列名称"
            rules={[{ required: true, message: '请输入队列名称' }]}
          >
            <Input placeholder="春季推广" />
          </Form.Item>

          <Form.Item
            name="strategy"
            label="呼出策略"
            rules={[{ required: true, message: '请选择呼出策略' }]}
          >
            <Select>
              <Select.Option value="ringall">全部同时铃响</Select.Option>
              <Select.Option value="roundrobin">轮询</Select.Option>
              <Select.Option value="leastrecent">最少最近呼叫</Select.Option>
              <Select.Option value="fewestcalls">最少通话</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="maxRetries"
            label="最大重试次数"
            rules={[{ required: true }]}
          >
            <Input type="number" placeholder="3" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="导入号码"
        open={taskModalVisible}
        onOk={() => {
          const numbers = form.getFieldValue('numbers') || '';
          const phoneNumbers = numbers.split('\n').filter((n: string) => n.trim());
          handleUploadTasks(phoneNumbers);
        }}
        onCancel={() => setTaskModalVisible(false)}
      >
        <Form>
          <Form.Item label="号码（每行一个）">
            <Input.TextArea
              rows={6}
              placeholder="18600000001&#10;18600000002&#10;18600000003"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default QueueManagement;
