import api from './api';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    username: string;
    role: string;
  };
}

export const authAPI = {
  login: (data: LoginRequest) =>
    api.post<LoginResponse>('/auth/login', data),
  
  register: (data: { username: string; password: string; email?: string }) =>
    api.post('/auth/register', data),
  
  refreshToken: () =>
    api.post<LoginResponse>('/auth/refresh', {}),
};
