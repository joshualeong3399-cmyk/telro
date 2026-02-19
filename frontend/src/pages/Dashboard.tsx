import React, { useEffect, useState } from 'react';
import {
  Row,
  Col,
  Card,
  Statistic,
  Table,
  Space,
  Button,
  Tag,
  Spin,
  message,
} from 'antd';
import {
  PhoneOutlined,
  DollarOutlined,
  UserOutlined,
  AudioOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { callAPI } from '@/services/call';
import { extensionAPI } from '@/services/extension';
import { billingAPI } from '@/services/billing';
import { recordingAPI } from '@/services/recording';
import dayjs from 'dayjs';

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeCalls: 0,
    totalExtensions: 0,
    monthlyBilling: 0,
    recordings: 0,
  });
  const [recentCalls, setRecentCalls] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [activeCalls, extensions, billing, recordings] = await Promise.all([
        callAPI.getActiveList(),
        extensionAPI.getList({ limit: 100 }),
        billingAPI.getMonthly({
          year: dayjs().year(),
          month: dayjs().month() + 1,
        }),
        recordingAPI.getList({ limit: 10 }),
      ]);

      const ac = activeCalls.data as any;
      const ex = extensions.data as any;
      const bi = billing.data as any;
      const re = recordings.data as any;
      setStats({
        activeCalls: (ac?.data ?? ac)?.length || 0,
        totalExtensions: (ex?.data ?? ex)?.length || 0,
        monthlyBilling: bi?.total || 0,
        recordings: (re?.data ?? re)?.length || 0,
      });

      setRecentCalls((ac?.data ?? ac) || []);
      generateChartData();
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const generateChartData = () => {
    const data = [];
    for (let i = 30; i >= 0; i--) {
      data.push({
        date: dayjs().subtract(i, 'day').format('MM-DD'),
        calls: Math.floor(Math.random() * 100),
        revenue: Math.floor(Math.random() * 1000),
      });
    }
    setChartData(data);
  };

  const columns = [
    { title: '分机', dataIndex: 'number', key: 'number' },
    { title: '来自', dataIndex: 'fromNumber', key: 'from' },
    { title: '去往', dataIndex: 'toNumber', key: 'to' },
    {
      title: '时长',
      dataIndex: 'duration',
      key: 'duration',
      render: (duration: number) => `${Math.floor(duration / 60)}m`,
    },
    {
      title: '方向',
      dataIndex: 'direction',
      key: 'direction',
      render: (direction: string) => (
        <Tag color={direction === 'inbound' ? 'blue' : 'green'}>
          {direction === 'inbound' ? '呼入' : '呼出'}
        </Tag>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Spin spinning={loading}>
        {/* Statistics Cards */}
        <Row gutter={16} style={{ marginBottom: '24px' }}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="活跃通话"
                value={stats.activeCalls}
                prefix={<PhoneOutlined />}
                valueStyle={{ color: '#667eea' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="分机总数"
                value={stats.totalExtensions}
                prefix={<UserOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="本月消费"
                value={stats.monthlyBilling}
                prefix={<DollarOutlined />}
                suffix="元"
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="录音文件"
                value={stats.recordings}
                prefix={<AudioOutlined />}
                valueStyle={{ color: '#f5222d' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Charts */}
        <Row gutter={16} style={{ marginBottom: '24px' }}>
          <Col xs={24} lg={12}>
            <Card title="近30天通话数">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="calls" stroke="#667eea" />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="近30天收入">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="revenue" fill="#52c41a" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>

        {/* Recent Calls */}
        <Card title="实时通话" extra={<Button type="primary">查看全部</Button>}>
          <Table
            columns={columns}
            dataSource={recentCalls}
            pagination={false}
            rowKey="id"
            size="small"
          />
        </Card>
      </Spin>
    </div>
  );
};

export default Dashboard;
