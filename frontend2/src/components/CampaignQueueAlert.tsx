import { useEffect, useRef, useState, useCallback } from 'react'
import { Modal, Button, Space, Typography, Tag, Descriptions } from 'antd'
import { PhoneOutlined, CloseOutlined } from '@ant-design/icons'
import { socketService } from '@/services/socket'
import type { IncomingCallPayload } from '@/services/socket'

const { Text, Title } = Typography

// ── 使用 Web Audio API 合成简单来电提示音（无需外部文件）──────────────────
function playRingtone(): () => void {
  let stopped = false
  const AudioCtx = window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return () => {}

  const ctx = new AudioCtx()

  const beep = (startTime: number, freq: number, duration: number) => {
    if (stopped) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = freq
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.3, startTime)
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
    osc.start(startTime)
    osc.stop(startTime + duration)
  }

  // Ring pattern: two short beeps, pause, repeat
  const pattern = () => {
    if (stopped) return
    const now = ctx.currentTime
    beep(now,       880, 0.25)
    beep(now + 0.3, 880, 0.25)
    // repeat every 2s
  }

  pattern()
  const timer = setInterval(() => { if (!stopped) pattern() }, 2000)

  return () => {
    stopped = true
    clearInterval(timer)
    ctx.close().catch(() => {})
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
const CampaignQueueAlert: React.FC = () => {
  const [call, setCall] = useState<IncomingCallPayload | null>(null)
  const [visible, setVisible] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const stopRingtoneRef = useRef<(() => void) | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── 清理函数 ─────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    stopRingtoneRef.current?.()
    stopRingtoneRef.current = null
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setElapsed(0)
  }, [])

  const closeModal = useCallback(() => {
    cleanup()
    setVisible(false)
    setCall(null)
  }, [cleanup])

  // ── 监听来电事件 ──────────────────────────────────────────────────────────
  useEffect(() => {
    const handleIncoming = (data: IncomingCallPayload) => {
      cleanup()
      setCall(data)
      setElapsed(data.queueTime ?? 0)
      setVisible(true)

      // 响铃
      stopRingtoneRef.current = playRingtone()

      // 计时：显示排队时长
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1)
      }, 1000)
    }

    socketService.on('campaign:incoming-call', handleIncoming)
    return () => {
      socketService.off('campaign:incoming-call', handleIncoming)
      cleanup()
    }
  }, [cleanup])

  // ── 操作 ──────────────────────────────────────────────────────────────────
  const handleAnswer = () => {
    if (!call) return
    socketService.emit('campaign:answer', call.callId)
    closeModal()
  }

  const handleReject = () => {
    if (!call) return
    socketService.emit('campaign:reject', call.callId)
    closeModal()
  }

  const fmtElapsed = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return m > 0 ? `${m}m ${String(sec).padStart(2, '0')}s` : `${s}s`
  }

  return (
    <Modal
      open={visible}
      closable={false}
      footer={null}
      centered
      width={420}
      maskClosable={false}
      styles={{
        mask: { background: 'rgba(0,0,0,0.6)' },
        content: { borderTop: '4px solid #52c41a', borderRadius: 8 },
      }}
    >
      {call && (
        <div style={{ padding: '8px 0' }}>
          {/* 来电标题 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div
              style={{
                width: 44, height: 44, borderRadius: '50%',
                background: '#f6ffed', border: '2px solid #52c41a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'pulse 1.2s ease-in-out infinite',
              }}
            >
              <PhoneOutlined style={{ fontSize: 20, color: '#52c41a' }} />
            </div>
            <div>
              <Title level={5} style={{ margin: 0 }}>群呼来电</Title>
              {call.campaignName && (
                <Tag color="blue" style={{ marginTop: 2 }}>{call.campaignName}</Tag>
              )}
            </div>
            <Text
              type="secondary"
              style={{ marginLeft: 'auto', fontSize: 12, fontFamily: 'monospace' }}
            >
              排队 {fmtElapsed(elapsed)}
            </Text>
          </div>

          {/* 来电信息 */}
          <Descriptions column={1} size="small" bordered style={{ marginBottom: 20 }}>
            <Descriptions.Item label="客户姓名">
              <Text strong style={{ fontSize: 15 }}>{call.customerName}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="电话号码">
              <Text copyable style={{ fontFamily: 'monospace', fontSize: 14 }}>
                {call.phone}
              </Text>
            </Descriptions.Item>
            {call.remark && (
              <Descriptions.Item label="备注">
                <Text type="secondary">{call.remark}</Text>
              </Descriptions.Item>
            )}
          </Descriptions>

          {/* 操作按钮 */}
          <Space style={{ width: '100%', justifyContent: 'center' }} size={16}>
            <Button
              type="primary"
              icon={<PhoneOutlined />}
              size="large"
              style={{
                background: '#52c41a', borderColor: '#52c41a',
                minWidth: 140, height: 44, fontSize: 16,
              }}
              onClick={handleAnswer}
            >
              接 听
            </Button>
            <Button
              danger
              icon={<CloseOutlined />}
              size="large"
              style={{ minWidth: 140, height: 44, fontSize: 16 }}
              onClick={handleReject}
            >
              拒 绝
            </Button>
          </Space>
        </div>
      )}

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%   { box-shadow: 0 0 0 0 rgba(82,196,26,0.5); }
          70%  { box-shadow: 0 0 0 10px rgba(82,196,26,0); }
          100% { box-shadow: 0 0 0 0 rgba(82,196,26,0); }
        }
      `}</style>
    </Modal>
  )
}

export default CampaignQueueAlert
