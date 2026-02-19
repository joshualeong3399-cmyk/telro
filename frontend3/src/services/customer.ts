import api from './api';

export interface Customer {
  id: string;
  phoneNumber: string;
  name: string;
  email: string;
  company: string;
  industry: string;
  region: string;
  tags: string[];
  source: string;
  status: 'new' | 'contacted' | 'qualified' | 'lost' | 'converted';
  notes: string;
  lastContactAt: string | null;
  nextFollowupAt: string | null;
  rating: number;
  assignedAgentId: string | null;
  createdAt: string;
  updatedAt: string;
  assignedAgent?: { id: string; user?: { username: string } };
}

export interface CustomerListResponse {
  count: number;
  rows: Customer[];
}

export interface CustomerFilters {
  status?: string;
  source?: string;
  tag?: string;
}

export interface ApiResponse<T> {
  data: T;
}

export interface SuccessResponse<T> {
  success: boolean;
  data: T;
}

export interface ImportResponse {
  success: boolean;
  imported: number;
}

export interface SuccessMessage {
  success: boolean;
}

export interface CustomerResponse {
  success: boolean;
  data: Customer;
}

export interface DeleteResponse {
  success: boolean;
}

export interface UpdateCustomerResponse {
  success: boolean;
  data: Customer;
}

export interface TagResponse {
  success: boolean;
  data: Customer;
}

export interface ImportCustomersResponse {
  success: boolean;
  imported: number;
}

export interface ApiResponseWrapper<T> {
  data: T;
}

export interface CreateCustomerResponse {
  success: boolean;
  data: Customer;
}



export const customerService = {
  /** 获取客户列表 */
  getCustomers: (
    filters?: CustomerFilters,
    params?: { limit?: number; offset?: number }
  ): Promise<CustomerListResponse> =>
        api.get<ApiResponseWrapper<CustomerListResponse>>('/customers', { params: { ...filters, ...params } }).then((r) => r.data),

  /** 获取客户详情 */
  getCustomerDetail: (customerId: string): Promise<Customer> =>
        api.get<ApiResponseWrapper<Customer>>(`/customers/${customerId}`).then((r) => r.data),

  /** 创建客户 */
  createCustomer: (data: Partial<Customer>): Promise<CreateCustomerResponse> =>
    api.post<ApiResponseWrapper<Customer>>('/customers', data).then((r: any) => r.data),

  /** 更新客户 */
  updateCustomer: (
    customerId: string,
    data: Partial<Customer>
  ): Promise<{ success: boolean; data: Customer }> =>
    api.put(`/customers/${customerId}`, data).then((r: { data: any; }) => r.data),

  /** 删除客户 */
  deleteCustomer: (customerId: string): Promise<{ success: boolean }> =>
    api.delete(`/customers/${customerId}`).then((r: { data: any; }) => r.data),

  /** 添加标签 */
  addTag: (customerId: string, tag: string): Promise<{ success: boolean; data: Customer }> =>
    api.post(`/customers/${customerId}/tags`, { tag }).then((r: { data: any; }) => r.data),

  /** 移除标签 */
  removeTag: (customerId: string, tag: string): Promise<{ success: boolean; data: Customer }> =>
    api.delete(`/customers/${customerId}/tags/${tag}`).then((r: { data: any; }) => r.data),

  /** 批量导入客户（CSV 数据数组） */
  importCustomers: (records: Partial<Customer>[]): Promise<{ success: boolean; imported: number }> =>
    api.post('/customers/import', { records }).then((r: { data: any; }) => r.data),
};

export default customerService;
