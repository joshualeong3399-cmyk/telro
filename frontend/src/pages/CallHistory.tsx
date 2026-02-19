import React, { useEffect, useState } from 'react';
import {
  Table,
  Card,
  Space,
  Button,
  Input,
  DatePicker,
  Select,
  message,
  Tag,
  Drawer,
  Descriptions,
} from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { callAPI, CallRecord } from '@/services/call';
import dayjs from 'dayjs';

const CallHistory: React.FC = () => {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [filters, setFilters] = useState({
    status: undefined,
    extensionId: undefined,
  });

  useEffect(() => {
    fetchCallHistory();
  }, []);

  const fetchCallHistory = async () => {
    setLoading(true);
    try {
      const response = await callAPI.getRecords({
        limit: 100,
        ...filters,
      });
      setCalls(response.data.data ?? (response.data as any));
    } catch (error) {
      message.error('加载通话记录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = (call: CallRecord) => {
    setSelectedCall(call);
    setDrawerVisible(true);
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status as string);
    const url = `/api/calls/export/csv?${params.toString()}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `calls-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const columns = [
    {
      title: '通话时间',
      dataIndex: 'startTime',
      key: 'startTime',
      width: 160,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    { title: '分机', dataIndex: 'extensionId', key: 'extension', width: 80 },
    { title: '来自', dataIndex: 'fromNumber', key: 'from', width: 120 },
    { title: '去往', dataIndex: 'toNumber', key: 'to', width: 120 },
    {
      title: '时长',
      dataIndex: 'duration',
      key: 'duration',
      width: 80,
      render: (duration: number) => `${Math.floor(duration / 60)}m${duration % 60}s`,
    },
    {
      title: '通话时长',
      dataIndex: 'talkTime',
      key: 'talkTime',
      width: 100,
      render: (talkTime: number) => `${Math.floor(talkTime / 60)}m`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => {
        const colors: any = { active: 'processing', completed: 'success', failed: 'error' };
        const labels: any = { active: '进行中', completed: '已完成', failed: '失败' };
        return <Tag color={colors[status]}>{labels[status]}</Tag>;
      },
    },
    {
      title: '费用',
      dataIndex: 'cost',
      key: 'cost',
      width: 80,
      render: (cost: number) => `¥${cost.toFixed(2)}`,
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record: CallRecord) => (
        <Button type="link" size="small" onClick={() => handleViewDetail(record)}>
          详情
        </Button>
      ),
    },
  ];

  const filteredCalls = calls.filter((call) => {
    if (filters.status && call.status !== filters.status) return false;
    if (filters.extensionId && call.extensionId !== filters.extensionId) return false;
    return true;
  });

  return (
    <div style={{ padding: '24px' }}>
      <Card style={{ marginBottom: '16px' }}>
        <Space wrap>
          <span>状态:</span>
          <Select
            placeholder="选择状态"
            style={{ width: 150 }}
            allowClear
            onChange={(value) => setFilters({ ...filters, status: value })}
          >
            <Select.Option value="active">进行中</Select.Option>
            <Select.Option value="completed">已完成</Select.Option>
            <Select.Option value="failed">失败</Select.Option>
          </Select>

          <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>
            导出
          </Button>
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={filteredCalls}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 20 }}
        scroll={{ x: 1400 }}
      />

      <Drawer
        title="通话详情"
        placement="right"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        width={600}
      >
        {selectedCall && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="分机号">
              {selectedCall.extensionId}
            </Descriptions.Item>
            <Descriptions.Item label="来自号码">
              {selectedCall.fromNumber}
            </Descriptions.Item>
            <Descriptions.Item label="去往号码">
              {selectedCall.toNumber}
            </Descriptions.Item>
            <Descriptions.Item label="开始时间">
              {dayjs(selectedCall.startTime).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="结束时间">
              {dayjs(selectedCall.endTime).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="总时长">
              {Math.floor(selectedCall.duration / 60)}m {selectedCall.duration % 60}s
            </Descriptions.Item>
            <Descriptions.Item label="通话时长">
              {Math.floor(selectedCall.talkTime / 60)}m {selectedCall.talkTime % 60}s
            </Descriptions.Item>
            <Descriptions.Item label="铃响时长">
              {Math.floor(selectedCall.ringTime / 60)}m
            </Descriptions.Item>
            <Descriptions.Item label="费用">
              ¥{selectedCall.cost.toFixed(2)}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag>{selectedCall.status}</Tag>
            </Descriptions.Item>
            {selectedCall.hangupCause && (
              <Descriptions.Item label="挂机原因">
                {selectedCall.hangupCause}
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
};

export default CallHistory;
