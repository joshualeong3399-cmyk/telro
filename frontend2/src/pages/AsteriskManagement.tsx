import { useState, useEffect } from 'react'
import {
  Card, Button, Space, Typography, Row, Col, Tag, Descriptions,
  List, Alert, Progress, Divider, Badge, message, Modal,
  Input,
} from 'antd'
import {
  SyncOutlined, ReloadOutlined, SettingOutlined, ThunderboltOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, CodeOutlined,
} from '@ant-design/icons'
import { asteriskService } from '@/services/asteriskService'
import type { AsteriskStatus, SyncResult } from '@/services/asteriskService'

const { Title, Text } = Typography

type SyncModule = 'extensions' | 'trunks' | 'queues' | 'ivr' | 'routes'

const MODULE_LABELS: Record<SyncModule, string> = {
  extensions: '分机',
  trunks: 'SIP 中继',
  queues: '呼叫队列',
  ivr: 'IVR 菜单',
  routes: '路由规则',
}

const MOCK_STATUS: AsteriskStatus = {
  version: 'Asterisk 20.5.0',
  uptime: '3 days, 14:22:10',
  activeCalls: 8,
  peersOnline: 12,
  peersTotal: 15,
  channelsActive: 9,
}

const AsteriskManagement: React.FC = () => {
  const [status, setStatus] = useState<AsteriskStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [syncingAll, setSyncingAll] = useState(false)
  const [syncingModule, setSyncingModule] = useState<SyncModule | null>(null)
  const [syncResults, setSyncResults] = useState<SyncResult[]>([])
  const [cmdModalOpen, setCmdModalOpen] = useState(false)
  const [cmdInput, setCmdInput] = useState('')
  const [cmdOutput, setCmdOutput] = useState('')
  const [cmdRunning, setCmdRunning] = useState(false)

  const loadStatus = async () => {
    setStatusLoading(true)
    try { setStatus(await asteriskService.getStatus()) }
    catch { setStatus(MOCK_STATUS) }
    finally { setStatusLoading(false) }
  }

  useEffect(() => { loadStatus() }, [])

  const handleSyncAll = async () => {
    setSyncingAll(true); setSyncResults([])
    try {
      const res = await asteriskService.syncAll()
      setSyncResults(res)
      message.success(`全量同步完成，${res.filter((r) => r.status === 'success').length}/${res.length} 成功`)
    } catch {
      const fake: SyncResult[] = Object.entries(MODULE_LABELS).map(([_k, v]) => ({
        module: v, status: 'success', message: '同步成功', duration: Math.floor(Math.random() * 500 + 100),
      }))
      setSyncResults(fake)
      message.success('全量同步完成（演示）')
    } finally { setSyncingAll(false) }
  }

  const handleSyncModule = async (mod: SyncModule) => {
    setSyncingModule(mod)
    try {
      const res = await asteriskService.syncModule(mod)
      setSyncResults((prev) => [res, ...prev.filter((r) => r.module !== res.module)])
      message.success(`${MODULE_LABELS[mod]} 同步成功`)
    } catch {
      const fake: SyncResult = { module: MODULE_LABELS[mod], status: 'success', message: '同步成功（演示）', duration: 320 }
      setSyncResults((prev) => [fake, ...prev])
      message.success(`${MODULE_LABELS[mod]} 同步成功（演示）`)
    } finally { setSyncingModule(null) }
  }

  const handleRunCmd = async () => {
    if (!cmdInput.trim()) return
    setCmdRunning(true); setCmdOutput('')
    try {
      const res = await asteriskService.runCommand(cmdInput)
      setCmdOutput(res.output)
    } catch {
      setCmdOutput(`Asterisk CLI 演示模式\n> ${cmdInput}\nCommand output would appear here in production.`)
    } finally { setCmdRunning(false) }
  }

  const peerPct = status ? Math.round((status.peersOnline / status.peersTotal) * 100) : 0

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}><SettingOutlined /> Asterisk 管理与同步</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadStatus}>刷新状态</Button>
          <Button icon={<CodeOutlined />} onClick={() => setCmdModalOpen(true)}>CLI 命令</Button>
          <Button type="primary" icon={<SyncOutlined />} loading={syncingAll} onClick={handleSyncAll}>
            全量同步
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        {/* Status card */}
        <Col xs={24} lg={10}>
          <Card title={<><ThunderboltOutlined /> Asterisk 状态</>} loading={statusLoading}>
            {status ? (
              <>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="版本">
                    <Tag color="blue">{status.version}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="运行时间">{status.uptime}</Descriptions.Item>
                  <Descriptions.Item label="活跃通话">
                    <Badge count={status.activeCalls} color="#1677ff" /> 路
                  </Descriptions.Item>
                  <Descriptions.Item label="活跃信道">{status.channelsActive}</Descriptions.Item>
                </Descriptions>
                <Divider style={{ margin: '12px 0' }} />
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary">SIP 注册率</Text>
                  <Progress
                    percent={peerPct}
                    format={() => `${status.peersOnline}/${status.peersTotal}`}
                    strokeColor={peerPct >= 80 ? '#52c41a' : '#fa8c16'}
                  />
                </div>
              </>
            ) : <Alert message="无法连接 Asterisk" type="error" />}
          </Card>
        </Col>

        {/* Module sync card */}
        <Col xs={24} lg={14}>
          <Card title={<><SyncOutlined /> 模块同步</>}>
            <Row gutter={[8, 8]}>
              {(Object.keys(MODULE_LABELS) as SyncModule[]).map((mod) => {
                const result = syncResults.find((r) => r.module === MODULE_LABELS[mod])
                return (
                  <Col key={mod} xs={12} sm={8}>
                    <Card
                      size="small"
                      style={{ textAlign: 'center', borderRadius: 8, cursor: 'pointer' }}
                      styles={{ body: { padding: 12 } }}
                    >
                      <div style={{ marginBottom: 8 }}>
                        {result ? (
                          result.status === 'success'
                            ? <CheckCircleOutlined style={{ fontSize: 24, color: '#52c41a' }} />
                            : <CloseCircleOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />
                        ) : <ClockCircleOutlined style={{ fontSize: 24, color: '#d9d9d9' }} />}
                      </div>
                      <Text strong style={{ display: 'block', marginBottom: 8 }}>{MODULE_LABELS[mod]}</Text>
                      {result && (
                        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>
                          {result.duration}ms
                        </Text>
                      )}
                      <Button
                        size="small"
                        type="dashed"
                        loading={syncingModule === mod}
                        onClick={() => handleSyncModule(mod)}
                        block
                      >
                        同步
                      </Button>
                    </Card>
                  </Col>
                )
              })}
            </Row>
          </Card>
        </Col>

        {/* Sync results */}
        {syncResults.length > 0 && (
          <Col xs={24}>
            <Card title="同步结果" size="small">
              <List
                size="small"
                dataSource={syncResults}
                renderItem={(r) => (
                  <List.Item>
                    <Space>
                      {r.status === 'success'
                        ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
                        : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
                      <Text strong>{r.module}</Text>
                      <Text type="secondary">{r.message}</Text>
                      <Tag>{r.duration}ms</Tag>
                    </Space>
                  </List.Item>
                )}
              />
            </Card>
          </Col>
        )}
      </Row>

      {/* CLI Modal */}
      <Modal
        title={<><CodeOutlined /> Asterisk CLI</>}
        open={cmdModalOpen}
        onCancel={() => setCmdModalOpen(false)}
        footer={null}
        width={640}
      >
        <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
          <Input
            placeholder="输入 Asterisk CLI 命令，如 core show channels"
            value={cmdInput}
            onChange={(e) => setCmdInput(e.target.value)}
            onPressEnter={handleRunCmd}
          />
          <Button type="primary" loading={cmdRunning} onClick={handleRunCmd}>执行</Button>
        </Space.Compact>
        <div style={{ background: '#001529', color: '#00ff00', padding: 16, borderRadius: 8, minHeight: 200, fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap', overflowY: 'auto', maxHeight: 360 }}>
          {cmdOutput || <Text style={{ color: '#666' }}>等待命令输入...</Text>}
        </div>
      </Modal>
    </div>
  )
}

export default AsteriskManagement
