/**
 * CampaignQueueAlert.tsx
 * Shows a floating notification when a campaign call is waiting in the agent queue.
 * Any logged-in agent can: Accept (answer), Reject (pass), or Transfer (to extension).
 *
 * Listens for Socket.io events:
 *   campaign:queue-incoming  → show alert
 *   campaign:queue-dismissed → hide alert (another agent accepted)
 *   campaign:call-accepted   → hide alert
 */
import React, { useEffect, useState, useRef } from 'react';
import { Modal, Button, Input, Space, Typography, Tag, notification, Badge } from 'antd';
import {
  PhoneOutlined,
  CloseOutlined,
  SwapOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/authStore';

const { Text, Title } = Typography;
const BASE = import.meta.env.VITE_API_URL || '';

interface QueueNotification {
  taskId: string;
  queueId: string;
  queueName: string;
  channelId: string;
  contactNumber: string;
  contactName?: string;
  outboundCallerId?: string;
  timestamp: string;
}

const CampaignQueueAlert: React.FC = () => {
  const [incoming, setIncoming] = useState<QueueNotification | null>(null);
  const [transferMode, setTransferMode] = useState(false);
  const [transferExt, setTransferExt] = useState('');
  const [acting, setActing] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const socket = io(BASE, {
      transports: ['websocket', 'polling'],
      auth: { token },
    });
    socketRef.current = socket;

    socket.on('campaign:queue-incoming', (data: QueueNotification) => {
      setIncoming(data);
      setTransferMode(false);
      setTransferExt('');
      // Also show a browser notification
      notification.info({
        message: '来电排队',
        description: `${data.contactName || data.contactNumber} 正在等待接听`,
        duration: 8,
        placement: 'topRight',
        icon: <PhoneOutlined style={{ color: '#1677ff' }} />,
      });
    });

    socket.on('campaign:queue-dismissed', () => {
      setIncoming(null);
    });

    socket.on('campaign:call-accepted', () => {
      setIncoming(null);
    });

    return () => { socket.disconnect(); };
  }, []);

  const apiFetch = async (path: string, body?: object) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }
    return res.json();
  };

  const handleAccept = async () => {
    if (!incoming) return;
    // Use the user's own extension number
    const myExt = (user as any)?.extensionNumber || (user as any)?.extension?.number;
    if (!myExt) {
      notification.error({ message: '接听失败', description: '您的账号未绑定分机号，无法接听' });
      return;
    }
    setActing(true);
    try {
      await apiFetch(`/api/campaigns/tasks/${incoming.taskId}/accept`, { extensionNumber: myExt });
      notification.success({ message: '接听成功', description: `通话已转接到您的分机 ${myExt}` });
      setIncoming(null);
    } catch (e: any) {
      notification.error({ message: '接听失败', description: e.message });
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    if (!incoming) return;
    const myExt = (user as any)?.extensionNumber || (user as any)?.extension?.number || '';
    setActing(true);
    try {
      await apiFetch(`/api/campaigns/tasks/${incoming.taskId}/reject`, { extensionNumber: myExt });
      setIncoming(null);
    } catch {}
    setActing(false);
  };

  const handleTransfer = async () => {
    if (!incoming || !transferExt) return;
    setActing(true);
    try {
      await apiFetch(`/api/campaigns/tasks/${incoming.taskId}/accept`, { extensionNumber: transferExt });
      notification.success({ message: '转接成功', description: `已转接到分机 ${transferExt}` });
      setIncoming(null);
    } catch (e: any) {
      notification.error({ message: '转接失败', description: e.message });
    } finally {
      setActing(false);
      setTransferMode(false);
    }
  };

  if (!incoming) return null;

  return (
    <Modal
      open
      closable={false}
      maskClosable={false}
      centered
      width={400}
      footer={null}
      styles={{ body: { padding: 24 } }}
    >
      <div style={{ textAlign: 'center' }}>
        <Badge status="processing" color="blue" />
        <Title level={4} style={{ marginTop: 8 }}>
          <PhoneOutlined /> 来电等待接听
        </Title>

        <div style={{ background: '#f6f8ff', borderRadius: 8, padding: '16px 20px', marginBottom: 16, textAlign: 'left' }}>
          <div style={{ marginBottom: 6 }}>
            <Text type="secondary">客户号码：</Text>
            <Text strong style={{ fontSize: 16 }}>{incoming.contactNumber}</Text>
          </div>
          {incoming.contactName && (
            <div style={{ marginBottom: 6 }}>
              <Text type="secondary">客户姓名：</Text>
              <Text>{incoming.contactName}</Text>
            </div>
          )}
          {incoming.outboundCallerId && (
            <div style={{ marginBottom: 6 }}>
              <Text type="secondary">外显号码：</Text>
              <Tag color="blue">{incoming.outboundCallerId}</Tag>
            </div>
          )}
          <div>
            <Text type="secondary">活动队列：</Text>
            <Text>{incoming.queueName}</Text>
          </div>
        </div>

        {!transferMode ? (
          <Space size={12}>
            <Button
              type="primary"
              size="large"
              icon={<PhoneOutlined />}
              onClick={handleAccept}
              loading={acting}
              style={{ background: '#52c41a', borderColor: '#52c41a' }}
            >
              接听
            </Button>
            <Button
              size="large"
              icon={<SwapOutlined />}
              onClick={() => setTransferMode(true)}
              disabled={acting}
            >
              转接
            </Button>
            <Button
              size="large"
              danger
              icon={<CloseOutlined />}
              onClick={handleReject}
              loading={acting}
            >
              拒绝
            </Button>
          </Space>
        ) : (
          <Space.Compact style={{ width: '100%' }}>
            <Input
              prefix={<UserOutlined />}
              placeholder="输入分机号"
              value={transferExt}
              onChange={(e) => setTransferExt(e.target.value)}
              onPressEnter={handleTransfer}
              autoFocus
            />
            <Button type="primary" onClick={handleTransfer} loading={acting}>转接</Button>
            <Button onClick={() => setTransferMode(false)}>取消</Button>
          </Space.Compact>
        )}
      </div>
    </Modal>
  );
};

export default CampaignQueueAlert;
