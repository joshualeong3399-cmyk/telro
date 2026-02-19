import React, { useEffect, useState, useMemo } from 'react';
import {
  Table,
  Card,
  Select,
  DatePicker,
  Space,
  Statistic,
  Row,
  Col,
  Button,
  message,
  Tag,
  Tabs,
  Typography,
  Alert,
} from 'antd';
import {
  DownloadOutlined,
  PhoneOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import { billingAPI } from '@/services/billing';
import dayjs from 'dayjs';

const { Text } = Typography;

const BillingManagement: React.FC = () => {
  const [month, setMonth] = useState(dayjs());
  const [billingData, setBillingData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState('stats');

  useEffect(() => {
    fetchBillingData();
  }, [month]);

  const fetchBillingData = async () => {
    setLoading(true);
    try {
      const response = await billingAPI.getMonthly({
        year: month.year(),
        month: month.month() + 1,
      });
      setBillingData(response.data ?? response);
    } catch (error) {
      message.error('加载账单数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await billingAPI.exportReport({
        year: month.year(),
        month: month.month() + 1,
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `billing-${month.format('YYYY-MM')}.xlsx`);
      document.body.appendChild(link);
      link.click();
    } catch (error) {
      message.error('导出失败');
    }
  };

  const BILLING_TYPE_LABELS: Record<string, string> = {
    extension: '分机通话', trunk: 'SIP中继', internal: '内线',
    'campaign-outbound': '群呼拨出', 'campaign-inbound': '坐席接入',
  };
  const BILLING_TYPE_COLORS: Record<string, string> = {
    extension: 'blue', trunk: 'purple', internal: 'default',
    'campaign-outbound': 'orange', 'campaign-inbound': 'green',
  };

  // ── 统计汇总 ─────────────────────────────────────────────────────────────────
  const summaryStats = useMemo(() => {
    const records: any[] = billingData?.records || [];
    const totalDials = records.length;
    const connected = records.filter((r: any) => (r.duration ?? 0) > 0).length;
    const totalSeconds = records.reduce((acc: number, r: any) => acc + (r.duration ?? 0), 0);
    const totalMinutes = Math.ceil(totalSeconds / 60);
    const totalCost = records.reduce((acc: number, r: any) => acc + (Number(r.totalCost) || Number(r.amount) || 0), 0);
    return { totalDials, connected, totalMinutes, totalCost };
  }, [billingData]);

  // ── 按日期分组 (拨打统计 tab) ─────────────────────────────────────────────────
  const dailyStats = useMemo(() => {
    const records: any[] = billingData?.records || [];
    const grouped: Record<string, { date: string; dials: number; connected: number; seconds: number; cost: number }> = {};
    records.forEach((r: any) => {
      const date = r.billingDate ? dayjs(r.billingDate).format('YYYY-MM-DD') : r.date ?? '未知';
      if (!grouped[date]) grouped[date] = { date, dials: 0, connected: 0, seconds: 0, cost: 0 };
      grouped[date].dials += 1;
      if ((r.duration ?? 0) > 0) grouped[date].connected += 1;
      grouped[date].seconds += r.duration ?? 0;
      grouped[date].cost += Number(r.totalCost) || Number(r.amount) || 0;
    });
    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
  }, [billingData]);

  // ── 列定义 ───────────────────────────────────────────────────────────────────
  const dailyColumns = [
    { title: '拨打日期', dataIndex: 'date', key: 'date', width: 120 },
    { title: '拨打次数', dataIndex: 'dials', key: 'dials', width: 100,
      render: (v: number) => <Text strong>{v}</Text> },
    { title: '接通次数', dataIndex: 'connected', key: 'connected', width: 100,
      render: (v: number, row: any) => (
        <Space>
          <Text style={{ color: '#52c41a' }}>{v}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            ({row.dials > 0 ? Math.round(v / row.dials * 100) : 0}%)
          </Text>
        </Space>
      ),
    },
    { title: '通话时长', dataIndex: 'seconds', key: 'seconds', width: 120,
      render: (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return <Text>{m > 0 ? `${m}分${sec}秒` : `${sec}秒`}</Text>;
      },
    },
    { title: '计费费用', dataIndex: 'cost', key: 'cost', width: 100,
      render: (v: number) => <Text style={{ color: '#ff7a45' }}>¥{v.toFixed(4)}</Text> },
  ];

  const detailColumns = [
    { title: '日期', key: 'date', width: 120,
      render: (_: any, r: any) => r.billingDate ? dayjs(r.billingDate).format('MM-DD HH:mm') : (r.date ?? '-') },
    { title: '分机', dataIndex: 'extensionId', key: 'extension', width: 100,
      render: (v: string) => v ? <Tag>{v}</Tag> : '-' },
    {
      title: '计费类型', dataIndex: 'billingType', key: 'billingType', width: 130,
      render: (v: string) => v
        ? <Tag color={BILLING_TYPE_COLORS[v] || 'default'}>{BILLING_TYPE_LABELS[v] || v}</Tag>
        : '-',
    },
    {
      title: '计费腿', dataIndex: 'leg', key: 'leg', width: 80,
      render: (v: string) => v === 'outbound' ? <Tag color="orange">拨出腿</Tag>
        : v === 'inbound' ? <Tag color="green">坐席腿</Tag> : '-',
    },
    { title: '时长(秒)', dataIndex: 'duration', key: 'duration', width: 80 },
    { title: '单价/分', dataIndex: 'ratePerMinute', key: 'rate', width: 90,
      render: (v: any, r: any) => {
        const rate = v ?? r.rate;
        return rate != null ? `¥${Number(rate).toFixed(4)}` : '-';
      },
    },
    {
      title: '费用',
      key: 'amount',
      width: 90,
      render: (_: any, r: any) => {
        const amt = r.totalCost ?? r.amount;
        return amt != null ? <Text style={{ color: '#ff7a45' }}>¥{Number(amt).toFixed(4)}</Text> : '-';
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => {
        const colors: any = { pending: 'orange', invoiced: 'blue', paid: 'green' };
        const labels: any = { pending: '待审核', invoiced: '已开票', paid: '已支付' };
        return <Tag color={colors[status]}>{labels[status] || status}</Tag>;
      },
    },
  ];

  const filteredRecords = useMemo(() => {
    const records: any[] = billingData?.records || [];
    return typeFilter ? records.filter((r: any) => r.billingType === typeFilter) : records;
  }, [billingData, typeFilter]);

  return (
    <div style={{ padding: '24px' }}>
      {/* 顶部工具栏 */}
      <Space style={{ marginBottom: 16 }} wrap>
        <span>选择月份:</span>
        <DatePicker
          picker="month"
          value={month}
          onChange={(date) => setMonth(date!)}
        />
        <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>
          导出报表
        </Button>
      </Space>

      {/* 统计卡片 — 仿 Telerobot 拨打统计顶部 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="本月拨打"
              value={summaryStats.totalDials}
              prefix={<PhoneOutlined style={{ color: '#1677ff' }} />}
              suffix="次"
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="接通次数"
              value={summaryStats.connected}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              suffix="次"
            />
            {summaryStats.totalDials > 0 && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                接通率 {Math.round(summaryStats.connected / summaryStats.totalDials * 100)}%
              </Text>
            )}
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="通话时长"
              value={summaryStats.totalMinutes}
              prefix={<ClockCircleOutlined style={{ color: '#722ed1' }} />}
              suffix="分钟"
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="本月消费"
              value={summaryStats.totalCost}
              precision={4}
              prefix={<DollarOutlined style={{ color: '#ff7a45' }} />}
              suffix="元"
            />
          </Card>
        </Col>
      </Row>

      {/* 主内容 Tabs */}
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'stats',
              label: '拨打统计',
              children: (
                <Table
                  columns={dailyColumns}
                  dataSource={dailyStats}
                  loading={loading}
                  rowKey="date"
                  pagination={{ pageSize: 31 }}
                  locale={{ emptyText: '暂无本月拨打记录' }}
                  summary={(data) => {
                    if (!data.length) return null;
                    const totDials = data.reduce((a, d) => a + d.dials, 0);
                    const totConn = data.reduce((a, d) => a + d.connected, 0);
                    const totSec = data.reduce((a, d) => a + d.seconds, 0);
                    const totCost = data.reduce((a, d) => a + d.cost, 0);
                    const m = Math.floor(totSec / 60);
                    const s = totSec % 60;
                    return (
                      <Table.Summary fixed>
                        <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 600 }}>
                          <Table.Summary.Cell index={0}>合计</Table.Summary.Cell>
                          <Table.Summary.Cell index={1}>{totDials}</Table.Summary.Cell>
                          <Table.Summary.Cell index={2}>
                            {totConn}
                            {totDials > 0 && <Text type="secondary" style={{ fontSize: 12 }}> ({Math.round(totConn / totDials * 100)}%)</Text>}
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={3}>{m > 0 ? `${m}分${s}秒` : `${s}秒`}</Table.Summary.Cell>
                          <Table.Summary.Cell index={4}>
                            <Text style={{ color: '#ff7a45' }}>¥{totCost.toFixed(4)}</Text>
                          </Table.Summary.Cell>
                        </Table.Summary.Row>
                      </Table.Summary>
                    );
                  }}
                />
              ),
            },
            {
              key: 'detail',
              label: '账单明细',
              children: (
                <>
                  <Space style={{ marginBottom: 12 }}>
                    <span>计费类型:</span>
                    <Select
                      allowClear
                      placeholder="全部类型"
                      style={{ width: 160 }}
                      value={typeFilter}
                      onChange={setTypeFilter}
                    >
                      <Select.Option value="extension">分机通话</Select.Option>
                      <Select.Option value="trunk">SIP中继</Select.Option>
                      <Select.Option value="internal">内线</Select.Option>
                      <Select.Option value="campaign-outbound">群呼拨出腿</Select.Option>
                      <Select.Option value="campaign-inbound">坐席接入腿</Select.Option>
                    </Select>
                  </Space>
                  <Table
                    columns={detailColumns}
                    dataSource={filteredRecords}
                    loading={loading}
                    rowKey="id"
                    pagination={{ pageSize: 20 }}
                    scroll={{ x: 900 }}
                    locale={{ emptyText: '暂无账单记录' }}
                  />
                </>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default BillingManagement;
