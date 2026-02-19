import api from './api'

export interface ConferenceRoom {
  id: number
  name: string
  extension: string
  pin?: string
  adminPin?: string
  maxParticipants: number
  recordConference: boolean
  waitForAdmin: boolean
  enabled: boolean
  activeParticipants?: number
  createdAt: string
}

export interface CreateConferenceRoomDto {
  name: string
  extension: string
  pin?: string
  adminPin?: string
  maxParticipants?: number
  recordConference?: boolean
  waitForAdmin?: boolean
  enabled?: boolean
}

export interface ConferenceParticipant {
  channel: string
  callerIdName: string
  callerIdNumber: string
  joinTime: string
  muted: boolean
  talking: boolean
}

export const conferenceService = {
  list: (): Promise<ConferenceRoom[]> => api.get('/conference'),
  get: (id: number): Promise<ConferenceRoom> => api.get(`/conference/${id}`),
  create: (dto: CreateConferenceRoomDto): Promise<ConferenceRoom> =>
    api.post('/conference', dto),
  update: (id: number, dto: Partial<CreateConferenceRoomDto>): Promise<ConferenceRoom> =>
    api.put(`/conference/${id}`, dto),
  delete: (id: number): Promise<void> => api.delete(`/conference/${id}`),
  getParticipants: (id: number): Promise<ConferenceParticipant[]> =>
    api.get(`/conference/${id}/participants`),
  kickParticipant: (id: number, channel: string): Promise<void> =>
    api.post(`/conference/${id}/kick`, { channel }),
  muteParticipant: (id: number, channel: string): Promise<void> =>
    api.post(`/conference/${id}/mute`, { channel }),
}
