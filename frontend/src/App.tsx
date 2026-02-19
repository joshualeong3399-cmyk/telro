import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './layouts/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ExtensionManagement from './pages/ExtensionManagement';
import BillingManagement from './pages/BillingManagement';
import RecordingManagement from './pages/RecordingManagement';
import QueueManagement from './pages/QueueManagement';
import CallHistory from './pages/CallHistory';
import AgentManagement from './pages/AgentManagement';
import CustomerManagement from './pages/CustomerManagement';
// 新增页面
import SipTrunkManagement from './pages/SipTrunkManagement';
import InboundRoutes from './pages/InboundRoutes';
import OutboundRoutes from './pages/OutboundRoutes';
import IvrManagement from './pages/IvrManagement';
import TimeConditions from './pages/TimeConditions';
import DncManagement from './pages/DncManagement';
import Wallboard from './pages/Wallboard';
import Reports from './pages/Reports';
import AsteriskManagement from './pages/AsteriskManagement';
// 新功能页面
import RingGroups from './pages/RingGroups';
import ConferenceRooms from './pages/ConferenceRooms';
import Voicemail from './pages/Voicemail';
import CampaignManagement from './pages/CampaignManagement';
import AiFlowBuilder from './pages/AiFlowBuilder';
import AudioFiles from './pages/AudioFiles';
import SMS from './pages/SMS';
import UserManagement from './pages/UserManagement';

dayjs.locale('zh-cn');

const App: React.FC = () => {
  return (
    <ConfigProvider locale={zhCN}>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/extensions" element={<ExtensionManagement />} />
                    <Route path="/agents" element={<AgentManagement />} />
                    <Route path="/customers" element={<CustomerManagement />} />
                    <Route path="/billing" element={<BillingManagement />} />
                    <Route path="/recordings" element={<RecordingManagement />} />
                    <Route path="/queue" element={<QueueManagement />} />
                    <Route path="/calls" element={<CallHistory />} />
                    {/* 新增路由 */}
                    <Route path="/sip-trunks" element={<SipTrunkManagement />} />
                    <Route path="/inbound-routes" element={<InboundRoutes />} />
                    <Route path="/outbound-routes" element={<OutboundRoutes />} />
                    <Route path="/ivr" element={<IvrManagement />} />
                    <Route path="/time-conditions" element={<TimeConditions />} />
                    <Route path="/dnc" element={<DncManagement />} />
                    <Route path="/wallboard" element={<Wallboard />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/asterisk" element={<AsteriskManagement />} />
                    {/* 新功能路由 */}
                    <Route path="/ring-groups" element={<RingGroups />} />
                    <Route path="/conference" element={<ConferenceRooms />} />
                    <Route path="/voicemail" element={<Voicemail />} />
                    <Route path="/campaigns" element={<CampaignManagement />} />
                    <Route path="/ai-flows" element={<AiFlowBuilder />} />
                    <Route path="/audio-files" element={<AudioFiles />} />
                    <Route path="/sms" element={<SMS />} />
                    <Route path="/users" element={<UserManagement />} />
                    <Route path="/" element={<Navigate to="/dashboard" />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </ConfigProvider>
  );
};

export default App;
