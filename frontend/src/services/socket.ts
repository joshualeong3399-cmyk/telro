import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'
import { getCookie, TOKEN_KEY } from '@/utils/cookie'

// ── Typed event payloads ──────────────────────────────────────────────────────
export interface IncomingCallPayload {
  callId: string
  customerName: string
  phone: string
  remark?: string
  campaignName?: string
  queueTime?: number   // seconds queued
}

export interface AgentStatusPayload {
  agentId: number
  agentNo: string
  name: string
  status: 'online' | 'busy' | 'away' | 'offline'
  currentCallId?: string
}

export interface CallUpdatePayload {
  totalCalls: number
  answeredCalls: number
  queuedCalls: number
  onlineAgents: number
}

// ── Typed Socket interfaces ───────────────────────────────────────────────────
interface ServerToClientEvents {
  'campaign:incoming-call': (data: IncomingCallPayload) => void
  'agent:status': (data: AgentStatusPayload) => void
  'call:update': (data: CallUpdatePayload) => void
}

interface ClientToServerEvents {
  'campaign:answer': (callId: string) => void
  'campaign:reject': (callId: string) => void
}

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>

// ── Singleton ─────────────────────────────────────────────────────────────────
let _socket: AppSocket | null = null

export const socketService = {
  /**
   * 连接 Socket.IO（单例，重复调用安全）
   */
  connect(): AppSocket {
    if (_socket?.connected) return _socket

    const token = getCookie(TOKEN_KEY)

    _socket = io('/', {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
      timeout: 10_000,
    }) as AppSocket

    _socket.on('connect', () => {
      console.info('[Socket] Connected:', _socket?.id)
    })

    _socket.on('disconnect', (reason) => {
      console.info('[Socket] Disconnected:', reason)
    })

    _socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message)
    })

    return _socket
  },

  /**
   * 断开并销毁连接
   */
  disconnect() {
    if (_socket) {
      _socket.disconnect()
      _socket = null
    }
  },

  /**
   * 获取当前 socket 实例（未连接时返回 null）
   */
  getSocket(): AppSocket | null {
    return _socket
  },

  /**
   * 监听服务器事件（类型安全）
   */
  on<K extends keyof ServerToClientEvents>(
    event: K,
    listener: ServerToClientEvents[K],
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _socket?.on(event as any, listener as any)
  },

  /**
   * 取消监听
   */
  off<K extends keyof ServerToClientEvents>(
    event: K,
    listener?: ServerToClientEvents[K],
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _socket?.off(event as any, listener as any)
  },

  /**
   * 发送事件到服务器（类型安全）
   */
  emit<K extends keyof ClientToServerEvents>(
    event: K,
    ...args: Parameters<ClientToServerEvents[K]>
  ) {
    _socket?.emit(event, ...args)
  },
}
