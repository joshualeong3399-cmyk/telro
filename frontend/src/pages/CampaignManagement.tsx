import React, { useState, useEffect, useRef } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, Space, Tag, Badge,
  message, Popconfirm, Typography, Upload, DatePicker, InputNumber,
  Row, Col, Statistic, Alert, Progress, Avatar, Switch, Divider,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, PlayCircleOutlined, PauseOutlined,
  StopOutlined, ImportOutlined, PhoneOutlined, RobotOutlined, UserOutlined,
  ReloadOutlined, SyncOutlined, CloseCircleOutlined, UsergroupAddOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import axios from 'axios';
import { io as ioClient, Socket } from 'socket.io-client';

const { Title, Text } = Typography;
const { Option } = Select;

const STATUS_COLORS: Record<string, string> = {
  inactive: 'default', scheduled: 'processing', active: 'success',
  paused: 'warning', completed: 'success',
};
const STATUS_LABELS: Record<string, string> = {
  inactive: '未启动', scheduled: '已定时', active: '进行中',
  paused: '已暂停', completed: '已完成',
};
const TASK_STATUS_COLORS: Record<string, string> = {
  pending: 'default', calling: 'processing', answered: 'success',
  no_answer: 'warning', failed: 'error', cancelled: 'default',
  transferred: 'success', 'ai-handled': 'cyan', busy: 'orange',
};
const TASK_STATUS_LABELS: Record<string, string> = {
  pending: '待拨', calling: '拨叫中', answered: '已接听',
  no_answer: '无应答', failed: '失败', cancelled: '取消',
  transferred: '已转接', 'ai-handled': 'AI处理', busy: '忙线',
};

const SOCKET_URL = (typeof window !== 'undefined' && window.location.hostname)
  ? `${window.location.protocol}//${window.location.hostname}:3001`
  : 'http://localhost:3001';

interface LiveCall {
  taskId: string;
  queueId: string;
  queueName: string;
  contactName: string;
  contactNumber: string;
  channelId: string;
  defaultHandling: string;
  aiFlowId?: string;
  timestamp: number;
  elapsed: number;
}

const CampaignManagement: React.FC = () => {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [trunks, setTrunks] = useState<any[]>([]);
  const [extensions, setExtensions] = useState<any[]>([]);
  const [aiFlows, setAiFlows] = useState<any[]>([]);
  const [audioFiles, setAudioFiles] = useState<any[]>([]);
  const [ivrs, setIvrs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [addContactsModalOpen, setAddContactsModalOpen] = useState(false);
  const [actionModalData, setActionModalData] = useState<{ call: LiveCall; type: 'human' | 'ai' } | null>(null);
  const [liveCalls, setLiveCalls] = useState<LiveCall[]>([]);
  const [stats, setStats] = useState<any>({});
  const [transferExt, setTransferExt] = useState('');
  const [transferAiFlow, setTransferAiFlow] = useState('');
  const [contactsText, setContactsText] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [form] = Form.useForm();
  const socketRef = useRef<Socket | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load campaigns and reference data
  const load = async () => {
    setLoading(true);
    try {
      const [cR, tR, eR, aR, afR, iR] = await Promise.all([
        axios.get('/api/campaigns'),
        axios.get('/api/sip-trunks'),
        axios.get('/api/extensions'),
        axios.get('/api/ai/flows'),
        axios.get('/api/audio-files'),
        axios.get('/api/ivr'),
      ]);
      setCampaigns(cR.data.rows || cR.data);
      setTrunks(tR.data.rows || tR.data);
      setExtensions(eR.data.rows || eR.data);
      setAiFlows(aR.data.rows || aR.data);
      setAudioFiles(afR.data.rows || afR.data || []);
      setIvrs((iR.data.rows || iR.data || []).map ? (iR.data.rows || iR.data || []) : []);
    } catch (e: any) { message.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Socket.io for live call events
  useEffect(() => {
    const socket = ioClient(SOCKET_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('campaign:call-answered', (data: LiveCall) => {
      setLiveCalls(prev => [...prev.filter(c => c.taskId !== data.taskId), { ...data, elapsed: 0 }]);
      message.info({ content: `📞 ${data.contactName || data.contactNumber} 已接听`, key: data.taskId });
    });

    socket.on('campaign:call-transferred', (data: { taskId: string }) => {
      setLiveCalls(prev => prev.filter(c => c.taskId !== data.taskId));
    });

    socket.on('campaign:call-ai', (data: { taskId: string }) => {
      setLiveCalls(prev => prev.filter(c => c.taskId !== data.taskId));
    });

    socket.on('campaign:call-ended', (data: { taskId: string }) => {
      setLiveCalls(prev => prev.filter(c => c.taskId !== data.taskId));
    });

    socket.on('campaign:status', (data: { queueId: string; status: string }) => {
      setCampaigns(prev => prev.map(c => c.id === data.queueId ? { ...c, status: data.status } : c));
    });

    return () => { socket.disconnect(); };
  }, []);

  // Elapsed timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setLiveCalls(prev => prev.map(c => ({ ...c, elapsed: c.elapsed + 1 })));
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const loadTasks = async (campaignId: string) => {
    setTasksLoading(true);
    try {
      const r = await axios.get(`/api/campaigns/${campaignId}/tasks`);
      setTasks(r.data.rows || r.data);
    } catch (e: any) { message.error(e.message); }
    finally { setTasksLoading(false); }
  };

  const loadStats = async (campaignId: string) => {
    try {
      const r = await axios.get(`/api/campaigns/${campaignId}/stats`);
      setStats(r.data);
    } catch {}
  };

  const selectCampaign = (campaign: any) => {
    setSelectedCampaign(campaign);
    loadTasks(campaign.id);
    loadStats(campaign.id);
  };

  const openCreate = () => {
    setEditingCampaign(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (c: any) => {
    setEditingCampaign(c);
    form.setFieldsValue({
      name: c.name, description: c.description,
      sipTrunkId: c.sipTrunkId, callerIdOverride: c.callerIdOverride,
      maxConcurrentCalls: c.maxConcurrentCalls,
      defaultHandling: c.defaultHandling, aiFlowId: c.aiFlowId,
      scheduledStartTime: c.scheduledStartTime ? dayjs(c.scheduledStartTime) : null,
      retryInterval: c.retryInterval, maxAttempts: c.maxAttempts,
      dtmfEnabled: !!c.dtmfConnectKey,
      dtmfConnectKey: c.dtmfConnectKey,
      dtmfConnectType: c.dtmfConnectType,
      dtmfConnectId: c.dtmfConnectId,
      dtmfAudioFileId: c.dtmfAudioFileId,
      dtmfTimeout: c.dtmfTimeout ?? 10,
      dtmfMaxRetries: c.dtmfMaxRetries ?? 3,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const vals = await form.validateFields();
      const { dtmfEnabled, ...rest } = vals;
      const payload = {
        ...rest,
        scheduledStartTime: vals.scheduledStartTime ? vals.scheduledStartTime.toISOString() : null,
        // Clear DTMF fields if switch is off
        dtmfConnectKey: dtmfEnabled ? vals.dtmfConnectKey : null,
        dtmfConnectType: dtmfEnabled ? vals.dtmfConnectType : null,
        dtmfConnectId: dtmfEnabled ? vals.dtmfConnectId : null,
        dtmfAudioFileId: dtmfEnabled ? vals.dtmfAudioFileId : null,
        dtmfTimeout: dtmfEnabled ? (vals.dtmfTimeout ?? 10) : 10,
        dtmfMaxRetries: dtmfEnabled ? (vals.dtmfMaxRetries ?? 3) : 3,
      };
      if (editingCampaign) {
        await axios.put(`/api/campaigns/${editingCampaign.id}`, payload);
        message.success('更新成功');
      } else {
        await axios.post('/api/campaigns', payload);
        message.success('创建成功');
      }
      setModalOpen(false);
      load();
    } catch (e: any) { message.error(e.response?.data?.error || e.message); }
  };

  const handleDelete = async (id: string) => {
    try { await axios.delete(`/api/campaigns/${id}`); message.success('删除成功'); load(); if (selectedCampaign?.id === id) setSelectedCampaign(null); }
    catch (e: any) { message.error(e.message); }
  };

  const campaignControl = async (id: string, action: 'start' | 'pause' | 'stop') => {
    const labels: any = { start: '启动', pause: '暂停', stop: '停止' };
    try {
      await axios.post(`/api/campaigns/${id}/${action}`);
      message.success(`${labels[action]}成功`);
      load();
    } catch (e: any) { message.error(e.response?.data?.error || e.message); }
  };

  const handleAddContacts = async () => {
    if (!selectedCampaign) return;
    try {
      const lines = contactsText.trim().split('\n').filter(Boolean);
      const contacts = lines.map(line => {
        const parts = line.split(',').map(p => p.trim());
        if (parts.length >= 2) return { name: parts[0], phone: parts[1] };
        return { phone: parts[0] };
      });
      if (!contacts.length) { message.warning('请输入联系人数据'); return; }
      await axios.post(`/api/campaigns/${selectedCampaign.id}/contacts`, { contacts, maxAttempts: 3 });
      message.success(`成功添加 ${contacts.length} 个联系人`);
      setContactsText('');
      setAddContactsModalOpen(false);
      loadTasks(selectedCampaign.id);
      loadStats(selectedCampaign.id);
    } catch (e: any) { message.error(e.response?.data?.error || e.message); }
  };

  const handleCsvImport = async () => {
    if (!selectedCampaign || !importFile) { message.warning('请选择CSV文件'); return; }
    const formData = new FormData();
    formData.append('file', importFile);
    formData.append('maxAttempts', '3');
    try {
      const r = await axios.post(`/api/campaigns/${selectedCampaign.id}/contacts/import`, formData);
      message.success(r.data.message || '导入成功');
      setImportModalOpen(false);
      setImportFile(null);
      loadTasks(selectedCampaign.id);
      loadStats(selectedCampaign.id);
    } catch (e: any) { message.error(e.response?.data?.error || e.message); }
  };

  // Take action on a live call (human transfer or AI)
  const handleCallAction = async (type: 'human' | 'ai') => {
    if (!actionModalData) return;
    const { call } = actionModalData;
    try {
      const payload: any = { type };
      if (type === 'human') {
        if (!transferExt) { message.warning('请选择转接分机'); return; }
        payload.extensionNumber = transferExt;
      } else {
        if (!transferAiFlow) { message.warning('请选择AI流程'); return; }
        payload.flowId = transferAiFlow;
      }
      await axios.post(`/api/campaigns/tasks/${call.taskId}/action`, payload);
      message.success(type === 'human' ? '已转接话务员' : '已转入AI流程');
      setActionModalData(null);
      setTransferExt('');
      setTransferAiFlow('');
    } catch (e: any) { message.error(e.response?.data?.error || e.message); }
  };

  const handleQueueAction = async (call: LiveCall) => {
    try {
      await axios.post(`/api/campaigns/tasks/${call.taskId}/action`, { type: 'queue' });
      message.success('已广播给所有话务员，等待接听');
    } catch (e: any) { message.error(e.response?.data?.error || e.message); }
  };

  const handleHangup = async (taskId: string) => {
    try {
      await axios.post(`/api/campaigns/tasks/${taskId}/hangup`);
      message.success('已挂断');
    } catch (e: any) { message.error(e.message); }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleDefaultHandlingChange = (val: string) => {
    if (val !== 'ai') form.setFieldValue('aiFlowId', undefined);
  };

  const campaignColumns = [
    {
      title: '群呼名称', dataIndex: 'name',
      render: (v: string, r: any) => (
        <Button type="link" onClick={() => selectCampaign(r)} style={{ padding: 0, fontWeight: selectedCampaign?.id === r.id ? 'bold' : 'normal' }}>
          {v}
        </Button>
      ),
    },
    {
      title: '状态', dataIndex: 'status',
      render: (v: string) => <Badge status={STATUS_COLORS[v] as any} text={STATUS_LABELS[v] || v} />,
    },
    {
      title: '并发数', dataIndex: 'maxConcurrentCalls',
      render: (v: number) => <Tag>{v} 路</Tag>,
    },
    {
      title: '线路', dataIndex: 'sipTrunk',
      render: (_: any, r: any) => r.sipTrunk ? <Tag color="blue">{r.sipTrunk.name}</Tag> : <Tag>默认</Tag>,
    },
    {
      title: '计划时间', dataIndex: 'scheduledStartTime',
      render: (v: string) => v ? dayjs(v).format('MM/DD HH:mm') : '-',
    },
    {
      title: '操作', render: (_: any, r: any) => (
        <Space>
          {r.status === 'inactive' || r.status === 'paused' ? (
            <Button icon={<PlayCircleOutlined />} size="small" type="primary" onClick={() => campaignControl(r.id, 'start')}>启动</Button>
          ) : null}
          {r.status === 'active' ? (
            <Button icon={<PauseOutlined />} size="small" onClick={() => campaignControl(r.id, 'pause')}>暂停</Button>
          ) : null}
          {r.status === 'active' || r.status === 'paused' ? (
            <Popconfirm title="停止后任务将终止，确认?" onConfirm={() => campaignControl(r.id, 'stop')}>
              <Button icon={<StopOutlined />} size="small" danger>停止</Button>
            </Popconfirm>
          ) : null}
          <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(r)}>编辑</Button>
          <Popconfirm title="确认删除?" onConfirm={() => handleDelete(r.id)}>
            <Button icon={<DeleteOutlined />} size="small" danger />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const taskColumns = [
    { title: '姓名', dataIndex: 'contactName', render: (v: string) => v || '-' },
    { title: '号码', dataIndex: 'targetNumber', render: (v: string) => <Text copyable>{v}</Text> },
    {
      title: '状态', dataIndex: 'status',
      render: (v: string) => (
        <Tag color={TASK_STATUS_COLORS[v] || 'default'}>{TASK_STATUS_LABELS[v] || v}</Tag>
      ),
    },
    { title: '尝试次数', dataIndex: 'attempts', render: (v: number, r: any) => `${v}/${r.maxAttempts}` },
    {
      title: '结果', dataIndex: 'callResultDetail',
      render: (v: string) => v ? <Tag>{v}</Tag> : '-',
    },
    {
      title: '处理方式', dataIndex: 'handledBy',
      render: (v: string) => {
        if (!v) return '-';
        if (v === 'ai') return <Tag color="cyan" icon={<RobotOutlined />}>AI</Tag>;
        return <Tag color="blue" icon={<UserOutlined />}>人工</Tag>;
      },
    },
    {
      title: '转接分机', dataIndex: 'transferredToExtension',
      render: (v: string) => v ? <Tag color="green">{v}</Tag> : '-',
    },
  ];

  const defaultHandling = Form.useWatch('defaultHandling', form);
  const dtmfEnabled = Form.useWatch('dtmfEnabled', form);
  const dtmfConnectType = Form.useWatch('dtmfConnectType', form);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4}><PhoneOutlined /> 群呼管理</Title>
        <Space>
          <Button icon={<SyncOutlined />} onClick={load}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建群呼</Button>
        </Space>
      </div>

      {/* Live calls panel */}
      {liveCalls.length > 0 && (
        <Card
          title={<span>🔴 实时接通通话 <Tag color="red">{liveCalls.length}</Tag></span>}
          style={{ marginBottom: 16 }}
          bodyStyle={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}
        >
          {liveCalls.map(call => (
            <Card
              key={call.taskId}
              size="small"
              style={{ width: 260, borderColor: '#52c41a', background: '#f6ffed' }}
              bodyStyle={{ padding: 12 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Space>
                  <Avatar icon={<PhoneOutlined />} size="small" style={{ background: '#52c41a' }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{call.contactName || call.contactNumber}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>{call.contactNumber}</div>
                  </div>
                </Space>
                <div>
                  <Tag color="green" style={{ fontFamily: 'monospace' }}>{formatTime(call.elapsed)}</Tag>
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>{call.queueName}</div>
              <Space wrap>
                <Button
                  size="small"
                  icon={<UserOutlined />}
                  type="primary"
                  onClick={() => { setActionModalData({ call, type: 'human' }); setTransferExt(''); }}
                >
                  转话务员
                </Button>
                <Button
                  size="small"
                  icon={<RobotOutlined />}
                  style={{ borderColor: '#722ed1', color: '#722ed1' }}
                  onClick={() => {
                    if (call.aiFlowId) {
                      // Direct AI routing if already configured
                      axios.post(`/api/campaigns/tasks/${call.taskId}/action`, { type: 'ai', flowId: call.aiFlowId })
                        .then(() => message.success('已转入AI'))
                        .catch(e => message.error(e.message));
                    } else {
                      setActionModalData({ call, type: 'ai' });
                      setTransferAiFlow('');
                    }
                  }}
                >
                  接入AI
                </Button>
                <Popconfirm
                  title="通知所有在线话务员来接听此通话？"
                  onConfirm={() => handleQueueAction(call)}
                  okText="确认"
                  cancelText="取消"
                >
                  <Button
                    size="small"
                    icon={<UsergroupAddOutlined />}
                    style={{ borderColor: '#fa8c16', color: '#fa8c16' }}
                  >
                    通知排队
                  </Button>
                </Popconfirm>
                <Popconfirm title="确认挂断?" onConfirm={() => handleHangup(call.taskId)}>
                  <Button size="small" icon={<CloseCircleOutlined />} danger>挂断</Button>
                </Popconfirm>
              </Space>
            </Card>
          ))}
        </Card>
      )}

      {/* Campaign list */}
      <Card style={{ marginBottom: 16 }}>
        <Table
          rowKey="id"
          dataSource={campaigns}
          columns={campaignColumns}
          loading={loading}
          pagination={{ pageSize: 10 }}
          onRow={r => ({ onClick: () => selectCampaign(r), style: { cursor: 'pointer' } })}
          rowClassName={r => r.id === selectedCampaign?.id ? 'ant-table-row-selected' : ''}
        />
      </Card>

      {/* Campaign detail */}
      {selectedCampaign && (
        <Card
          title={`📊 ${selectedCampaign.name} — 任务明细`}
          extra={
            <Space>
              <Button icon={<PlusOutlined />} onClick={() => setAddContactsModalOpen(true)}>手动添加联系人</Button>
              <Button icon={<ImportOutlined />} onClick={() => setImportModalOpen(true)}>CSV导入</Button>
              <Button icon={<ReloadOutlined />} onClick={() => { loadTasks(selectedCampaign.id); loadStats(selectedCampaign.id); }}>刷新</Button>
            </Space>
          }
        >
          {/* Stats */}
          {stats.total !== undefined && (
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={4}><Statistic title="总计" value={stats.total} /></Col>
              <Col span={4}><Statistic title="待拨" value={stats.pending} valueStyle={{ color: '#999' }} /></Col>
              <Col span={4}><Statistic title="拨叫中" value={stats.calling} valueStyle={{ color: '#1677ff' }} /></Col>
              <Col span={4}><Statistic title="已接听" value={stats.answered} valueStyle={{ color: '#52c41a' }} /></Col>
              <Col span={4}><Statistic title="无应答" value={stats.noAnswer} valueStyle={{ color: '#faad14' }} /></Col>
              <Col span={4}><Statistic title="失败" value={stats.failed} valueStyle={{ color: '#ff4d4f' }} /></Col>
            </Row>
          )}
          {stats.total > 0 && (
            <Progress
              percent={Math.round(((stats.answered || 0) / stats.total) * 100)}
              success={{ percent: Math.round(((stats.answered || 0) / stats.total) * 100) }}
              style={{ marginBottom: 16 }}
            />
          )}

          <Table
            rowKey="id"
            dataSource={tasks}
            columns={taskColumns}
            loading={tasksLoading}
            pagination={{ pageSize: 20, showSizeChanger: true }}
          />
        </Card>
      )}

      {/* Create/edit campaign modal */}
      <Modal
        open={modalOpen}
        title={editingCampaign ? '编辑群呼任务' : '新建群呼任务'}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        onOk={handleSave}
        width={600}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="群呼名称" rules={[{ required: true }]}>
            <Input placeholder="例如: 2024年1月促销活动" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="sipTrunkId" label="使用线路（SIP trunk）">
                <Select allowClear placeholder="默认使用外拨路由">
                  {trunks.map(t => <Option key={t.id} value={t.id}>{t.name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="callerIdOverride" label="主叫号码（覆盖）">
                <Input placeholder="不填则使用线路默认" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="maxConcurrentCalls" label="最大并发路数" initialValue={5}>
                <InputNumber min={1} max={50} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="maxAttempts" label="最大拨打次数" initialValue={3}>
                <InputNumber min={1} max={10} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="retryInterval" label="重拨间隔（分钟）" initialValue={30}>
                <InputNumber min={1} max={1440} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="scheduledStartTime" label="计划开始时间（不填为手动启动）">
                <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="defaultHandling" label="接通后默认处理方式" initialValue="ask">
            <Select onChange={handleDefaultHandlingChange}>
              <Option value="ask">实时询问（在系统中选择）</Option>
              <Option value="human">自动转接话务员（排队）</Option>
              <Option value="ai">自动接入AI流程</Option>
            </Select>
          </Form.Item>

          {defaultHandling === 'ai' && (
            <Form.Item name="aiFlowId" label="AI流程" rules={[{ required: true }]}>
              <Select placeholder="选择AI流程">
                {aiFlows.map(f => <Option key={f.id} value={f.id}>{f.name}</Option>)}
              </Select>
            </Form.Item>
          )}

          <Divider orientation="left" plain style={{ fontSize: 13 }}>DTMF 按键接转（播完语音后客户按键自动转接）</Divider>

          <Form.Item name="dtmfEnabled" label="启用按键接转" valuePropName="checked" initialValue={false}>
            <Switch checkedChildren="开" unCheckedChildren="关" />
          </Form.Item>

          {dtmfEnabled && (
            <>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="dtmfConnectKey" label="触发按键" rules={[{ required: true, message: '请选择按键' }]}>
                    <Select placeholder="选择按键">
                      {['0','1','2','3','4','5','6','7','8','9','*','#'].map(k => (
                        <Option key={k} value={k}>{k}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="dtmfTimeout" label="等待按键秒数" initialValue={10}>
                    <InputNumber min={3} max={60} style={{ width: '100%' }} addonAfter="秒" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="dtmfMaxRetries" label="最多重播次数" initialValue={3}>
                    <InputNumber min={1} max={10} style={{ width: '100%' }} addonAfter="次" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="dtmfAudioFileId" label="播报语音文件" extra="客户接通后播放的语音，播完后等待按键；不选则静音等待">
                <Select placeholder="（可选）选择语音文件" allowClear showSearch optionFilterProp="children">
                  {audioFiles.map(f => <Option key={f.id} value={f.id}>{f.name}</Option>)}
                </Select>
              </Form.Item>

              <Row gutter={16}>
                <Col span={10}>
                  <Form.Item name="dtmfConnectType" label="转接目标类型" rules={[{ required: true, message: '请选择类型' }]}>
                    <Select placeholder="转接到..." onChange={() => form.setFieldValue('dtmfConnectId', undefined)}>
                      <Option value="extension">分机（直接拨打坐席）</Option>
                      <Option value="ivr">IVR（进入语音菜单）</Option>
                      <Option value="queue">排队（进入等待队列）</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={14}>
                  <Form.Item name="dtmfConnectId" label="转接目标" rules={[{ required: true, message: '请选择转接目标' }]}>
                    <Select placeholder="选择目标" showSearch optionFilterProp="children">
                      {dtmfConnectType === 'extension' && extensions.map(e => (
                        <Option key={e.id} value={e.id}>{e.number} — {e.name}</Option>
                      ))}
                      {dtmfConnectType === 'ivr' && ivrs.map(i => (
                        <Option key={i.id} value={i.id}>{i.name}</Option>
                      ))}
                      {dtmfConnectType === 'queue' && campaigns.map(c => (
                        <Option key={c.id} value={c.id}>{c.name}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}
        </Form>
      </Modal>

      {/* Action modal: transfer to human */}
      <Modal
        open={!!actionModalData && actionModalData.type === 'human'}
        title={<span><UserOutlined /> 转接话务员</span>}
        onOk={() => handleCallAction('human')}
        onCancel={() => setActionModalData(null)}
        okText="确认转接"
      >
        {actionModalData && (
          <>
            <p>将 <strong>{actionModalData.call.contactName || actionModalData.call.contactNumber}</strong> 的通话转接至：</p>
            <Select
              style={{ width: '100%' }}
              placeholder="选择话务员分机"
              value={transferExt}
              onChange={setTransferExt}
              showSearch
              optionFilterProp="children"
            >
              {extensions.map(e => (
                <Option key={e.number} value={e.number}>{e.number} - {e.name}</Option>
              ))}
            </Select>
          </>
        )}
      </Modal>

      {/* Action modal: transfer to AI */}
      <Modal
        open={!!actionModalData && actionModalData.type === 'ai'}
        title={<span><RobotOutlined /> 选择AI流程</span>}
        onOk={() => handleCallAction('ai')}
        onCancel={() => setActionModalData(null)}
        okText="接入AI"
      >
        {actionModalData && (
          <>
            <p>将 <strong>{actionModalData.call.contactName || actionModalData.call.contactNumber}</strong> 的通话接入AI流程：</p>
            <Select
              style={{ width: '100%' }}
              placeholder="选择AI流程"
              value={transferAiFlow}
              onChange={setTransferAiFlow}
            >
              {aiFlows.map(f => <Option key={f.id} value={f.id}>{f.name}</Option>)}
            </Select>
          </>
        )}
      </Modal>

      {/* Add contacts modal */}
      <Modal
        open={addContactsModalOpen}
        title="手动添加联系人"
        onCancel={() => setAddContactsModalOpen(false)}
        onOk={handleAddContacts}
        width={520}
      >
        <Alert
          message="每行一条联系人，格式: 姓名,手机号 或仅 手机号"
          type="info" showIcon style={{ marginBottom: 12 }}
        />
        <Input.TextArea
          rows={10}
          value={contactsText}
          onChange={e => setContactsText(e.target.value)}
          placeholder="张三,13800138001&#10;李四,13900139002&#10;13700137003"
        />
      </Modal>

      {/* CSV import modal */}
      <Modal
        open={importModalOpen}
        title="CSV导入联系人"
        onCancel={() => { setImportModalOpen(false); setImportFile(null); }}
        onOk={handleCsvImport}
        okText="开始导入"
      >
        <Alert
          message="CSV格式: 支持 name,phone 或 phone 单列格式。第一行为表头（可选）。支持中文列名：姓名、手机、电话。"
          type="info" showIcon style={{ marginBottom: 12 }}
        />
        <Upload.Dragger
          accept=".csv,.txt"
          beforeUpload={(file) => { setImportFile(file); return false; }}
          onRemove={() => setImportFile(null)}
          maxCount={1}
        >
          <p><ImportOutlined style={{ fontSize: 24 }} /></p>
          <p>点击或拖拽CSV文件到此区域</p>
          <p style={{ fontSize: 12, color: '#888' }}>仅支持 .csv .txt 文件</p>
        </Upload.Dragger>
        {importFile && (
          <div style={{ marginTop: 8 }}>
            <Tag color="green">已选文件: {importFile.name}</Tag>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CampaignManagement;
