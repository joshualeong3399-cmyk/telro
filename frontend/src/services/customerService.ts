import api from './api'

export interface Customer {
  id: number
  name: string
  phone: string
  tags: string[]
  remark: string
  createdAt: string
}

export interface PageResult<T> {
  records: T[]
  total: number
}

export const customerService = {
  list: (p: { page: number; pageSize: number; keyword?: string }): Promise<PageResult<Customer>> =>
    api.get('/customers', { params: p }),

  create: (d: Omit<Customer, 'id' | 'createdAt'>): Promise<Customer> =>
    api.post('/customers', d),

  update: (id: number, d: Partial<Omit<Customer, 'id' | 'createdAt'>>): Promise<Customer> =>
    api.put(`/customers/${id}`, d),

  remove: (id: number): Promise<void> =>
    api.delete(`/customers/${id}`),
}
