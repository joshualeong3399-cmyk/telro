import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, Spin } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'

import MainLayout from '@/layouts/MainLayout'
import ProtectedRoute from '@/components/ProtectedRoute'
import Login from '@/pages/Login'

// ── 懒加载所有页面（代码分割） ────────────────────────────────────────────────
const Dashboard          = lazy(() => import('@/pages/Dashboard'))
const Wallboard          = lazy(() => import('@/pages/Wallboard'))
const AgentManagement    = lazy(() => import('@/pages/AgentManagement'))
const CustomerManagement = lazy(() => import('@/pages/CustomerManagement'))
const ExtensionManagement= lazy(() => import('@/pages/ExtensionManagement'))
const CallHistory        = lazy(() => import('@/pages/CallHistory'))
const RecordingManagement= lazy(() => import('@/pages/RecordingManagement'))
const BillingManagement  = lazy(() => import('@/pages/BillingManagement'))
const AiFlowBuilder      = lazy(() => import('@/pages/AiFlowBuilder'))
const CampaignManagement = lazy(() => import('@/pages/CampaignManagement'))
const QueueManagement    = lazy(() => import('@/pages/QueueManagement'))
const DncManagement      = lazy(() => import('@/pages/DncManagement'))
const SipTrunkManagement = lazy(() => import('@/pages/SipTrunkManagement'))
const InboundRoutes      = lazy(() => import('@/pages/InboundRoutes'))
const OutboundRoutes     = lazy(() => import('@/pages/OutboundRoutes'))
const IvrManagement      = lazy(() => import('@/pages/IvrManagement'))
const TimeConditions     = lazy(() => import('@/pages/TimeConditions'))
const RingGroups         = lazy(() => import('@/pages/RingGroups'))
const ConferenceRooms    = lazy(() => import('@/pages/ConferenceRooms'))
const VoicemailPage      = lazy(() => import('@/pages/Voicemail'))
const AsteriskManagement = lazy(() => import('@/pages/AsteriskManagement'))
const AudioFiles         = lazy(() => import('@/pages/AudioFiles'))
const Reports            = lazy(() => import('@/pages/Reports'))
const SmsCenter          = lazy(() => import('@/pages/SmsCenter'))
const UserManagement     = lazy(() => import('@/pages/UserManagement'))
const Profile            = lazy(() => import('@/pages/Profile'))

dayjs.locale('zh-cn')

function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
        },
      }}
    >
      <Router>
        <Routes>
          {/* 公开路由 */}
          <Route path="/login" element={<Login />} />

          {/* 受保护路由：所有已登录页面共享 MainLayout */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Suspense fallback={<div style={{ display:'flex', justifyContent:'center', paddingTop:120 }}><Spin size="large" /></div>}>
                  <Routes>
                    {/* ── 默认重定向 ── */}
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />

                    {/* ── 公共页面（所有角色） ── */}
                    <Route path="/dashboard"     element={<Dashboard />} />
                    <Route path="/wallboard"     element={<Wallboard />} />
                    <Route path="/extensions"    element={<ExtensionManagement />} />
                    <Route path="/calls"         element={<CallHistory />} />
                    <Route path="/recordings"    element={<RecordingManagement />} />
                    <Route path="/voicemail"     element={<VoicemailPage />} />
                    <Route path="/sms"           element={<SmsCenter />} />

                    {/* ── 拨出业务（Merchant 及以上） ── */}
                    <Route path="/agents"        element={<AgentManagement />} />
                    <Route path="/customers"     element={<CustomerManagement />} />
                    <Route path="/campaigns"     element={<CampaignManagement />} />
                    <Route path="/queues"        element={<QueueManagement />} />
                    <Route path="/dnc"           element={<DncManagement />} />
                    <Route path="/ring-groups"   element={<RingGroups />} />
                    <Route path="/conference"    element={<ConferenceRooms />} />
                    <Route path="/billing"       element={<BillingManagement />} />
                    <Route path="/ai-flows"      element={<AiFlowBuilder />} />
                    <Route path="/audio-files"   element={<AudioFiles />} />
                    <Route path="/reports"       element={<Reports />} />

                    {/* ── 路由设置（Operator 及以上） ── */}
                    <Route path="/sip-trunks"      element={<SipTrunkManagement />} />
                    <Route path="/inbound-routes"  element={<InboundRoutes />} />
                    <Route path="/outbound-routes" element={<OutboundRoutes />} />
                    <Route path="/ivr"             element={<IvrManagement />} />
                    <Route path="/time-conditions" element={<TimeConditions />} />
                    <Route path="/asterisk"        element={<AsteriskManagement />} />

                    {/* ── 系统管理（Admin） ── */}
                    <Route path="/users"   element={<UserManagement />} />
                    <Route path="/profile" element={<Profile />} />
                  </Routes>
                  </Suspense>
                </MainLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </ConfigProvider>
  )
}

export default App
