import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export const socketService = {
  connect: (): Socket => {
    if (!socket) {
      const token = localStorage.getItem('token')
      socket = io('/', {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      })

      socket.on('connect', () => {
        console.log('Socket.IO connected:', socket?.id)
      })

      socket.on('disconnect', (reason) => {
        console.log('Socket.IO disconnected:', reason)
      })

      socket.on('connect_error', (err) => {
        console.error('Socket.IO connection error:', err.message)
      })
    }
    return socket
  },

  disconnect: () => {
    if (socket) {
      socket.disconnect()
      socket = null
    }
  },

  getSocket: (): Socket | null => socket,
}
