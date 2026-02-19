import { useNavigate, useLocation } from 'react-router-dom'
import {
  Layout,
  Menu,
  Avatar,
  Dropdown,
  Button,
  Badge,
  Tooltip,
  Tag,
  theme,
} from 'antd'
import {
  DashboardOutlined,
  DesktopOutlined,
  PhoneOutlined,
  AudioOutlined,
  MailOutlined,
  MessageOutlined,
  TeamOutlined,
  UserOutlined,
  UsergroupAddOutlined,
  SoundOutlined,
  RobotOutlined,
  ApartmentOutlined,
  ApiOutlined,
  BranchesOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  BarChartOutlined,
  SettingOutlined,
  BellOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  CustomerServiceOutlined,
  StopOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons'
import { useState, useMemo, useEffect } from 'react'
import type { MenuProps } from 'antd'
import { useAuthStore } from '@/store/authStore'
import { ROLE_LABELS } from '@/types/auth'
import type { UserRole } from '@/types/auth'
import { socketService } from '@/services/socket'
import CampaignQueueAlert from '@/components/CampaignQueueAlert'
import './MainLayout.css'

const { Header, Sider, Content } = Layout

// ── 菜单构建（根据角色过滤） ────────────────────────────────────────────────
function buildMenuItems(role: string): MenuProps['items'] {
  const isOperatorOrAbove = role === 'admin' || role === 'operator'
  const isMerchantOrAbove = isOperatorOrAbove || role === 'merchant'

  // 所有角色可见
  const commonItems: MenuProps['items'] = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '仪表板',
    },
    {
      key: '/wallboard',
      icon: <DesktopOutlined />,
      label: '实时监控大屏',
    },
    {
      key: '/extensions',
      icon: <CustomerServiceOutlined />,
      label: '分机管理',
    },
    {
      key: '/calls',
      icon: <PhoneOutlined />,
      label: '通话记录',
    },
    {
      key: '/recordings',
      icon: <AudioOutlined />,
      label: '录音管理',
    },
    {
      key: '/voicemail',
      icon: <MailOutlined />,
      label: '语音信箱',
    },
    {
      key: '/sms',
      icon: <MessageOutlined />,
      label: '短信中心',
    },
  ]

  // Merchant 及以上
  const merchantItems: MenuProps['items'] = isMerchantOrAbove
    ? [
        {
          key: 'outbound-group',
          icon: <PhoneOutlined />,
          label: '拨出业务',
          children: [
            { key: '/agents', icon: <TeamOutlined />, label: '坐席管理' },
            { key: '/customers', icon: <UsergroupAddOutlined />, label: '客户管理' },
            { key: '/campaigns', icon: <SoundOutlined />, label: '群呼活动' },
            { key: '/queues', icon: <ApartmentOutlined />, label: '呼叫队列' },
            { key: '/dnc', icon: <StopOutlined />, label: 'DNC 名单' },
          ],
        },
        {
          key: '/ring-groups',
          icon: <TeamOutlined />,
          label: '振铃组',
        },
        {
          key: '/conference',
          icon: <VideoCameraOutlined />,
          label: '会议室',
        },
        {
          key: '/billing',
          icon: <DollarOutlined />,
          label: '计费管理',
        },
        {
          key: 'ai-group',
          icon: <RobotOutlined />,
          label: 'AI 管理',
          children: [
            { key: '/ai-flows', icon: <BranchesOutlined />, label: 'AI 流程' },
            { key: '/audio-files', icon: <SoundOutlined />, label: '音频文件' },
          ],
        },
        {
          key: '/reports',
          icon: <BarChartOutlined />,
          label: '报表分析',
        },
      ]
    : []

  // Operator 及以上
  const operatorItems: MenuProps['items'] = isOperatorOrAbove
    ? [
        {
          key: 'routing-group',
          icon: <ApiOutlined />,
          label: '路由设置',
          children: [
            { key: '/sip-trunks', icon: <ApiOutlined />, label: 'SIP 中继' },
            { key: '/inbound-routes', icon: <PhoneOutlined />, label: '入站路由' },
            { key: '/outbound-routes', icon: <PhoneOutlined />, label: '出站路由' },
            { key: '/ivr', icon: <BranchesOutlined />, label: 'IVR 菜单' },
            { key: '/time-conditions', icon: <ClockCircleOutlined />, label: '时间条件' },
          ],
        },
        {
          key: '/asterisk',
          icon: <SettingOutlined />,
          label: 'Asterisk 同步',
        },
      ]
    : []

  // Admin only
  const adminItems: MenuProps['items'] =
    role === 'admin'
      ? [
          {
            key: 'system-group',
            icon: <SettingOutlined />,
            label: '系统管理',
            children: [
              { key: '/users', icon: <UserOutlined />, label: '用户管理' },
            ],
          },
        ]
      : []

  return [...commonItems, ...merchantItems, ...operatorItems, ...adminItems]
}

// ── 主布局组件 ───────────────────────────────────────────────────────────────
interface MainLayoutProps {
  children?: React.ReactNode
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()

  const role = user?.role ?? 'employee'

  // Socket 连接生命周期（登录后建立，组件卸载时断开）
  useEffect(() => {
    socketService.connect()
    return () => { socketService.disconnect() }
  }, [])

  // 根据角色动态构建菜单（useMemo 避免重复计算）
  const menuItems = useMemo(() => buildMenuItems(role), [role])

  // 从当前路径推断选中的菜单项
  const selectedKeys = [location.pathname]

  // 推断默认展开的子菜单
  const defaultOpenKeys = useMemo(() => {
    const openKeyMap: Record<string, string> = {
      '/agents': 'outbound-group',
      '/customers': 'outbound-group',
      '/campaigns': 'outbound-group',
      '/queues': 'outbound-group',
      '/dnc': 'outbound-group',
      '/ai-flows': 'ai-group',
      '/audio-files': 'ai-group',
      '/sip-trunks': 'routing-group',
      '/inbound-routes': 'routing-group',
      '/outbound-routes': 'routing-group',
      '/ivr': 'routing-group',
      '/time-conditions': 'routing-group',
      '/users': 'system-group',
    }
    const key = openKeyMap[location.pathname]
    return key ? [key] : []
  }, [location.pathname])

  // 用户下拉菜单
  const userDropdownItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息',
      onClick: () => navigate('/profile'),
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
      onClick: () => {
        logout()
        navigate('/login')
      },
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* ── 侧边栏 ── */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={220}
        theme="dark"
        style={{ overflow: 'auto', height: '100vh', position: 'sticky', top: 0, left: 0 }}
      >
        {/* Logo */}
        <div className={`layout-logo ${collapsed ? 'layout-logo--collapsed' : ''}`}>
          <div className="layout-logo__icon">
            <CustomerServiceOutlined />
          </div>
          {!collapsed && <span className="layout-logo__text">Telro 呼叫中心</span>}
        </div>

        {/* 导航菜单 */}
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selectedKeys}
          defaultOpenKeys={defaultOpenKeys}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0 }}
        />
      </Sider>

      {/* ── 右侧主体 ── */}
      <Layout style={{ transition: 'all 0.2s' }}>
        {/* 顶栏 */}
        <Header
          className="layout-header"
          style={{ background: colorBgContainer }}
        >
          {/* 左侧：折叠按钮 */}
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            className="layout-header__collapse-btn"
          />

          {/* 右侧：通知 + 用户 */}
          <div className="layout-header__right">
            {/* 通知铃铛 */}
            <Tooltip title="通知">
              <Badge count={0} showZero={false}>
                <Button
                  type="text"
                  icon={<BellOutlined style={{ fontSize: 18 }} />}
                  className="layout-header__icon-btn"
                />
              </Badge>
            </Tooltip>

            {/* 用户头像下拉 */}
            <Dropdown
              menu={{ items: userDropdownItems }}
              placement="bottomRight"
              trigger={['click']}
            >
              <div className="layout-header__user">
                <Avatar
                  icon={<UserOutlined />}
                  style={{ backgroundColor: '#1677ff', cursor: 'pointer' }}
                  size={34}
                />
                <div className="layout-header__user-info">
                  <span className="layout-header__username">
                    {user?.displayName ?? user?.username ?? '用户'}
                  </span>
                  <Tag
                    color="blue"
                    style={{ marginLeft: 4, fontSize: 11, lineHeight: '16px', padding: '0 4px' }}
                  >
                    {ROLE_LABELS[role as UserRole] ?? role}
                  </Tag>
                </div>
              </div>
            </Dropdown>
          </div>
        </Header>

        {/* 内容区 */}
        <Content
          style={{
            margin: '16px',
            padding: 24,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
            overflow: 'auto',
            minHeight: 'calc(100vh - 64px - 32px)',
          }}
        >
          {children}
        </Content>
      </Layout>
      {/* 全局来电弹窗（所有已登录页面生效） */}
      <CampaignQueueAlert />
    </Layout>
  )
}

export default MainLayout
