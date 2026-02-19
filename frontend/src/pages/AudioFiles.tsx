import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Upload, Select,
  Space, Tag, message, Popconfirm, Typography, Tabs,
} from 'antd';
import {
  UploadOutlined, DeleteOutlined, PlayCircleOutlined, SoundOutlined, SyncOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import api from '@/services/api';
import Cookie from 'js-cookie';

const { Title, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

const CATEGORY_LABELS: Record<string, string> = {
  ivr: 'IVR', moh: '等待音乐', voicemail: '语音信箱',
  campaign: '群呼', flow: 'AI流程', other: '其他',
};

const AudioFiles: React.FC = () => {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadForm] = Form.useForm();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement>(null);

  const load = async (category?: string) => {
    setLoading(true);
    try {
      const params = category && category !== 'all' ? `?category=${category}` : '';
      const r = await api.get(`/audio-files${params}`);
      setFiles(r.data.audioFiles || r.data.rows || r.data);
    } catch (e: any) { message.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    load(key);
  };

  const handleUpload = async () => {
    try {
      const vals = await uploadForm.validateFields();
      if (fileList.length === 0) { message.error('请选择音频文件'); return; }
      const formData = new FormData();
      formData.append('file', fileList[0].originFileObj as File);
      formData.append('name', vals.name || fileList[0].name);
      formData.append('description', vals.description || '');
      formData.append('category', vals.category || 'other');
      await api.post('/audio-files', formData);
      message.success('上传成功');
      setUploadOpen(false);
      uploadForm.resetFields();
      setFileList([]);
      load(activeTab);
    } catch (e: any) { message.error(e.response?.data?.error || e.message); }
  };

  const handleDelete = async (id: string) => {
    try { await api.delete(`/audio-files/${id}`); message.success('删除成功'); load(activeTab); }
    catch (e: any) { message.error(e.message); }
  };

  const handlePlay = async (id: string) => {
    if (audioRef.current) {
      if (playingId === id) {
        audioRef.current.pause();
        audioRef.current.src = '';
        setPlayingId(null);
      } else {
        try {
          const token = Cookie.get('token');
          const resp = await fetch(`/api/ai/audio/${id}/play`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!resp.ok) throw new Error('播放失败');
          const blob = await resp.blob();
          const url = URL.createObjectURL(blob);
          audioRef.current.src = url;
          audioRef.current.play();
          setPlayingId(id);
        } catch (e: any) {
          message.error(e.message || '播放失败');
        }
      }
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  };

  const columns = [
    { title: '名称', dataIndex: 'name', ellipsis: true },
    {
      title: '分类', dataIndex: 'category',
      render: (v: string) => <Tag color="blue">{CATEGORY_LABELS[v] || v}</Tag>,
    },
    { title: '格式', dataIndex: 'mimeType', render: (v: string) => v?.split('/')[1]?.toUpperCase() || '-' },
    { title: '大小', dataIndex: 'size', render: (v: number) => formatSize(v) },
    {
      title: 'Asterisk路径', dataIndex: 'asteriskPath',
      render: (v: string) => v ? <Tag color="green">{v}</Tag> : <Tag color="red">未复制到Asterisk</Tag>,
    },
    {
      title: '操作', render: (_: any, r: any) => (
        <Space>
          <Button
            icon={<PlayCircleOutlined />}
            size="small"
            type={playingId === r.id ? 'primary' : 'default'}
            onClick={() => handlePlay(r.id)}
          >
            {playingId === r.id ? '停止' : '播放'}
          </Button>
          <Popconfirm title="确认删除此音频文件？" onConfirm={() => handleDelete(r.id)}>
            <Button icon={<DeleteOutlined />} size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const categories = [
    { key: 'all', tab: '全部' },
    { key: 'ivr', tab: 'IVR' },
    { key: 'flow', tab: 'AI流程' },
    { key: 'campaign', tab: '群呼' },
    { key: 'moh', tab: '等待音乐' },
    { key: 'other', tab: '其他' },
  ];

  return (
    <div style={{ padding: 24 }}>
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} style={{ display: 'none' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4}><SoundOutlined /> 音频文件管理</Title>
        <Space>
          <Button icon={<SyncOutlined />} onClick={() => load(activeTab)}>刷新</Button>
          <Button type="primary" icon={<UploadOutlined />} onClick={() => setUploadOpen(true)}>上传音频</Button>
        </Space>
      </div>

      <Card>
        <Tabs activeKey={activeTab} onChange={handleTabChange}>
          {categories.map(c => (
            <TabPane key={c.key} tab={c.tab}>
              <Table rowKey="id" dataSource={files} columns={columns} loading={loading} />
            </TabPane>
          ))}
        </Tabs>
      </Card>

      <Modal
        open={uploadOpen}
        title="上传音频文件"
        onCancel={() => { setUploadOpen(false); setFileList([]); }}
        onOk={handleUpload}
        width={480}
      >
        <Form form={uploadForm} layout="vertical">
          <Form.Item label="音频文件" required>
            <Upload
              fileList={fileList}
              beforeUpload={(file) => {
                setFileList([file as unknown as UploadFile]);
                if (!uploadForm.getFieldValue('name')) {
                  uploadForm.setFieldValue('name', file.name.replace(/\.[^/.]+$/, ''));
                }
                return false;
              }}
              onRemove={() => setFileList([])}
              accept=".wav,.mp3,.gsm,.ogg"
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>选择文件 (WAV/MP3/GSM)</Button>
            </Upload>
            <Text type="secondary" style={{ fontSize: 12 }}>
              推荐格式: WAV (8kHz, 16bit, 单声道) 以获得最佳 Asterisk 兼容性
            </Text>
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input placeholder="音频名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="category" label="分类" initialValue="other">
            <Select>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <Option key={k} value={k}>{v}</Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AudioFiles;
