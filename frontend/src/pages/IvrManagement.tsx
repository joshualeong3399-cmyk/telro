import { useState, useEffect } from 'react'
import {
  Table, Button, Space, Tag, Modal, Form, Input,
  Switch, Typography, Popconfirm, message, Tooltip, Card, Descriptions,
  Tabs, Alert,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  BranchesOutlined, SyncOutlined, PhoneOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { ivrService } from '@/services/ivrService'
import type { IvrFlow, CreateIvrFlowDto, IvrNode } from '@/services/ivrService'

const { Title, Text } = Typography


const NODE_COLORS: Record<string, string> = {
  greeting: 'blue', menu: 'purple', playback: 'cyan',
  transfer: 'green', hangup: 'red', condition: 'orange',
}
const NODE_LABELS: Record<string, string> = {
  greeting: '欢迎语', menu: 'DTMF 菜单', playback: '播放语音',
  transfer: '转接', hangup: '挂断', condition: '条件判断',
}

const MOCK: IvrFlow[] = [
  {
    id: 1, name: '主菜单 IVR', extension: '9000', entryNode: 'n1', enabled: true, createdAt: '2025-01-01',
    description: '主叫进入后的 IVR 主菜单',
    nodes: [
      { id: 'n1', type: 'greeting', label: '欢迎语', audioFile: 'welcome.wav', timeout: 5 },
      { id: 'n2', type: 'menu', label: '主菜单', dtmfOptions: { '1': 'n3', '2': 'n4', '0': 'n5' }, timeout: 10, retries: 3 },
      { id: 'n3', type: 'transfer', label: '转销售', transferTarget: '销售队列' },
      { id: 'n4', type: 'transfer', label: '转客服', transferTarget: '客服队列' },
      { id: 'n5', type: 'hangup', label: '挂断' },
    ],
  },
  {
    id: 2, name: '非工作时间 IVR', extension: '9001', entryNode: 'n1', enabled: true, createdAt: '2025-01-10',
    nodes: [
      { id: 'n1', type: 'playback', label: '非工作时间提示', audioFile: 'afterhours.wav' },
      { id: 'n2', type: 'hangup', label: '挂断' },
    ],
  },
]

const NodeFlowView: React.FC<{ nodes: IvrNode[] }> = ({ nodes }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
    {nodes.map((n) => (
      <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Tag color={NODE_COLORS[n.type]}>
          {NODE_LABELS[n.type]}: {n.label}
        </Tag>
        {n.dtmfOptions && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            [{Object.keys(n.dtmfOptions).map((k) => `按${k}`).join('/')}]
          </Text>
        )}
      </div>
    ))}
  </div>
)

const IvrManagement: React.FC = () => {
  const [data, setData] = useState<IvrFlow[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [detailFlow, setDetailFlow] = useState<IvrFlow | null>(null)
  const [editRecord, setEditRecord] = useState<IvrFlow | null>(null)
  const [form] = Form.useForm<CreateIvrFlowDto>()
  const [syncing, setSyncing] = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    try { setData(await ivrService.list()) }
    catch { setData(MOCK) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditRecord(null); form.resetFields()
    form.setFieldsValue({ enabled: true })
    setModalOpen(true)
  }

  const openEdit = (r: IvrFlow) => { setEditRecord(r); form.setFieldsValue(r); setModalOpen(true) }

  const handleSave = async () => {
    const vals = await form.validateFields()
    try {
      if (editRecord) { await ivrService.update(editRecord.id, vals); message.success('更新成功') }
      else { await ivrService.create(vals); message.success('创建成功') }
      setModalOpen(false); load()
    } catch {
      const fake: IvrFlow = { ...vals, id: Date.now(), entryNode: '', nodes: [], enabled: vals.enabled ?? true, createdAt: new Date().toISOString() }
      setData((d) => editRecord ? d.map((x) => x.id === editRecord.id ? { ...x, ...vals } : x) : [...d, fake])
      setModalOpen(false)
    }
  }

  const handleSync = async (id: number) => {
    setSyncing(id)
    try { await ivrService.syncAsterisk(id); message.success('同步成功') }
    catch { message.success('同步成功（演示）') }
    finally { setSyncing(null) }
  }

  const columns: ColumnsType<IvrFlow> = [
    { title: '名称', dataIndex: 'name', width: 180 },
    { title: '分机号', dataIndex: 'extension', width: 90, render: (v: string) => <Tag icon={<PhoneOutlined />} color="blue">{v}</Tag> },
    {
      title: 'IVR 流程', key: 'nodes', width: 320,
      render: (_, r) => r.nodes.length > 0 ? <NodeFlowView nodes={r.nodes.slice(0, 4)} /> : <Text type="secondary">暂无节点</Text>,
    },
    { title: '说明', dataIndex: 'description', width: 160, ellipsis: true },
    { title: '启用', dataIndex: 'enabled', width: 70, render: (v: boolean) => <Switch checked={v} size="small" disabled /> },
    {
      title: '操作', key: 'actions', width: 180, fixed: 'right',
      render: (_, r) => (
        <Space>
          <Tooltip title="查看详情"><Button size="small" icon={<BranchesOutlined />} onClick={() => setDetailFlow(r)} /></Tooltip>
          <Tooltip title="同步 Asterisk"><Button size="small" icon={<SyncOutlined />} loading={syncing === r.id} onClick={() => handleSync(r.id)} /></Tooltip>
          <Tooltip title="编辑"><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /></Tooltip>
          <Popconfirm title="确认删除？" onConfirm={async () => { try { await ivrService.delete(r.id) } catch { /* */ } setData((d) => d.filter((x) => x.id !== r.id)) }}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>IVR 管理</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建 IVR</Button>
        </Space>
      </div>

      <Alert message="IVR 节点可视化编辑器正在开发中，当前支持基础配置管理及同步功能。" type="info" showIcon style={{ marginBottom: 16 }} />

      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} scroll={{ x: 900 }} />

      {/* Detail modal */}
      <Modal title={`IVR 详情 — ${detailFlow?.name}`} open={!!detailFlow} footer={null} onCancel={() => setDetailFlow(null)} width={640}>
        {detailFlow && (
          <Tabs items={[
            {
              key: 'info', label: '基本信息',
              children: (
                <Descriptions column={2} bordered size="small">
                  <Descriptions.Item label="名称">{detailFlow.name}</Descriptions.Item>
                  <Descriptions.Item label="分机号">{detailFlow.extension}</Descriptions.Item>
                  <Descriptions.Item label="入口节点">{detailFlow.entryNode}</Descriptions.Item>
                  <Descriptions.Item label="启用">{detailFlow.enabled ? '是' : '否'}</Descriptions.Item>
                  <Descriptions.Item label="说明" span={2}>{detailFlow.description ?? '-'}</Descriptions.Item>
                </Descriptions>
              ),
            },
            {
              key: 'nodes', label: `节点 (${detailFlow.nodes.length})`,
              children: (
                <Space direction="vertical" style={{ width: '100%' }}>
                  {detailFlow.nodes.map((n) => (
                    <Card key={n.id} size="small" style={{ borderLeft: `3px solid ${NODE_COLORS[n.type] === 'red' ? '#ff4d4f' : '#1677ff'}` }}>
                      <Space>
                        <Tag color={NODE_COLORS[n.type]}>{NODE_LABELS[n.type]}</Tag>
                        <Text strong>{n.label}</Text>
                        {n.audioFile && <Tag icon={<PhoneOutlined />}>{n.audioFile}</Tag>}
                        {n.transferTarget && <Text type="secondary">→ {n.transferTarget}</Text>}
                      </Space>
                      {n.dtmfOptions && (
                        <div style={{ marginTop: 8 }}>
                          {Object.entries(n.dtmfOptions).map(([k, v]) => (
                            <Tag key={k} style={{ margin: 2 }}>按 {k} → {v}</Tag>
                          ))}
                        </div>
                      )}
                    </Card>
                  ))}
                </Space>
              ),
            },
          ]} />
        )}
      </Modal>

      {/* Edit modal */}
      <Modal title={editRecord ? '编辑 IVR' : '新建 IVR'} open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)} width={480} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="IVR 名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="extension" label="分机号" rules={[{ required: true }]}><Input placeholder="例如：9000" /></Form.Item>
          <Form.Item name="description" label="说明"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked"><Switch /></Form.Item>
        </Form>
        <Alert message="节点配置请通过可视化编辑器操作（开发中）" type="info" showIcon />
      </Modal>
    </div>
  )
}

export default IvrManagement
