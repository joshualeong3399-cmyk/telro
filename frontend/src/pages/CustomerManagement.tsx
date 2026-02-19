import React, { useEffect, useState } from 'react';
import {
  Table,
  Card,
  Button,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Select,
  message,
  Tooltip,
  Statistic,
  Row,
  Col,
  Drawer,
  Descriptions,
  DatePicker,
  Popconfirm,
} from 'antd';
import {
  UserAddOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import customerService, { Customer, CustomerFilters } from '@/services/customer';

const { Option } = Select;

const statusColorMap: Record<string, string> = {
  new: 'default',
  contacted: 'blue',
  qualified: 'green',
  lost: 'red',
  converted: 'gold',
};

const statusLabelMap: Record<string, string> = {
  new: '新线索',
  contacted: '已联系',
  qualified: '已确认',
  lost: '已流失',
  converted: '已转化',
};

const CustomerManagement: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const [filters, setFilters] = useState<CustomerFilters>({});
  const [searchPhone, setSearchPhone] = useState('');

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);

  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await customerService.getCustomers(filters, {
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setCustomers(res.rows);
      setTotal(res.count);
    } catch {
      message.error('加载客户列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [page, filters]);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      await customerService.createCustomer(values);
      message.success('客户创建成功');
      setCreateModalOpen(false);
      createForm.resetFields();
      fetchCustomers();
    } catch (e: any) {
      message.error(e.message || '创建失败');
    }
  };

  const handleEditSave = async () => {
    if (!selectedCustomer) return;
    try {
      const values = await editForm.validateFields();
      await customerService.updateCustomer(selectedCustomer.id, values);
      message.success('客户信息更新成功');
      setEditModalOpen(false);
      fetchCustomers();
    } catch (e: any) {
      message.error(e.message || '更新失败');
    }
  };

  const handleDelete = async (customerId: string) => {
    try {
      await customerService.deleteCustomer(customerId);
      message.success('客户已删除');
      fetchCustomers();
    } catch (e: any) {
      message.error(e.message || '删除失败');
    }
  };

  const openEditModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    editForm.setFieldsValue({
      name: customer.name,
      phoneNumber: customer.phoneNumber,
      email: customer.email,
      company: customer.company,
      industry: customer.industry,
      region: customer.region,
      source: customer.source,
      status: customer.status,
      tags: customer.tags,
      notes: customer.notes,
      nextFollowupAt: customer.nextFollowupAt ? dayjs(customer.nextFollowupAt) : null,
    });
    setEditModalOpen(true);
  };

  const openDetail = (customer: Customer) => {
    setSelectedCustomer(customer);
    setDetailDrawerOpen(true);
  };

  // 状态统计
  const newCount = customers.filter((c) => c.status === 'new').length;
  const contactedCount = customers.filter((c) => c.status === 'contacted').length;
  const convertedCount = customers.filter((c) => c.status === 'converted').length;

  const columns: ColumnsType<Customer> = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      render: (v: string, record: Customer) => (
        <span
          style={{ cursor: 'pointer', color: '#1677ff' }}
          onClick={() => openDetail(record)}
        >
          {v || '未知'}
        </span>
      ),
    },
    {
      title: '电话号码',
      dataIndex: 'phoneNumber',
      key: 'phoneNumber',
    },
    {
      title: '公司',
      dataIndex: 'company',
      key: 'company',
      render: (v: string) => v || '—',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={statusColorMap[status]}>{statusLabelMap[status]}</Tag>
      ),
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      render: (v: string) => v || '—',
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) =>
        tags && tags.length > 0
          ? tags.slice(0, 3).map((t) => <Tag key={t}>{t}</Tag>)
          : '—',
    },
    {
      title: '指派坐席',
      key: 'agent',
      render: (_: unknown, record: Customer) =>
        record.assignedAgent?.user?.username ?? '未分配',
    },
    {
      title: '最后联系',
      dataIndex: 'lastContactAt',
      key: 'lastContactAt',
      render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: Customer) => (
        <Space>
          <Tooltip title="编辑">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEditModal(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确定删除该客户？"
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const CustomerFormFields: React.FC = () => (
    <>
      <Form.Item name="name" label="姓名">
        <Input placeholder="客户姓名" />
      </Form.Item>
      <Form.Item
        name="phoneNumber"
        label="电话号码"
        rules={[{ required: true, message: '请输入电话号码' }]}
      >
        <Input placeholder="例：13800138000" />
      </Form.Item>
      <Form.Item name="email" label="邮箱">
        <Input placeholder="客户邮箱" />
      </Form.Item>
      <Form.Item name="company" label="公司">
        <Input placeholder="所在公司" />
      </Form.Item>
      <Form.Item name="industry" label="行业">
        <Input placeholder="所属行业" />
      </Form.Item>
      <Form.Item name="region" label="地区">
        <Input placeholder="所在地区" />
      </Form.Item>
      <Form.Item name="source" label="来源">
        <Select placeholder="选择来源">
          <Option value="ads">广告</Option>
          <Option value="referral">推荐</Option>
          <Option value="cold_call">陌拜</Option>
          <Option value="import">导入</Option>
          <Option value="other">其他</Option>
        </Select>
      </Form.Item>
      <Form.Item name="status" label="状态">
        <Select placeholder="选择状态">
          {Object.entries(statusLabelMap).map(([k, v]) => (
            <Option key={k} value={k}>{v}</Option>
          ))}
        </Select>
      </Form.Item>
      <Form.Item name="tags" label="标签">
        <Select mode="tags" placeholder="输入标签后按 Enter 确认" />
      </Form.Item>
      <Form.Item name="nextFollowupAt" label="下次跟进时间">
        <DatePicker showTime style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="notes" label="备注">
        <Input.TextArea rows={3} placeholder="备注信息" />
      </Form.Item>
    </>
  );

  return (
    <div style={{ padding: 24 }}>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="总客户数" value={total} prefix={<UserAddOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="新线索"
              value={newCount}
              valueStyle={{ color: '#8c8c8c' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已联系"
              value={contactedCount}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已转化"
              value={convertedCount}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="客户管理"
        extra={
          <Space>
            {/* 状态筛选 */}
            <Select
              allowClear
              placeholder="状态筛选"
              style={{ width: 120 }}
              onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
            >
              {Object.entries(statusLabelMap).map(([k, v]) => (
                <Option key={k} value={k}>{v}</Option>
              ))}
            </Select>
            <Button icon={<ReloadOutlined />} onClick={fetchCustomers}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<UserAddOutlined />}
              onClick={() => setCreateModalOpen(true)}
            >
              新增客户
            </Button>
          </Space>
        }
      >
        <Table<Customer>
          columns={columns}
          dataSource={customers}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: setPage,
            showTotal: (t) => `共 ${t} 位客户`,
          }}
        />
      </Card>

      {/* 新建弹窗 */}
      <Modal
        title="新增客户"
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={() => { setCreateModalOpen(false); createForm.resetFields(); }}
        okText="创建"
        cancelText="取消"
        width={600}
      >
        <Form form={createForm} layout="vertical">
          <CustomerFormFields />
        </Form>
      </Modal>

      {/* 编辑弹窗 */}
      <Modal
        title="编辑客户信息"
        open={editModalOpen}
        onOk={handleEditSave}
        onCancel={() => setEditModalOpen(false)}
        okText="保存"
        cancelText="取消"
        width={600}
      >
        <Form form={editForm} layout="vertical">
          <CustomerFormFields />
        </Form>
      </Modal>

      {/* 详情抽屉 */}
      <Drawer
        title="客户详情"
        width={480}
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
      >
        {selectedCustomer && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="ID">{selectedCustomer.id}</Descriptions.Item>
            <Descriptions.Item label="姓名">{selectedCustomer.name || '—'}</Descriptions.Item>
            <Descriptions.Item label="电话">{selectedCustomer.phoneNumber}</Descriptions.Item>
            <Descriptions.Item label="邮箱">{selectedCustomer.email || '—'}</Descriptions.Item>
            <Descriptions.Item label="公司">{selectedCustomer.company || '—'}</Descriptions.Item>
            <Descriptions.Item label="行业">{selectedCustomer.industry || '—'}</Descriptions.Item>
            <Descriptions.Item label="地区">{selectedCustomer.region || '—'}</Descriptions.Item>
            <Descriptions.Item label="来源">{selectedCustomer.source || '—'}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusColorMap[selectedCustomer.status]}>
                {statusLabelMap[selectedCustomer.status]}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="标签">
              {selectedCustomer.tags?.map((t) => <Tag key={t}>{t}</Tag>)}
            </Descriptions.Item>
            <Descriptions.Item label="指派坐席">
              {selectedCustomer.assignedAgent?.user?.username ?? '未分配'}
            </Descriptions.Item>
            <Descriptions.Item label="最后联系">
              {selectedCustomer.lastContactAt
                ? dayjs(selectedCustomer.lastContactAt).format('YYYY-MM-DD HH:mm')
                : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="下次跟进">
              {selectedCustomer.nextFollowupAt
                ? dayjs(selectedCustomer.nextFollowupAt).format('YYYY-MM-DD HH:mm')
                : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="备注">{selectedCustomer.notes || '—'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
};

export default CustomerManagement;
