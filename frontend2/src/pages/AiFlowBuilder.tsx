import { useState, useEffect, useContext, createContext, useCallback, useMemo } from 'react'
import type { CSSProperties, HTMLAttributes } from 'react'
import {
  Card, Button, Input, Switch, Tag, Tabs, Table, Modal, Form,
  Select, Space, Tooltip, Empty, Spin, message, Popconfirm, Row, Col, Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  PlusOutlined, SearchOutlined, CopyOutlined, DeleteOutlined,
  HolderOutlined, EditOutlined,
} from '@ant-design/icons'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { aiFlowService } from '@/services/aiFlowService'
import type { AiFlow, FlowStep, KeywordCategory, StepType, IndustryType } from '@/types/aiFlow'

const { Text } = Typography
const { TextArea } = Input

// ─── Config ────────────────────────────────────────────────────────────────────
const INDUSTRY_CONFIG: Record<IndustryType, { label: string; color: string }> = {
  education:  { label: '教育',   color: 'blue' },
  finance:    { label: '金融',   color: 'gold' },
  ecommerce:  { label: '电商',   color: 'purple' },
  realestate: { label: '房产',   color: 'cyan' },
  auto:       { label: '汽车',   color: 'orange' },
  medical:    { label: '医疗',   color: 'green' },
  insurance:  { label: '保险',   color: 'red' },
  internet:   { label: '互联网', color: 'geekblue' },
}

const STEP_TYPE_CONFIG: Record<StepType, { label: string; color: string }> = {
  greeting: { label: '问候', color: 'blue' },
  question: { label: '提问', color: 'orange' },
  answer:   { label: '回答', color: 'green' },
  ending:   { label: '结束', color: 'default' },
}

const KW_CATEGORY_CONFIG: {
  key: KeywordCategory; label: string; color: string; border: string
}[] = [
  { key: 'retain',       label: '挽回用户', color: 'blue',    border: '#1677ff' },
  { key: 'userQuestion', label: '用户提问', color: 'green',   border: '#52c41a' },
  { key: 'userBusy',     label: '用户说忙', color: 'orange',  border: '#fa8c16' },
  { key: 'userRefuse',   label: '用户拒绝', color: 'red',     border: '#f5222d' },
  { key: 'activeEnd',    label: '主动结束', color: 'purple',  border: '#722ed1' },
  { key: 'noSpeech',     label: '未说话',   color: 'default', border: '#d9d9d9' },
  { key: 'cannotAnswer', label: '回答不了', color: 'cyan',    border: '#13c2c2' },
]

// ─── Mock Data ─────────────────────────────────────────────────────────────────
const EMPTY_KEYWORDS = (): AiFlow['keywords'] => ({
  retain: [], userQuestion: [], userBusy: [], userRefuse: [],
  activeEnd: [], noSpeech: [], cannotAnswer: [],
})

const MOCK_FLOWS: AiFlow[] = [
  {
    id: 1,
    name: '教育招生外呼话术',
    industry: 'education',
    enabled: true,
    steps: [
      { id: 's1', order: 1, content: '您好，我是XX教育的招生顾问小智，请问是XX先生/女士吗？', type: 'greeting', transferAgent: false, keywords: [] },
      { id: 's2', order: 2, content: '请问您孩子目前在读几年级呢？', type: 'question', transferAgent: false, keywords: ['年级', '几年级', '多大'] },
      { id: 's3', order: 3, content: '我们针对该年级提供一对一辅导课程，现在报名可享受8折优惠。', type: 'answer', transferAgent: false, keywords: ['辅导', '课程', '优惠'] },
      { id: 's4', order: 4, content: '感谢您的时间，期待与您进一步沟通，再见！', type: 'ending', transferAgent: false, keywords: [] },
    ],
    keywords: {
      retain:       [{ id: 'r1', keywords: ['再考虑', '以后吧', '考虑一下'], action: '强调限时优惠活动' }],
      userQuestion: [{ id: 'q1', keywords: ['费用', '价格', '多少钱', '收费'], action: '转接人工坐席' }],
      userBusy:     [{ id: 'b1', keywords: ['开会', '忙', '没空', '等会'], action: '预约回拨时间' }],
      userRefuse:   [{ id: 'rf1', keywords: ['不需要', '不感兴趣', '不用了'], action: '礼貌结束通话' }],
      activeEnd:    [{ id: 'ae1', keywords: ['挂断', '再见', '拜拜'], action: '结束对话流程' }],
      noSpeech:     [{ id: 'ns1', keywords: [], action: '重复问候语，询问是否在线' }],
      cannotAnswer: [{ id: 'ca1', keywords: [], action: '转接人工坐席处理' }],
    },
  },
  {
    id: 2,
    name: '金融贷款产品推广',
    industry: 'finance',
    enabled: false,
    steps: [
      { id: 's5', order: 1, content: '您好，我是XX金融的客服代表，打扰您一分钟...', type: 'greeting', transferAgent: false, keywords: [] },
    ],
    keywords: EMPTY_KEYWORDS(),
  },
  {
    id: 3,
    name: '电商双十一促销通知',
    industry: 'ecommerce',
    enabled: true,
    steps: [
      { id: 's6', order: 1, content: '您好，感谢您长期以来对我们平台的支持...', type: 'greeting', transferAgent: false, keywords: [] },
      { id: 's7', order: 2, content: '本次双十一大促，您的专属折扣已到账，是否需要了解详情？', type: 'question', transferAgent: false, keywords: ['双十一', '活动', '优惠', '折扣'] },
    ],
    keywords: EMPTY_KEYWORDS(),
  },
]

// ─── DnD: Context + Row ────────────────────────────────────────────────────────
interface DragHandleCtxType {
  setActivatorNodeRef?: (el: HTMLElement | null) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listeners?: any
}
const DragHandleCtx = createContext<DragHandleCtxType>({})

const DragHandle: React.FC = () => {
  const { setActivatorNodeRef, listeners } = useContext(DragHandleCtx)
  return (
    <span
      ref={setActivatorNodeRef as React.RefCallback<HTMLSpanElement>}
      style={{ cursor: 'grab', color: '#bbb', touchAction: 'none', display: 'inline-flex', alignItems: 'center' }}
      {...(listeners as React.HTMLAttributes<HTMLSpanElement>)}
    >
      <HolderOutlined />
    </span>
  )
}

interface SortableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  'data-row-key': string
}

const SortableRow: React.FC<SortableRowProps> = ({ children, ...props }) => {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: props['data-row-key'] })

  const style: CSSProperties = {
    ...props.style,
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { position: 'relative', zIndex: 9999, background: '#e6f4ff', opacity: 0.85 } : {}),
  }

  return (
    <DragHandleCtx.Provider value={{ setActivatorNodeRef, listeners }}>
      <tr {...props} ref={setNodeRef} style={style} {...attributes}>
        {children}
      </tr>
    </DragHandleCtx.Provider>
  )
}

// ─── Step Modal ────────────────────────────────────────────────────────────────
interface StepModalProps {
  open: boolean
  editingStep: FlowStep | null
  onOk: (values: Omit<FlowStep, 'id' | 'order'>) => void
  onCancel: () => void
}

const StepModal: React.FC<StepModalProps> = ({ open, editingStep, onOk, onCancel }) => {
  const [form] = Form.useForm()

  useEffect(() => {
    if (open) {
      form.setFieldsValue(
        editingStep
          ? { content: editingStep.content, type: editingStep.type, audio: editingStep.audio ?? '', keywords: editingStep.keywords, transferAgent: editingStep.transferAgent }
          : { type: 'greeting', keywords: [], transferAgent: false, content: '', audio: '' }
      )
    }
  }, [open, editingStep, form])

  const handleOk = async () => {
    const v = await form.validateFields()
    onOk({ content: v.content, type: v.type, audio: v.audio || undefined, keywords: v.keywords ?? [], transferAgent: v.transferAgent ?? false })
  }

  return (
    <Modal title={editingStep ? '编辑步骤' : '添加步骤'} open={open} onOk={handleOk} onCancel={onCancel} destroyOnClose width={560}>
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="content" label="步骤内容" rules={[{ required: true, message: '请输入步骤内容' }]}>
          <TextArea rows={3} placeholder="输入该步骤的话术内容..." showCount maxLength={500} />
        </Form.Item>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="type" label="步骤类型" rules={[{ required: true }]}>
              <Select options={Object.entries(STEP_TYPE_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))} placeholder="选择类型" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="audio" label="语音文件">
              <Input placeholder="语音文件名（可选）" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="keywords" label="匹配关键词">
          <Select mode="tags" style={{ width: '100%' }} placeholder="输入关键词后按 Enter 添加" tokenSeparators={[',']} />
        </Form.Item>
        <Form.Item name="transferAgent" label="是否转人工" valuePropName="checked">
          <Switch checkedChildren="转人工" unCheckedChildren="不转" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

// ─── Flow Create Modal ─────────────────────────────────────────────────────────
interface FlowModalProps {
  open: boolean
  onOk: (name: string, industry: IndustryType) => void
  onCancel: () => void
}

const FlowModal: React.FC<FlowModalProps> = ({ open, onOk, onCancel }) => {
  const [form] = Form.useForm()
  const handleOk = async () => {
    const v = await form.validateFields()
    onOk(v.name, v.industry)
    form.resetFields()
  }
  return (
    <Modal title="新建场景" open={open} onOk={handleOk} onCancel={() => { form.resetFields(); onCancel() }} destroyOnClose>
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="name" label="场景名称" rules={[{ required: true, message: '请输入场景名称' }]}>
          <Input placeholder="如：教育招生外呼话术" />
        </Form.Item>
        <Form.Item name="industry" label="行业" rules={[{ required: true, message: '请选择行业' }]}>
          <Select placeholder="选择行业" options={Object.entries(INDUSTRY_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

// ─── Steps Tab ─────────────────────────────────────────────────────────────────
interface StepsTabProps {
  steps: FlowStep[]
  onChange: (steps: FlowStep[]) => void
}

const StepsTab: React.FC<StepsTabProps> = ({ steps, onChange }) => {
  const [stepModalOpen, setStepModalOpen] = useState(false)
  const [editingStep, setEditingStep] = useState<FlowStep | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 1 } }))

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const oldIndex = steps.findIndex((s) => s.id === active.id)
    const newIndex = steps.findIndex((s) => s.id === over.id)
    onChange(arrayMove(steps, oldIndex, newIndex).map((s, i) => ({ ...s, order: i + 1 })))
  }

  const handleSaveStep = (values: Omit<FlowStep, 'id' | 'order'>) => {
    if (editingStep) {
      onChange(steps.map((s) => (s.id === editingStep.id ? { ...s, ...values } : s)))
    } else {
      onChange([...steps, { ...values, id: `s${Date.now()}`, order: steps.length + 1 }])
    }
    setStepModalOpen(false)
    setEditingStep(null)
  }

  const openEdit = (step: FlowStep) => { setEditingStep(step); setStepModalOpen(true) }
  const handleDelete = (id: string) => onChange(steps.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i + 1 })))

  const columns: ColumnsType<FlowStep> = [
    { key: 'sort', width: 36, render: () => <DragHandle /> },
    { title: '序号', key: 'order', width: 55, align: 'center', render: (_, __, idx) => <Text type="secondary">{idx + 1}</Text> },
    { title: '内容/步骤', dataIndex: 'content', key: 'content', ellipsis: true },
    {
      title: '类型', dataIndex: 'type', key: 'type', width: 72, align: 'center',
      render: (t: StepType) => <Tag color={STEP_TYPE_CONFIG[t].color}>{STEP_TYPE_CONFIG[t].label}</Tag>,
    },
    {
      title: '语音', dataIndex: 'audio', key: 'audio', width: 120, ellipsis: true,
      render: (v?: string) => v ? <Text code style={{ fontSize: 11 }}>{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: '匹配关键词', dataIndex: 'keywords', key: 'keywords', width: 200,
      render: (kws: string[]) => (
        <Space size={[4, 4]} wrap>
          {kws?.length ? kws.map((kw) => <Tag key={kw} style={{ margin: 0 }}>{kw}</Tag>) : <Text type="secondary">—</Text>}
        </Space>
      ),
    },
    {
      title: '转人工', dataIndex: 'transferAgent', key: 'transferAgent', width: 72, align: 'center',
      render: (v: boolean) => v ? <Tag color="orange">是</Tag> : <Tag>否</Tag>,
    },
    {
      title: '操作', key: 'action', width: 80, align: 'center',
      render: (_, record) => (
        <Space size={0}>
          <Tooltip title="编辑">
            <Button type="text" icon={<EditOutlined />} size="small" onClick={() => openEdit(record)} />
          </Tooltip>
          <Popconfirm title="确定删除该步骤？" onConfirm={() => handleDelete(record.id)}>
            <Button type="text" danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingStep(null); setStepModalOpen(true) }}>
          添加步骤
        </Button>
        <Text type="secondary" style={{ marginLeft: 12, fontSize: 12 }}>拖动左侧图标调整顺序</Text>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <Table
            dataSource={steps}
            columns={columns}
            rowKey="id"
            pagination={false}
            size="small"
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无步骤，点击「添加步骤」开始配置" /> }}
            components={{ body: { row: SortableRow } }}
          />
        </SortableContext>
      </DndContext>
      <StepModal
        open={stepModalOpen}
        editingStep={editingStep}
        onOk={handleSaveStep}
        onCancel={() => { setStepModalOpen(false); setEditingStep(null) }}
      />
    </>
  )
}

// ─── Keywords Tab ──────────────────────────────────────────────────────────────
const KeywordsTab: React.FC<{ keywords: AiFlow['keywords'] }> = ({ keywords }) => (
  <Row gutter={[16, 16]}>
    {KW_CATEGORY_CONFIG.map((cat, idx) => (
      <Col key={cat.key} span={idx === 6 ? 24 : 12}>
        <Card
          size="small"
          title={<Tag color={cat.color} style={{ fontSize: 13, padding: '2px 10px', margin: 0 }}>{cat.label}</Tag>}
          style={{ borderTop: `3px solid ${cat.border}` }}
        >
          {keywords[cat.key]?.length > 0
            ? keywords[cat.key].map((rule) => (
                <div key={rule.id} style={{ marginBottom: 8 }}>
                  <Space size={[4, 4]} wrap>
                    {rule.keywords.length > 0
                      ? rule.keywords.map((kw) => <Tag key={kw}>{kw}</Tag>)
                      : <Text type="secondary" style={{ fontSize: 12 }}>（无关键词触发）</Text>}
                  </Space>
                  <div style={{ marginTop: 4 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>响应动作：</Text>
                    <Text style={{ fontSize: 12 }}>{rule.action}</Text>
                  </div>
                </div>
              ))
            : <Text type="secondary" style={{ fontSize: 12 }}>暂无配置</Text>
          }
        </Card>
      </Col>
    ))}
  </Row>
)

// ─── Main Page ────────────────────────────────────────────────────────────────
const AiFlowBuilder: React.FC = () => {
  const [flows, setFlows] = useState<AiFlow[]>(MOCK_FLOWS)
  const [searchText, setSearchText] = useState('')
  const [selectedFlow, setSelectedFlow] = useState<AiFlow | null>(MOCK_FLOWS[0])
  const [loading, setLoading] = useState(false)
  const [flowModalOpen, setFlowModalOpen] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const data = await aiFlowService.list()
        setFlows(data)
        if (data.length > 0) setSelectedFlow(data[0])
      } catch { /* use mock */ } finally { setLoading(false) }
    }
    load()
  }, [])

  const filteredFlows = useMemo(
    () => flows.filter((f) => f.name.toLowerCase().includes(searchText.toLowerCase())),
    [flows, searchText],
  )

  const updateFlow = useCallback((updated: AiFlow) => {
    setFlows((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
    setSelectedFlow(updated)
  }, [])

  const handleStepsChange = useCallback((steps: FlowStep[]) => {
    if (!selectedFlow) return
    updateFlow({ ...selectedFlow, steps })
  }, [selectedFlow, updateFlow])

  const handleCreateFlow = async (name: string, industry: IndustryType) => {
    const draft: Omit<AiFlow, 'id'> = { name, industry, enabled: false, steps: [], keywords: EMPTY_KEYWORDS() }
    try {
      const created = await aiFlowService.create(draft)
      setFlows((p) => [...p, created]); setSelectedFlow(created)
    } catch {
      const mock: AiFlow = { ...draft, id: Date.now() }
      setFlows((p) => [...p, mock]); setSelectedFlow(mock)
    }
    setFlowModalOpen(false)
    message.success('场景创建成功')
  }

  const handleDuplicate = async (flow: AiFlow) => {
    const copy: AiFlow = { ...flow, id: Date.now(), name: `副本-${flow.name}`, enabled: false }
    try {
      const created = await aiFlowService.duplicate(flow.id)
      setFlows((p) => [...p, created])
    } catch { setFlows((p) => [...p, copy]) }
    message.success('已复制场景')
  }

  const handleDelete = async (id: number) => {
    try { await aiFlowService.remove(id) } catch { /* ignore */ }
    const remaining = flows.filter((f) => f.id !== id)
    setFlows(remaining)
    if (selectedFlow?.id === id) setSelectedFlow(remaining[0] ?? null)
    message.success('已删除场景')
  }

  const handleToggle = async (flow: AiFlow, enabled: boolean) => {
    updateFlow({ ...flow, enabled })
    try { await aiFlowService.update(flow.id, { enabled }) } catch { /* ignore */ }
  }

  const tabItems = selectedFlow ? [
    {
      key: 'script',
      label: '话术内容',
      children: <StepsTab key={selectedFlow.id} steps={selectedFlow.steps} onChange={handleStepsChange} />,
    },
    {
      key: 'keywords',
      label: '关键词流程',
      children: <KeywordsTab keywords={selectedFlow.keywords} />,
    },
    {
      key: 'learning',
      label: '待学习内容',
      children: (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={<Text type="secondary">功能开发中，敬请期待 🚀</Text>}
          style={{ marginTop: 60 }}
        />
      ),
    },
  ] : []

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px - 64px)', minHeight: 0 }}>
      {/* ── Left: Scenario List ── */}
      <div style={{
        width: 300, flexShrink: 0, borderRight: '1px solid #f0f0f0',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Toolbar */}
        <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
          <Button
            type="primary" icon={<PlusOutlined />} block
            onClick={() => setFlowModalOpen(true)}
            style={{ marginBottom: 8 }}
          >
            新建场景
          </Button>
          <Input
            prefix={<SearchOutlined />} placeholder="搜索场景名称..."
            value={searchText} onChange={(e) => setSearchText(e.target.value)} allowClear
          />
        </div>

        {/* Scenario cards */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
          <Spin spinning={loading} size="small">
            {filteredFlows.length === 0 && !loading && (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无场景" style={{ marginTop: 40 }} />
            )}
            {filteredFlows.map((flow) => {
              const industry = INDUSTRY_CONFIG[flow.industry]
              const isSelected = selectedFlow?.id === flow.id
              return (
                <Card
                  key={flow.id} size="small" hoverable
                  onClick={() => setSelectedFlow(flow)}
                  style={{
                    marginBottom: 8, cursor: 'pointer',
                    borderColor: isSelected ? '#1677ff' : undefined,
                    background: isSelected ? '#e6f4ff' : undefined,
                  }}
                  styles={{ body: { padding: '10px 12px' } }}
                >
                  {/* Name + Industry Tag */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Text strong style={{ flex: 1, fontSize: 13 }} ellipsis={{ tooltip: flow.name }}>
                      {flow.name}
                    </Text>
                    <Tag color={industry.color} style={{ margin: 0, fontSize: 11, flexShrink: 0 }}>
                      {industry.label}
                    </Tag>
                  </div>

                  {/* Switch + Actions — stop propagation so card click doesn't fire */}
                  <div
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Switch
                      size="small" checked={flow.enabled}
                      checkedChildren="启用" unCheckedChildren="关闭"
                      onChange={(checked) => handleToggle(flow, checked)}
                    />
                    <Space size={0}>
                      <Tooltip title="复制场景">
                        <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => handleDuplicate(flow)} />
                      </Tooltip>
                      <Popconfirm title="确定删除该场景？" description="删除后无法恢复" onConfirm={() => handleDelete(flow.id)}>
                        <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </Space>
                  </div>
                </Card>
              )
            })}
          </Spin>
        </div>
      </div>

      {/* ── Right: Tab Content ── */}
      <div style={{ flex: 1, padding: '0 20px', overflow: 'auto', minWidth: 0 }}>
        {selectedFlow ? (
          <>
            <div style={{ padding: '12px 0 0', marginBottom: 0 }}>
              <Text strong style={{ fontSize: 16 }}>{selectedFlow.name}</Text>
              <Tag color={INDUSTRY_CONFIG[selectedFlow.industry].color} style={{ marginLeft: 8 }}>
                {INDUSTRY_CONFIG[selectedFlow.industry].label}
              </Tag>
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                {selectedFlow.steps.length} 个步骤
              </Text>
            </div>
            <Tabs items={tabItems} />
          </>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="请在左侧选择或新建一个场景"
            style={{ marginTop: 100 }}
          />
        )}
      </div>

      <FlowModal open={flowModalOpen} onOk={handleCreateFlow} onCancel={() => setFlowModalOpen(false)} />
    </div>
  )
}

export default AiFlowBuilder
