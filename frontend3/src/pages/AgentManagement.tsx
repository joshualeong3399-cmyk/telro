import React, { useEffect, useState } from 'react';
import {
  Table,
  Card,
  Button,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Select,
  message,
  Tooltip,
  Badge,
  Statistic,
  Row,
  Col,
  Drawer,
  Descriptions,
  Progress,
} from 'antd';
import {
  UserOutlined,
  LogoutOutlined,
  LoginOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import agentService, { Agent } from '@/services/agent';

const { Option } = Select;

const statusColorMap: Record<string, string> = {
  logged_in: 'green',
  logged_out: 'default',
  on_break: 'orange',
  on_call: 'blue',
};

const statusLabelMap: Record<string, string> = {
  logged_in: '在线',
  logged_out: '离线',
  on_break: '休息',
  on_call: '通话中',
};

const AgentManagement: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [editForm] = Form.useForm();

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const res = await agentService.getAgents({
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setAgents(res.rows);
      setTotal(res.count);
    } catch {
      message.error('加载坐席列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, [page]);

  const handleLogin = async (agent: Agent) => {
    try {
      await agentService.agentLogin(agent.extensionId);
      message.success(`坐席 ${agent.user?.username ?? agent.id} 已签入`);
      fetchAgents();
    } catch (e: any) {
      message.error(e.message || '签入失败');
    }
  };

  const handleLogout = async (agent: Agent) => {
    try {
      await agentService.agentLogout(agent.extensionId);
      message.success(`坐席 ${agent.user?.username ?? agent.id} 已签出`);
      fetchAgents();
    } catch (e: any) {
      message.error(e.message || '签出失败');
    }
  };

  const openEditModal = (agent: Agent) => {
    setSelectedAgent(agent);
    editForm.setFieldsValue({
      department: agent.department,
      notes: agent.notes,
      skillTags: agent.skillTags,
    });
    setEditModalOpen(true);
  };

  const handleEditSave = async () => {
    if (!selectedAgent) return;
    try {
      const values = await editForm.validateFields();
      await agentService.updateAgent(selectedAgent.id, values);
      message.success('坐席信息更新成功');
      setEditModalOpen(false);
      fetchAgents();
    } catch (e: any) {
      message.error(e.message || '更新失败');
    }
  };

  const openDetail = (agent: Agent) => {
    setSelectedAgent(agent);
    setDetailDrawerOpen(true);
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  // 统计卡片数据
  const onlineCount = agents.filter((a) => a.status === 'logged_in').length;
  const onCallCount = agents.filter((a) => a.status === 'on_call').length;
  const breakCount = agents.filter((a) => a.status === 'on_break').length;

  const columns: ColumnsType<Agent> = [
    {
      title: '坐席',
      dataIndex: 'id',
      key: 'agent',
      render: (_: string, record: Agent) => (
        <Space>
          <Badge color={statusColorMap[record.status]} />
          <span
            className="link-text"
            style={{ cursor: 'pointer', color: '#1677ff' }}
            onClick={() => openDetail(record)}
          >
            {record.user?.username ?? record.id.slice(0, 8)}
          </span>
        </Space>
      ),
    },
    {
      title: '分机号',
      key: 'extension',
      render: (_: unknown, record: Agent) => record.extension?.number ?? '—',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={statusColorMap[status]}>{statusLabelMap[status]}</Tag>
      ),
    },
    {
      title: '部门',
      dataIndex: 'department',
      key: 'department',
      render: (v: string) => v || '—',
    },
    {
      title: '技能标签',
      dataIndex: 'skillTags',
      key: 'skillTags',
      render: (tags: string[]) =>
        tags && tags.length > 0
          ? tags.map((t) => <Tag key={t}>{t}</Tag>)
          : '—',
    },
    {
      title: '今日工时',
      dataIndex: 'currentDayDuration',
      key: 'currentDayDuration',
      render: (v: number) => formatDuration(v),
    },
    {
      title: '评分',
      dataIndex: 'performanceRating',
      key: 'performanceRating',
      render: (v: number) => (
        <Progress percent={v * 20} size="small" status="active" format={(p) => `${v}/5`} />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: Agent) => (
        <Space>
          {record.status === 'logged_out' ? (
            <Tooltip title="签入">
              <Button
                type="primary"
                size="small"
                icon={<LoginOutlined />}
                onClick={() => handleLogin(record)}
              >
                签入
              </Button>
            </Tooltip>
          ) : (
            <Tooltip title="签出">
              <Button
                danger
                size="small"
                icon={<LogoutOutlined />}
                onClick={() => handleLogout(record)}
              >
                签出
              </Button>
            </Tooltip>
          )}
          <Tooltip title="编辑">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEditModal(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* 统计概览 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总坐席"
              value={total}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="在线"
              value={onlineCount}
              valueStyle={{ color: '#52c41a' }}
              prefix={<Badge color="green" />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="通话中"
              value={onCallCount}
              valueStyle={{ color: '#1677ff' }}
              prefix={<Badge color="blue" />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="休息中"
              value={breakCount}
              valueStyle={{ color: '#faad14' }}
              prefix={<Badge color="orange" />}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="坐席管理"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchAgents}>
              刷新
            </Button>
          </Space>
        }
      >
        <Table<Agent>
          columns={columns}
          dataSource={agents}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: setPage,
            showTotal: (t) => `共 ${t} 个坐席`,
          }}
        />
      </Card>

      {/* 编辑弹窗 */}
      <Modal
        title="编辑坐席信息"
        open={editModalOpen}
        onOk={handleEditSave}
        onCancel={() => setEditModalOpen(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="department" label="部门">
            <Input placeholder="请输入部门名称" />
          </Form.Item>
          <Form.Item name="skillTags" label="技能标签">
            <Select mode="tags" placeholder="输入技能后按 Enter 确认" />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} placeholder="备注信息" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情抽屉 */}
      <Drawer
        title="坐席详情"
        width={480}
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
      >
        {selectedAgent && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="坐席 ID">{selectedAgent.id}</Descriptions.Item>
            <Descriptions.Item label="用户名">
              {selectedAgent.user?.username ?? '—'}
            </Descriptions.Item>
            <Descriptions.Item label="分机号">
              {selectedAgent.extension?.number ?? '—'}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusColorMap[selectedAgent.status]}>
                {statusLabelMap[selectedAgent.status]}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="部门">{selectedAgent.department || '—'}</Descriptions.Item>
            <Descriptions.Item label="技能标签">
              {selectedAgent.skillTags?.map((t) => <Tag key={t}>{t}</Tag>)}
            </Descriptions.Item>
            <Descriptions.Item label="今日工时">
              {formatDuration(selectedAgent.currentDayDuration)}
            </Descriptions.Item>
            <Descriptions.Item label="累计工时">
              {formatDuration(selectedAgent.totalWorkDuration)}
            </Descriptions.Item>
            <Descriptions.Item label="绩效评分">
              {selectedAgent.performanceRating} / 5
            </Descriptions.Item>
            <Descriptions.Item label="备注">{selectedAgent.notes || '—'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
};

export default AgentManagement;
