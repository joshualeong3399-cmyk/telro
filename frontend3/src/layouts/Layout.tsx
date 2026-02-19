import React, { ReactNode } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Button, Drawer, Badge } from 'antd';
import {
  DashboardOutlined,
  PhoneOutlined,
  DollarOutlined,
  AudioOutlined,
  TeamOutlined,
  HistoryOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BellOutlined,
  CustomerServiceOutlined,
  ContactsOutlined,
  CloudServerOutlined,
  SwapOutlined,
  SoundOutlined,
  ClockCircleOutlined,
  StopOutlined,
  FundOutlined,
  EyeOutlined,
  SettingOutlined,
  ApiOutlined,
  RocketOutlined,
  RobotOutlined,
  UsergroupAddOutlined,
  VideoCameraOutlined,
  InboxOutlined,
  MessageOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import Cookie from 'js-cookie';
import CampaignQueueAlert from '@/components/CampaignQueueAlert';
import './Layout.css';

const { Header, Sider, Content } = Layout;

interface LayoutProps {
  children: ReactNode;
}

const LayoutComponent: React.FC<LayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = React.useState(false);
  const [notificationVisible, setNotificationVisible] = React.useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const role = user?.role ?? 'employee';
  const isOperatorOrAbove = role === 'admin' || role === 'operator';
  const isMerchantOrAbove = isOperatorOrAbove || role === 'merchant';

  const handleLogout = () => {
    logout();
    Cookie.remove('token');
    navigate('/login');
  };

  const menuItems = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: '仪表板' },
    // 实时监控
    { key: '/wallboard', icon: <EyeOutlined />, label: '实时监控大屏' },
    // 拨出业务 — merchant+
    ...(isMerchantOrAbove ? [{
      key: 'outbound-group',
      icon: <PhoneOutlined />,
      label: '拨出业务',
      children: [
        { key: '/agents', icon: <CustomerServiceOutlined />, label: '坐席管理' },
        { key: '/customers', icon: <ContactsOutlined />, label: '客户管理' },
        { key: '/campaigns', icon: <RocketOutlined />, label: '群呼管理' },
        { key: '/queue', icon: <TeamOutlined />, label: '队列管理' },
        { key: '/dnc', icon: <StopOutlined />, label: 'DNC 黑名单' },
      ],
    }] : []),
    // 路由设置 — operator+
    ...(isOperatorOrAbove ? [{
      key: 'routing-group',
      icon: <SwapOutlined />,
      label: '路由设置',
      children: [
        { key: '/sip-trunks', icon: <CloudServerOutlined />, label: 'SIP 中继' },
        { key: '/inbound-routes', icon: <SwapOutlined />, label: '入站路由' },
        { key: '/outbound-routes', icon: <SwapOutlined />, label: '出站路由' },
        { key: '/ivr', icon: <SoundOutlined />, label: 'IVR 语音菜单' },
        { key: '/time-conditions', icon: <ClockCircleOutlined />, label: '时间条件' },
      ],
    }] : []),
    // 分机与历史 — all, children filtered by role
    {
      key: 'pbx-group',
      icon: <SettingOutlined />,
      label: 'PBX 管理',
      children: [
        { key: '/extensions', icon: <PhoneOutlined />, label: '分机管理' },
        ...(isMerchantOrAbove ? [
          { key: '/ring-groups', icon: <UsergroupAddOutlined />, label: '振铃组' },
          { key: '/conference', icon: <VideoCameraOutlined />, label: '会议室' },
        ] : []),
        { key: '/voicemail', icon: <InboxOutlined />, label: '语音信箱' },
        { key: '/calls', icon: <HistoryOutlined />, label: '通话记录' },
        { key: '/recordings', icon: <AudioOutlined />, label: '录音管理' },
        ...(isMerchantOrAbove ? [
          { key: '/billing', icon: <DollarOutlined />, label: '计费管理' },
        ] : []),
        ...(isOperatorOrAbove ? [
          { key: '/asterisk', icon: <ApiOutlined />, label: 'Asterisk 同步' },
        ] : []),
      ],
    },
    // AI管理 — merchant+
    ...(isMerchantOrAbove ? [{
      key: 'ai-group',
      icon: <RobotOutlined />,
      label: 'AI 管理',
      children: [
        { key: '/ai-flows', icon: <RobotOutlined />, label: 'AI 流程' },
        { key: '/audio-files', icon: <SoundOutlined />, label: '音频文件' },
      ],
    }] : []),
    // 报表 — merchant+
    ...(isMerchantOrAbove ? [
      { key: '/reports', icon: <FundOutlined />, label: '报表分析' },
    ] : []),
    // 短信 — all
    { key: '/sms', icon: <MessageOutlined />, label: '短信中心' },
    // 系统管理 — admin only
    ...(role === 'admin' ? [{
      key: 'system-group',
      icon: <SafetyOutlined />,
      label: '系统管理',
      children: [
        { key: '/users', icon: <UserOutlined />, label: '用户管理' },
      ],
    }] : []),
  ];

  const userMenu = [
    {
      key: 'profile',
      label: '个人资料',
    },
    {
      key: 'settings',
      label: '系统设置',
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        className="layout-sider"
      >
        <div className="logo">
          <PhoneOutlined className="logo-icon" />
          {!collapsed && <span className="logo-text">Telro</span>}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>

      <Layout>
        <Header className="layout-header">
          <div className="header-left">
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: '16px', width: 64, height: 64 }}
            />
          </div>

          <div className="header-right">
            <Space>
              <Button
                type="text"
                icon={<Badge count={3} style={{ backgroundColor: '#ff7a45' }} />}
                onClick={() => setNotificationVisible(true)}
              >
                <BellOutlined />
              </Button>

              <Dropdown menu={{ items: userMenu }} placement="bottomRight">
                <Space style={{ cursor: 'pointer' }}>
                  <Avatar icon={<UserOutlined />} />
                  <span>{user?.username}</span>
                </Space>
              </Dropdown>
            </Space>
          </div>
        </Header>

        <Content className="layout-content">{children}</Content>
      </Layout>

      {/* Campaign queue incoming call alert — always mounted when logged in */}
      <CampaignQueueAlert />

      <Drawer
        title="通知"
        placement="right"
        onClose={() => setNotificationVisible(false)}
        open={notificationVisible}
      >
        <div>
          <p>🔔 您有3条新通知</p>
          <ul>
            <li>分机1001上线</li>
            <li>群呼任务完成: 95/100</li>
            <li>本月消费超预算10%</li>
          </ul>
        </div>
      </Drawer>
    </Layout>
  );
};

export default LayoutComponent;
