import React, { useEffect, useState, useRef } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  message,
  Tag,
  Popconfirm,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, LaptopOutlined, CopyOutlined, WifiOutlined } from '@ant-design/icons';
import { Tooltip, Descriptions, Badge } from 'antd';
import { io as ioClient, Socket } from 'socket.io-client';
import { extensionAPI, Extension } from '@/services/extension';
import { useExtensionStore } from '@/store/extensionStore';

const ExtensionManagement: React.FC = () => {
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [softphoneExt, setSoftphoneExt] = useState<Extension | null>(null);
  const ASTERISK_HOST = import.meta.env.VITE_ASTERISK_HOST || window.location.hostname;
  const socketRef = useRef<Socket | null>(null);
  const SOCKET_URL = (typeof window !== 'undefined')
    ? `${window.location.protocol}//${window.location.hostname}:3001`
    : 'http://localhost:3001';

  const {
    extensions,
    setExtensions,
    addExtension,
    updateExtension,
    removeExtension,
    setLoading: setStoreLoading,
  } = useExtensionStore();

  useEffect(() => {
    fetchExtensions();
  }, []);

  // Real-time extension registration status via Socket.io
  useEffect(() => {
    const socket = ioClient(SOCKET_URL, { transports: ['websocket'] });
    socketRef.current = socket;
    socket.on('extension:status', (data: { extensionNumber: string; status: string; registered: boolean }) => {
      const ext = extensions.find(e => e.number === data.extensionNumber);
      if (ext) {
        updateExtension(ext.id, { status: data.status as Extension['status'] });
      }
    });
    return () => { socket.disconnect(); };
  }, [extensions]);

  const fetchExtensions = async () => {
    setStoreLoading(true);
    try {
      const response = await extensionAPI.getList({ limit: 100 });
      setExtensions(response.data.rows ?? (response.data as any));
    } catch (error) {
      message.error('加载分机列表失败');
    } finally {
      setStoreLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingId(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (extension: Extension) => {
    setEditingId(extension.id);
    form.setFieldsValue(extension);
    setModalVisible(true);
  };

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      if (editingId) {
        await extensionAPI.update(editingId, values);
        updateExtension(editingId, values);
        message.success('分机已更新');
      } else {
        const response = await extensionAPI.create(values);
        addExtension(response.data);
        message.success('分机已创建');
      }
      setModalVisible(false);
    } catch (error: any) {
      message.error(error.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await extensionAPI.delete(id);
      removeExtension(id);
      message.success('分机已删除');
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  const columns = [
    { title: '分机号', dataIndex: 'number', key: 'number', width: 100 },
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '类型', dataIndex: 'type', key: 'type', width: 80 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const colors: any = {
          online: 'green',
          offline: 'default',
          busy: 'orange',
          dnd: 'red',
        };
        const labels: any = {
          online: '在线',
          offline: '离线',
          busy: '忙碌',
          dnd: '请勿打扰',
        };
        return (
          <Space size={4}>
            <Badge status={status === 'online' ? 'success' : status === 'busy' ? 'warning' : 'default'} />
            <Tag color={colors[status]}>{labels[status] || status}</Tag>
          </Space>
        );
      },
    },
    {
      title: '最大通话',
      dataIndex: 'maxCalls',
      key: 'maxCalls',
      width: 80,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record: Extension) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Tooltip title="Softphone 配置">
            <Button
              type="text"
              size="small"
              icon={<LaptopOutlined />}
              onClick={() => setSoftphoneExt(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确认删除？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="text" danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '16px' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新建分机
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={extensions}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 20 }}
      />

      {/* Softphone 配置弹窗 */}
      <Modal
        title={`📱 Softphone 配置 — 分机 ${softphoneExt?.number}`}
        open={!!softphoneExt}
        onCancel={() => setSoftphoneExt(null)}
        footer={<Button onClick={() => setSoftphoneExt(null)}>关闭</Button>}
        width={480}
      >
        {softphoneExt && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="SIP 服务器">{ASTERISK_HOST}</Descriptions.Item>
            <Descriptions.Item label="SIP 端口">5060</Descriptions.Item>
            <Descriptions.Item label="用户名 / 分机号">{softphoneExt.number}</Descriptions.Item>
            <Descriptions.Item label="密码">
              <Space>
                <span style={{ fontFamily: 'monospace' }}>{(softphoneExt as any).secret || '******'}</span>
                <Tooltip title="复制">
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => {
                      navigator.clipboard.writeText((softphoneExt as any).secret || '');
                      message.success('已复制');
                    }}
                  />
                </Tooltip>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="域 / Realm">{ASTERISK_HOST}</Descriptions.Item>
            <Descriptions.Item label="传输协议">UDP</Descriptions.Item>
            <Descriptions.Item label="DTMF 模式">RFC 2833</Descriptions.Item>
            <Descriptions.Item label="注册过期（秒）">3600</Descriptions.Item>
            <Descriptions.Item label="编解码">G711u (PCMU) / G711a (PCMA)</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      <Modal
        title={editingId ? '编辑分机' : '新建分机'}
        open={modalVisible}
        onOk={() => form.submit()}
        onCancel={() => setModalVisible(false)}
        loading={loading}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="number"
            label="分机号"
            rules={[{ required: true, message: '请输入分机号' }]}
          >
            <Input placeholder="1001" />
          </Form.Item>

          <Form.Item
            name="name"
            label="分机名称"
            rules={[{ required: true, message: '请输入分机名称' }]}
          >
            <Input placeholder="销售代理" />
          </Form.Item>

          <Form.Item
            name="type"
            label="类型"
            rules={[{ required: true, message: '请选择类型' }]}
          >
            <Select placeholder="选择类型">
              <Select.Option value="SIP">SIP</Select.Option>
              <Select.Option value="IAX2">IAX2</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="maxCalls"
            label="最大并发通话"
            rules={[{ required: true, message: '请输入最大并发通话数' }]}
          >
            <Input type="number" placeholder="5" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ExtensionManagement;
