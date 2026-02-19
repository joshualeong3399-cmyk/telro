import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, Button, Form, Input, Select, Space, Tag, message, Popconfirm,
  Typography, Divider, Modal, Table, Switch, Tabs, Empty, Alert,
  Row, Col, InputNumber, Badge,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, SaveOutlined, SoundOutlined,
  BranchesOutlined, PhoneOutlined, StopOutlined,
  EditOutlined, CopyOutlined, CodeOutlined, ArrowUpOutlined, ArrowDownOutlined,
  QuestionCircleOutlined, CheckOutlined, CloseOutlined,
} from '@ant-design/icons';
import api from '@/services/api';

const { Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const INDUSTRY_OPTIONS = [
  { value: '', label: '请选择行业' },
  { value: 'finance', label: '金融' },
  { value: 'loan', label: '贷款' },
  { value: 'estate', label: '房产' },
  { value: 'decoration', label: '装修' },
  { value: 'auto', label: '汽车' },
  { value: 'education', label: '教育' },
  { value: 'other', label: '其他' },
];

const KEYWORD_CATEGORIES = [
  { value: '1', label: '挽回用户回复流程' },
  { value: '2', label: '用户提问时的回复' },
  { value: '4', label: '用户说忙时的回复' },
  { value: '5', label: '用户拒绝时的回复' },
  { value: '6', label: '主动结束时的回复' },
  { value: '7', label: '用户未说话时的回复' },
  { value: '8', label: '回答不了时的回复' },
];

const STEP_TYPES = [
  { value: 'play',     label: '话术播放', color: 'blue',   icon: <SoundOutlined /> },
  { value: 'gather',   label: '按键收集', color: 'purple', icon: <BranchesOutlined /> },
  { value: 'transfer', label: '转人工',   color: 'green',  icon: <PhoneOutlined /> },
  { value: 'hangup',   label: '挂断',     color: 'red',    icon: <StopOutlined /> },
];

const stepTypeLabel = (t: string) => STEP_TYPES.find(s => s.value === t)?.label || t;
const stepTypeColor = (t: string) => STEP_TYPES.find(s => s.value === t)?.color || 'default';
const hasBridge = (step: any) =>
  step.type === 'transfer' || (step.branches || []).some((b: any) => b.bridge || b.nextStepId === 'transfer');
const stepKeywords = (step: any) =>
  step.type === 'gather'
    ? (step.branches || []).map((b: any) => b.digit || b.keyword).filter(Boolean).join('、')
    : '';

const AiFlowBuilder: React.FC = () => {
  const [flows, setFlows]               = useState<any[]>([]);
  const [audioFiles, setAudioFiles]     = useState<any[]>([]);
  const [extensions, setExtensions]     = useState<any[]>([]);
  const [queues, setQueues]             = useState<any[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<any>(null);
  const [steps, setSteps]               = useState<any[]>([]);
  const [loading, setLoading]           = useState(false);
  const [activeTab, setActiveTab]       = useState('technique');

  const [flowModalOpen, setFlowModalOpen] = useState(false);
  const [stepModalOpen, setStepModalOpen] = useState(false);
  const [editingStep, setEditingStep]     = useState<any>(null);
  const [dialplanModal, setDialplanModal] = useState<string | null>(null);
  const [kwModalOpen, setKwModalOpen]     = useState(false);
  const [editingKw, setEditingKw]         = useState<any>(null);
  const [kwStepId, setKwStepId]           = useState('');

  const [flowForm] = Form.useForm();
  const [stepForm] = Form.useForm();
  const [kwForm]   = Form.useForm();
  const stepDestType = Form.useWatch('destinationType', stepForm);

  useEffect(() => {
    loadFlows();
    api.get('/audio-files').then(r => setAudioFiles(r.data.rows || r.data)).catch(() => {});
    api.get('/extensions').then(r => setExtensions(r.data.rows || r.data)).catch(() => {});
    api.get('/queue').then(r => setQueues(r.data.rows || r.data)).catch(() => {});
  }, []);

  const loadFlows = async () => {
    setLoading(true);
    try {
      const r = await api.get('/ai/flows');
      setFlows(r.data.rows || r.data);
    } catch (e: any) { message.error(e.message); }
    finally { setLoading(false); }
  };

  const selectFlow = (flow: any) => {
    setSelectedFlow(flow);
    setSteps(flow.steps || []);
    setActiveTab('technique');
  };

  const createFlow = async () => {
    try {
      const vals = await flowForm.validateFields();
      const r = await api.post('/ai/flows', { ...vals, steps: [] });
      message.success('话术场景已创建');
      setFlowModalOpen(false);
      flowForm.resetFields();
      await loadFlows();
      selectFlow(r.data);
    } catch (e: any) { message.error(e.response?.data?.error || e.message); }
  };

  const duplicateFlow = async (flowId: string) => {
    try {
      const r = await api.post(`/ai/flows/${flowId}/duplicate`);
      message.success('场景已复制');
      await loadFlows();
      selectFlow(r.data);
    } catch (e: any) { message.error(e.message); }
  };

  const deleteFlow = async (id: string) => {
    try {
      await api.delete(`/ai/flows/${id}`);
      message.success('已删除');
      setSelectedFlow(null);
      setSteps([]);
      loadFlows();
    } catch (e: any) { message.error(e.message); }
  };

  const saveFlow = async () => {
    if (!selectedFlow) return;
    try {
      await api.put(`/ai/flows/${selectedFlow.id}`, {
        ...selectedFlow, steps, firstStepId: steps[0]?.id || null,
      });
      message.success('话术流程已保存');
      loadFlows();
    } catch (e: any) { message.error(e.response?.data?.error || e.message); }
  };

  const toggleFlowEnabled = async (flow: any, enabled: boolean) => {
    try {
      await api.put(`/ai/flows/${flow.id}`, { ...flow, enabled });
      await loadFlows();
      if (selectedFlow?.id === flow.id) setSelectedFlow((p: any) => ({ ...p, enabled }));
    } catch (e: any) { message.error(e.message); }
  };

  const openAddStep = (type: string) => {
    const newStep = {
      id: `step-${Date.now()}`, type,
      name: stepTypeLabel(type),
      ...(type === 'play'     ? { audioFileId: null, text: '' } : {}),
      ...(type === 'gather'   ? { text: '', maxDigits: 1, timeout: 5, branches: [], keyword: '' } : {}),
      ...(type === 'transfer' ? { destinationType: 'extension', destinationId: '' } : {}),
      _isNew: true,
    };
    setEditingStep(newStep);
    stepForm.setFieldsValue({
      name: newStep.name, type, audioFileId: null, text: '',
      maxDigits: 1, timeout: 5, destinationType: 'extension', destinationId: '', keyword: '',
    });
    setStepModalOpen(true);
  };

  const openEditStep = (step: any) => {
    setEditingStep({ ...step, _isNew: false });
    stepForm.setFieldsValue({
      name: step.name, audioFileId: step.audioFileId,
      text: step.text, maxDigits: step.maxDigits ?? 1, timeout: step.timeout ?? 5,
      destinationType: step.destinationType ?? 'extension',
      destinationId: step.destinationId ?? '', keyword: step.keyword ?? '',
    });
    setStepModalOpen(true);
  };

  const saveStep = async () => {
    try {
      const vals = await stepForm.validateFields();
      const merged = { ...editingStep, ...vals };
      if (editingStep._isNew) {
        setSteps(prev => [...prev, merged]);
      } else {
        setSteps(prev => prev.map(s => s.id === editingStep.id ? { ...s, ...vals } : s));
      }
      setStepModalOpen(false);
      setEditingStep(null);
      stepForm.resetFields();
    } catch {}
  };

  const deleteStep = (stepId: string) => setSteps(prev => prev.filter(s => s.id !== stepId));

  const moveStep = (idx: number, dir: 'up' | 'down') => {
    const updated = [...steps];
    const t = dir === 'up' ? idx - 1 : idx + 1;
    if (t < 0 || t >= steps.length) return;
    [updated[idx], updated[t]] = [updated[t], updated[idx]];
    setSteps(updated);
  };

  const openAddBranch = (stepId: string) => {
    setKwStepId(stepId); setEditingKw(null); kwForm.resetFields(); setKwModalOpen(true);
  };

  const openEditBranch = (stepId: string, branch: any, idx: number) => {
    setKwStepId(stepId);
    setEditingKw({ ...branch, _idx: idx });
    kwForm.setFieldsValue({
      digit: branch.digit ?? '', keyword: branch.keyword ?? '',
      category: branch.category ?? '', nextStepId: branch.nextStepId ?? '',
      bridge: branch.bridge ?? false,
    });
    setKwModalOpen(true);
  };

  const saveBranch = async () => {
    try {
      const vals = await kwForm.validateFields();
      setSteps(prev => prev.map(s => {
        if (s.id !== kwStepId) return s;
        const branches = [...(s.branches || [])];
        if (editingKw && editingKw._idx !== undefined) {
          branches[editingKw._idx] = { ...branches[editingKw._idx], ...vals };
        } else {
          branches.push(vals);
        }
        return { ...s, branches };
      }));
      setKwModalOpen(false); setEditingKw(null); kwForm.resetFields();
    } catch {}
  };

  const deleteBranch = (stepId: string, idx: number) =>
    setSteps(prev => prev.map(s => s.id !== stepId ? s
      : { ...s, branches: (s.branches || []).filter((_: any, i: number) => i !== idx) }));

  const previewDialplan = async () => {
    if (!selectedFlow) return;
    await saveFlow();
    try {
      const r = await api.get(`/ai/flows/${selectedFlow.id}/dialplan`);
      setDialplanModal(r.data.dialplan);
    } catch (e: any) { message.error(e.message); }
  };

  const gatherSteps = useMemo(() => steps.filter(s => s.type === 'gather'), [steps]);

  const branchesByCategory = useMemo(() => {
    const result: Record<string, { stepId: string; stepName: string; branch: any; idx: number }[]> = {};
    gatherSteps.forEach(step => {
      (step.branches || []).forEach((b: any, idx: number) => {
        const cat = b.category || 'uncategorized';
        if (!result[cat]) result[cat] = [];
        result[cat].push({ stepId: step.id, stepName: step.name, branch: b, idx });
      });
    });
    return result;
  }, [gatherSteps]);

  const techniqueColumns = [
    {
      title: '序号', key: 'order', width: 60,
      render: (_: any, __: any, idx: number) => <Text strong>{idx + 1}</Text>,
    },
    {
      title: '内容 / 步骤', key: 'content', ellipsis: true,
      render: (_: any, step: any) => (
        <Space direction="vertical" size={2}>
          <Text strong>{step.name}</Text>
          {step.text && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {step.text.substring(0, 60)}{step.text.length > 60 ? '…' : ''}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '类型', dataIndex: 'type', key: 'type', width: 90,
      render: (t: string) => <Tag color={stepTypeColor(t)}>{stepTypeLabel(t)}</Tag>,
    },
    {
      title: '语音', key: 'audio', width: 110,
      render: (_: any, step: any) => {
        if (!step.audioFileId) return <Text type="secondary">-</Text>;
        const af = audioFiles.find(f => f.id === step.audioFileId);
        return af
          ? <Tag icon={<SoundOutlined />} color="blue">{af.name}</Tag>
          : <Tag color="orange">已配置</Tag>;
      },
    },
    {
      title: '匹配关键字', key: 'keywords', width: 160,
      render: (_: any, step: any) => {
        const kws = stepKeywords(step);
        return kws
          ? kws.split('、').map(k => <Tag key={k} style={{ marginBottom: 2 }}>{k}</Tag>)
          : <Text type="secondary">-</Text>;
      },
    },
    {
      title: '是否转人工', key: 'bridge', width: 95,
      render: (_: any, step: any) => hasBridge(step)
        ? <Tag icon={<CheckOutlined />} color="green">是</Tag>
        : <Tag icon={<CloseOutlined />}>否</Tag>,
    },
    {
      title: '操作', key: 'action', width: 160,
      render: (_: any, step: any, idx: number) => (
        <Space size={4}>
          <Button size="small" icon={<ArrowUpOutlined />}
            disabled={idx === 0} onClick={() => moveStep(idx, 'up')} />
          <Button size="small" icon={<ArrowDownOutlined />}
            disabled={idx === steps.length - 1} onClick={() => moveStep(idx, 'down')} />
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditStep(step)}>编辑</Button>
          <Popconfirm title="确认删除?" onConfirm={() => deleteStep(step.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const kwColumns = [
    { title: '所属步骤', dataIndex: 'stepName', key: 'stepName', width: 130 },
    {
      title: '关键字 / 按键', key: 'key', width: 130,
      render: (_: any, row: any) => (
        <Space>
          {row.branch.digit && <Tag color="blue">按 {row.branch.digit}</Tag>}
          {row.branch.keyword && <Tag color="purple">{row.branch.keyword}</Tag>}
        </Space>
      ),
    },
    {
      title: '跳转目标', key: 'next', width: 140,
      render: (_: any, row: any) => {
        const t = row.branch.nextStepId;
        if (t === 'hangup') return <Tag color="red">挂断</Tag>;
        if (t === 'repeat') return <Tag color="orange">重复</Tag>;
        if (t === 'transfer') return <Tag color="green">转人工</Tag>;
        const s = steps.find(st => st.id === t);
        return s ? <Tag>{s.name}</Tag> : <Text type="secondary">-</Text>;
      },
    },
    {
      title: '转人工', key: 'bridge', width: 70,
      render: (_: any, row: any) =>
        row.branch.bridge ? <Tag color="green">是</Tag> : <Text type="secondary">否</Text>,
    },
    {
      title: '操作', key: 'action', width: 120,
      render: (_: any, row: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />}
            onClick={() => openEditBranch(row.stepId, row.branch, row.idx)}>编辑</Button>
          <Popconfirm title="确认删除?" onConfirm={() => deleteBranch(row.stepId, row.idx)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, display: 'flex', gap: 16, height: 'calc(100vh - 100px)', overflow: 'hidden' }}>

      {/* Left panel: scenario list */}
      <Card
        title="话术场景"
        style={{ width: 300, flexShrink: 0, overflow: 'auto' }}
        styles={{ body: { padding: 0 } }}
        extra={
          <Button type="primary" size="small" icon={<PlusOutlined />}
            onClick={() => { flowForm.resetFields(); setFlowModalOpen(true); }}>
            添加
          </Button>
        }
      >
        {loading && <div style={{ padding: 16, textAlign: 'center', color: '#999' }}>加载中…</div>}
        {!loading && flows.length === 0 && <Empty style={{ padding: 32 }} description="暂无话术场景" />}
        {flows.map(flow => (
          <div
            key={flow.id}
            onClick={() => selectFlow(flow)}
            style={{
              padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0',
              background: selectedFlow?.id === flow.id ? '#e6f7ff' : 'transparent',
              borderLeft: selectedFlow?.id === flow.id ? '3px solid #1677ff' : '3px solid transparent',
            }}
          >
            <Row justify="space-between" align="top">
              <Col flex={1}>
                <Text strong style={{ display: 'block' }}>{flow.name}</Text>
                {flow.industry && (
                  <Tag style={{ marginTop: 2, fontSize: 11 }}>
                    {INDUSTRY_OPTIONS.find(o => o.value === flow.industry)?.label || flow.industry}
                  </Tag>
                )}
                <div style={{ marginTop: 4 }}>
                  <Badge
                    status={flow.enabled ? 'success' : 'default'}
                    text={<Text style={{ fontSize: 11 }}>{flow.enabled ? '开启' : '停用'}</Text>}
                  />
                </div>
              </Col>
              <Col onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                <Space direction="vertical" size={2}>
                  <Switch size="small" checked={flow.enabled} onChange={v => toggleFlowEnabled(flow, v)} />
                  <Button icon={<CopyOutlined />} size="small" type="text" onClick={() => duplicateFlow(flow.id)} />
                  <Popconfirm title="确认删除?" onConfirm={() => deleteFlow(flow.id)}>
                    <Button icon={<DeleteOutlined />} size="small" type="text" danger />
                  </Popconfirm>
                </Space>
              </Col>
            </Row>
          </div>
        ))}
      </Card>

      {/* Right panel: 3-tab flow designer */}
      <Card
        title={
          selectedFlow
            ? (
              <Space>
                <span>话术设置</span>
                <Text type="secondary" style={{ fontWeight: 400 }}>— {selectedFlow.name}</Text>
              </Space>
            )
            : '请从左侧选择或新建话术场景'
        }
        style={{ flex: 1, overflow: 'auto' }}
        extra={selectedFlow ? (
          <Space>
            <Button icon={<CodeOutlined />} onClick={previewDialplan}>查看方言</Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={saveFlow}>保存流程</Button>
          </Space>
        ) : null}
      >
        {!selectedFlow ? (
          <Empty description="请从左侧选择一个话术场景进行设计" />
        ) : (
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: 'technique',
                label: '话术内容',
                children: (
                  <>
                    <Space style={{ marginBottom: 12 }} wrap>
                      {STEP_TYPES.map(t => (
                        <Button key={t.value} icon={t.icon} size="small"
                          onClick={() => openAddStep(t.value)}>
                          添加{t.label}
                        </Button>
                      ))}
                    </Space>
                    <Table
                      columns={techniqueColumns}
                      dataSource={steps}
                      rowKey="id"
                      pagination={false}
                      locale={{ emptyText: '暂无话术内容，请点击上方按钮添加' }}
                      size="middle"
                      scroll={{ x: 800 }}
                    />
                  </>
                ),
              },
              {
                key: 'keyword',
                label: (
                  <span>
                    关键词流程
                    {gatherSteps.length > 0 && (
                      <Badge
                        count={gatherSteps.reduce((a, s) => a + (s.branches || []).length, 0)}
                        style={{ marginLeft: 6, backgroundColor: '#1677ff' }}
                      />
                    )}
                  </span>
                ),
                children: gatherSteps.length === 0 ? (
                  <Alert type="info" showIcon
                    message="请先在「话术内容」中添加「按键收集」步骤，再在此处配置关键词分支" />
                ) : (
                  <>
                    {KEYWORD_CATEGORIES.map(cat => {
                      const rows = branchesByCategory[cat.value] || [];
                      return (
                        <Card
                          key={cat.value}
                          size="small"
                          title={cat.label}
                          style={{ marginBottom: 12 }}
                          extra={
                            <Button size="small" icon={<PlusOutlined />}
                              onClick={() => {
                                const firstGather = gatherSteps[0];
                                if (firstGather) {
                                  openAddBranch(firstGather.id);
                                  kwForm.setFieldValue('category', cat.value);
                                }
                              }}>
                              添加
                            </Button>
                          }
                        >
                          {rows.length === 0
                            ? <Text type="secondary" style={{ fontSize: 12 }}>暂无配置</Text>
                            : (
                              <Table
                                size="small"
                                columns={kwColumns}
                                dataSource={rows}
                                rowKey={(r: any) => `${r.stepId}-${r.idx}`}
                                pagination={false}
                              />
                            )
                          }
                        </Card>
                      );
                    })}
                    {(branchesByCategory['uncategorized'] || []).length > 0 && (
                      <Card size="small" title="未分类按键" style={{ marginBottom: 12 }}>
                        <Table
                          size="small"
                          columns={kwColumns}
                          dataSource={branchesByCategory['uncategorized']}
                          rowKey={(r: any) => `${r.stepId}-${r.idx}`}
                          pagination={false}
                        />
                      </Card>
                    )}
                    <Divider />
                    <Text type="secondary" style={{ fontSize: 12 }}>按收集步骤添加分支：</Text>
                    <Space wrap style={{ marginTop: 8 }}>
                      {gatherSteps.map(s => (
                        <Button key={s.id} size="small" icon={<PlusOutlined />}
                          onClick={() => openAddBranch(s.id)}>
                          {s.name} 添加分支
                        </Button>
                      ))}
                    </Space>
                  </>
                ),
              },
              {
                key: 'learning',
                label: '待学习内容',
                children: (
                  <>
                    <Alert
                      type="info"
                      showIcon
                      icon={<QuestionCircleOutlined />}
                      message="系统将自动收集通话中未匹配的用户回复，供您选择学习或忽略"
                      style={{ marginBottom: 16 }}
                    />
                    <Table
                      columns={[
                        { title: '待学习的内容', dataIndex: 'content', key: 'content' },
                        { title: '来源', dataIndex: 'source', key: 'source', width: 120 },
                        {
                          title: '学习状态', key: 'status', width: 100,
                          render: () => <Tag color="orange">待学习</Tag>,
                        },
                        { title: '记录时间', dataIndex: 'createdAt', key: 'createdAt', width: 160 },
                        {
                          title: '操作', key: 'action', width: 140,
                          render: () => (
                            <Space>
                              <Button size="small" icon={<CheckOutlined />}>学习</Button>
                              <Button size="small" danger icon={<CloseOutlined />}>忽略</Button>
                            </Space>
                          ),
                        },
                      ]}
                      dataSource={[]}
                      rowKey="id"
                      pagination={false}
                      locale={{ emptyText: '暂无待学习内容' }}
                    />
                  </>
                ),
              },
            ]}
          />
        )}
      </Card>

      {/* Create flow modal */}
      <Modal
        open={flowModalOpen}
        title="添加话术场景"
        onOk={createFlow}
        onCancel={() => { setFlowModalOpen(false); flowForm.resetFields(); }}
        okText="确定"
        cancelText="关闭"
      >
        <Form form={flowForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="场景名称" rules={[{ required: true }]}>
            <Input placeholder="例如: 贷款推介话术" />
          </Form.Item>
          <Form.Item name="industry" label="行业类型" initialValue="">
            <Select>
              {INDUSTRY_OPTIONS.map(o => <Option key={o.value} value={o.value}>{o.label}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="话术场景说明..." />
          </Form.Item>
          <Form.Item name="language" label="语言" initialValue="zh-CN">
            <Select>
              <Option value="zh-CN">中文</Option>
              <Option value="en-US">English</Option>
              <Option value="ms-MY">Bahasa Melayu</Option>
            </Select>
          </Form.Item>
          <Form.Item name="maxRetries" label="无回应最多重播次数" initialValue={3}>
            <InputNumber min={1} max={10} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Step edit modal */}
      <Modal
        open={stepModalOpen}
        title={editingStep?._isNew ? `添加${stepTypeLabel(editingStep?.type || '')}` : '编辑话术步骤'}
        onOk={saveStep}
        onCancel={() => { setStepModalOpen(false); setEditingStep(null); stepForm.resetFields(); }}
        okText="确定"
        cancelText="关闭"
        width={520}
      >
        {editingStep && (
          <Form form={stepForm} layout="vertical" style={{ marginTop: 16 }}>
            <Form.Item name="name" label="步骤名称" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            {editingStep.type === 'play' && (
              <>
                <Form.Item name="audioFileId" label="语音文件">
                  <Select allowClear placeholder="选择已上传的语音文件" showSearch optionFilterProp="children">
                    {audioFiles.map(f => <Option key={f.id} value={f.id}>{f.name}</Option>)}
                  </Select>
                </Form.Item>
                <Divider plain>或使用文字转语音 (TTS)</Divider>
                <Form.Item name="text" label="话术文字 (未选语音时朗读)">
                  <TextArea rows={3} placeholder="您好，欢迎致电…" />
                </Form.Item>
              </>
            )}
            {editingStep.type === 'gather' && (
              <>
                <Form.Item name="text" label="话术文字 / 提示语">
                  <TextArea rows={2} placeholder="请按1继续，按2…" />
                </Form.Item>
                <Form.Item name="audioFileId" label="提示语音文件">
                  <Select allowClear placeholder="选择提示音频">
                    {audioFiles.map(f => <Option key={f.id} value={f.id}>{f.name}</Option>)}
                  </Select>
                </Form.Item>
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item name="maxDigits" label="最多按键位数" initialValue={1}>
                      <InputNumber min={1} max={10} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="timeout" label="等待超时 (秒)" initialValue={5}>
                      <InputNumber min={1} max={30} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item name="keyword" label="匹配关键字 (逗号分隔)">
                  <Input placeholder="确认,好的,可以" />
                </Form.Item>
              </>
            )}
            {editingStep.type === 'transfer' && (
              <>
                <Form.Item name="destinationType" label="转接类型" initialValue="extension">
                  <Select>
                    <Option value="extension">转分机</Option>
                    <Option value="queue">转队列 (人工坐席)</Option>
                  </Select>
                </Form.Item>
                <Form.Item name="destinationId" label="目标" rules={[{ required: true }]}>
                  <Select showSearch optionFilterProp="children" placeholder="选择目标">
                    {stepDestType === 'queue'
                      ? queues.map(q => <Option key={q.id} value={q.id}>{q.name}</Option>)
                      : extensions.map(e => <Option key={e.number} value={e.number}>{e.number} - {e.name}</Option>)
                    }
                  </Select>
                </Form.Item>
              </>
            )}
            {editingStep.type === 'hangup' && (
              <Alert message="此步骤将直接结束通话" type="warning" showIcon />
            )}
          </Form>
        )}
      </Modal>

      {/* Keyword branch modal */}
      <Modal
        open={kwModalOpen}
        title={editingKw ? '编辑关键词分支' : '添加关键词分支'}
        onOk={saveBranch}
        onCancel={() => { setKwModalOpen(false); setEditingKw(null); kwForm.resetFields(); }}
        okText="确定"
        cancelText="关闭"
      >
        <Form form={kwForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="category" label="流程分类">
            <Select allowClear placeholder="请选择关键字流程分类">
              {KEYWORD_CATEGORIES.map(c => <Option key={c.value} value={c.value}>{c.label}</Option>)}
            </Select>
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="digit" label="触发按键 (DTMF)">
                <Input placeholder="0-9、*、#" maxLength={2} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="keyword" label="触发关键字">
                <Input placeholder="确认、好的…" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="nextStepId" label="跳转目标步骤">
            <Select placeholder="选择跳转步骤">
              {steps.filter(s => s.id !== kwStepId).map(s => (
                <Option key={s.id} value={s.id}>{s.name}</Option>
              ))}
              <Option value="hangup">挂断</Option>
              <Option value="repeat">重复此步骤</Option>
              <Option value="transfer">转人工坐席</Option>
            </Select>
          </Form.Item>
          <Form.Item name="bridge" label="转人工坐席" valuePropName="checked" initialValue={false}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* Asterisk dialplan preview modal */}
      <Modal
        open={!!dialplanModal}
        title="Asterisk 方言预览"
        onCancel={() => setDialplanModal(null)}
        footer={<Button onClick={() => setDialplanModal(null)}>关闭</Button>}
        width={700}
      >
        <pre style={{
          background: '#1e1e1e', color: '#d4d4d4', padding: 16,
          borderRadius: 4, overflow: 'auto', maxHeight: 400, fontSize: 12,
        }}>
          {dialplanModal}
        </pre>
      </Modal>
    </div>
  );
};

export default AiFlowBuilder;
