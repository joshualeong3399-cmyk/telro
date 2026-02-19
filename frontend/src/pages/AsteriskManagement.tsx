import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Button, Badge, Tabs, Spin, Alert, message, Divider, Space, Typography, Tag } from 'antd';
import {
  SyncOutlined, ApiOutlined, EyeOutlined, ReloadOutlined,
} from '@ant-design/icons';
import api from '@/services/api';

const { Text, Paragraph } = Typography;

interface AsteriskStatus {
  connected: boolean;
  asteriskVersion: string | null;
  reconnectAttempts: number;
  host?: string;
}

interface Configs {
  sipConf: string;
  extConf: string;
  queuesConf: string;
}

const AsteriskManagement: React.FC = () => {
  const [status, setStatus] = useState<AsteriskStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [reconnectLoading, setReconnectLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [configs, setConfigs] = useState<Configs | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);

  const fetchStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await api.get('/asterisk/status');
      setStatus(res.data);
    } catch (e: any) {
      message.error('获取状态失败: ' + (e.response?.data?.message || e.message));
    } finally { setLoadingStatus(false); }
  };

  const handleReconnect = async () => {
    setReconnectLoading(true);
    try {
      await api.post('/asterisk/reconnect');
      message.info('🔄 正在尝试重连 Asterisk AMI，请稍等几秒后刷新状态...');
      setTimeout(fetchStatus, 4000);
    } catch (e: any) {
      message.error('重连失败: ' + (e.response?.data?.message || e.message));
    } finally { setReconnectLoading(false); }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.post('/asterisk/sync');
      message.success('✅ Asterisk 配置已同步并重载成功');
      fetchStatus();
    } catch (e: any) {
      message.error('同步失败: ' + (e.response?.data?.message || e.message));
    } finally { setSyncing(false); }
  };

  const handleSetupIncludes = async () => {
    setSetupLoading(true);
    try {
      await api.post('/asterisk/setup-includes');
      message.success('✅ #include 指令已添加到 Asterisk 主配置文件');
    } catch (e: any) {
      message.error('设置失败: ' + (e.response?.data?.message || e.message));
    } finally { setSetupLoading(false); }
  };

  const handlePreview = async () => {
    setLoadingPreview(true);
    try {
      const res = await api.get('/asterisk/preview');
      const c = res.data.configs;
      setConfigs({ sipConf: c.sipConf, extConf: c.extConf, queuesConf: c.queuesConf });
    } catch (e: any) {
      message.error('获取预览失败: ' + (e.response?.data?.message || e.message));
    } finally { setLoadingPreview(false); }
  };

  const handleReload = async (module: string) => {
    try {
      await api.post(`/asterisk/reload/${module}`);
      message.success(`模块 ${module} 重载成功`);
    } catch (e: any) {
      message.error('重载失败: ' + (e.response?.data?.message || e.message));
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  const tabItems = configs ? [
    {
      key: 'sip',
      label: 'telro-sip.conf',
      children: (
        <pre style={{ background: '#1e1e1e', color: '#d4d4d4', padding: 16, borderRadius: 8, overflow: 'auto', maxHeight: 600, fontSize: 12 }}>
          {configs.sipConf}
        </pre>
      ),
    },
    {
      key: 'ext',
      label: 'telro-extensions.conf',
      children: (
        <pre style={{ background: '#1e1e1e', color: '#d4d4d4', padding: 16, borderRadius: 8, overflow: 'auto', maxHeight: 600, fontSize: 12 }}>
          {configs.extConf}
        </pre>
      ),
    },
    {
      key: 'queues',
      label: 'telro-queues.conf',
      children: (
        <pre style={{ background: '#1e1e1e', color: '#d4d4d4', padding: 16, borderRadius: 8, overflow: 'auto', maxHeight: 600, fontSize: 12 }}>
          {configs.queuesConf}
        </pre>
      ),
    },
  ] : [];

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={16}>
        {/* AMI 连接状态 */}
        <Col span={10}>
          <Card title={<span><ApiOutlined /> Asterisk AMI 状态</span>} extra={
            <Button size="small" icon={<SyncOutlined />} onClick={fetchStatus} loading={loadingStatus}>刷新</Button>
          }>
            <Spin spinning={loadingStatus}>
              {status ? (
                <>
                  {/* 连接状态 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <Badge
                      status={status.connected ? 'success' : 'error'}
                      text={
                        <Text strong style={{ fontSize: 16 }}>
                          {status.connected ? '✅ 已连接' : '❌ 未连接'}
                        </Text>
                      }
                    />
                  </div>

                  {/* 连接信息 */}
                  <div style={{ marginBottom: 8 }}>
                    <Text type="secondary">连接地址：</Text>
                    <Tag>{status.host || 'localhost:5038'}</Tag>
                  </div>

                  {status.asteriskVersion && (
                    <div style={{ marginBottom: 8 }}>
                      <Text type="secondary">版本：</Text>
                      <Text>{status.asteriskVersion}</Text>
                    </div>
                  )}

                  {/* 未连接时的提示 */}
                  {!status.connected && (
                    <>
                      <Alert
                        type="warning"
                        showIcon
                        style={{ marginBottom: 12 }}
                        message={
                          status.reconnectAttempts > 0
                            ? `后台正在重连（第 ${status.reconnectAttempts} 次尝试，指数退避中）`
                            : '未连接'
                        }
                        description={
                          <div>
                            <div>Asterisk 未运行或网络不可达。系统其他功能（数据库、API、前端）正常工作。</div>
                            <div style={{ marginTop: 4, fontSize: 12, color: '#888' }}>
                              检查：ASTERISK_HOST / ASTERISK_PORT / ASTERISK_USER / ASTERISK_SECRET 环境变量是否正确
                            </div>
                          </div>
                        }
                      />
                      <Button
                        icon={<ReloadOutlined />}
                        onClick={handleReconnect}
                        loading={reconnectLoading}
                        type="primary"
                        block
                      >
                        立即手动重连
                      </Button>
                    </>
                  )}
                </>
              ) : <Text type="secondary">加载中...</Text>}
            </Spin>
          </Card>
        </Col>

        {/* 操作面板 */}
        <Col span={14}>
          <Card title="配置同步操作">
            <Alert
              type="info" showIcon style={{ marginBottom: 16 }}
              message="工作流程"
              description="前端修改配置 → 自动写入数据库 → 自动生成 Asterisk 配置文件 → AMI Reload → 立即生效"
            />

            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <div>
                <Text strong>第一步：初始化（首次部署执行一次）</Text>
                <Paragraph type="secondary" style={{ marginBottom: 8 }}>
                  在 Asterisk 主配置文件 (sip.conf / extensions.conf / queues.conf) 中自动添加 #include 指令
                </Paragraph>
                <Button icon={<ApiOutlined />} onClick={handleSetupIncludes} loading={setupLoading}>
                  写入 #include 指令
                </Button>
              </div>

              <Divider style={{ margin: '8px 0' }} />

              <div>
                <Text strong>第二步：手动全量同步</Text>
                <Paragraph type="secondary" style={{ marginBottom: 8 }}>
                  将数据库中所有配置（分机、中继、路由、IVR、队列）生成配置文件并热重载 Asterisk
                </Paragraph>
                <Button type="primary" icon={<SyncOutlined />} onClick={handleSync} loading={syncing}>
                  立即同步并重载 Asterisk
                </Button>
              </div>

              <Divider style={{ margin: '8px 0' }} />

              <div>
                <Text strong>单模块重载</Text>
                <div style={{ marginTop: 8 }}>
                  <Space>
                    <Button size="small" onClick={() => handleReload('sip')}>重载 SIP (chan_sip)</Button>
                    <Button size="small" onClick={() => handleReload('dialplan')}>重载 Dialplan</Button>
                    <Button size="small" onClick={() => handleReload('queues')}>重载 Queues</Button>
                    <Button size="small" danger onClick={() => handleReload('all')}>全模块重载</Button>
                  </Space>
                </div>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 配置预览 */}
      <Card title={<span><EyeOutlined /> 配置文件预览</span>} style={{ marginTop: 16 }} extra={
        <Button icon={<EyeOutlined />} onClick={handlePreview} loading={loadingPreview}>
          生成预览
        </Button>
      }>
        {configs ? (
          <Tabs items={tabItems} />
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>
            点击「生成预览」查看即将写入 Asterisk 的配置文件内容（不实际写入）
          </div>
        )}
      </Card>

      {/* 部署说明 */}
      <Card title="部署说明" style={{ marginTop: 16 }}>
        <Alert type="warning" showIcon style={{ marginBottom: 12 }}
          message="Asterisk 必须单独安装"
          description="本系统是 Asterisk 的管理层。需要在同一台服务器（或同一内网）上安装并运行 Asterisk。"
        />
        <Paragraph>
          <Text strong>环境变量配置（.env）：</Text>
        </Paragraph>
        <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 6 }}>
{`ASTERISK_HOST=127.0.0.1        # Asterisk 服务器 IP
ASTERISK_PORT=5038             # AMI 端口（默认 5038）
ASTERISK_USER=admin            # AMI 用户名（manager.conf）
ASTERISK_SECRET=amp111         # AMI 密码
ASTERISK_CONF_PATH=/etc/asterisk  # 配置文件目录（需要写入权限）`}
        </pre>
        <Paragraph style={{ marginTop: 12 }}>
          <Text strong>Asterisk manager.conf 配置示例：</Text>
        </Paragraph>
        <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 6 }}>
{`[general]
enabled = yes
port = 5038
bindaddr = 127.0.0.1

[admin]
secret = amp111
deny = 0.0.0.0/0.0.0.0
permit = 127.0.0.1/255.255.255.0
read = all
write = all`}
        </pre>
      </Card>
    </div>
  );
};

export default AsteriskManagement;
