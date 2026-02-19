import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Input,
  Tag,
  message,
  Modal,
  Descriptions,
} from 'antd';
import { PlayCircleOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import { recordingAPI, Recording } from '@/services/recording';
import dayjs from 'dayjs';

const RecordingManagement: React.FC = () => {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    fetchRecordings();
  }, []);

  const fetchRecordings = async () => {
    setLoading(true);
    try {
      const response = await recordingAPI.getList({ limit: 100 });
      setRecordings(response.data.data ?? (response.data as any));
    } catch (error) {
      message.error('加载录音列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await recordingAPI.delete(id);
      setRecordings(recordings.filter((r) => r.id !== id));
      message.success('录音已删除');
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  const handleDownload = async (id: string, filename: string) => {
    try {
      const response = await recordingAPI.download(id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
    } catch (error) {
      message.error('下载失败');
    }
  };

  const columns = [
    { title: '文件名', dataIndex: 'filename', key: 'filename' },
    { title: '分机', dataIndex: 'extensionId', key: 'extension', width: 80 },
    {
      title: '时长',
      dataIndex: 'duration',
      key: 'duration',
      width: 80,
      render: (duration: number) => `${Math.floor(duration / 60)}m`,
    },
    { title: '格式', dataIndex: 'format', key: 'format', width: 80 },
    {
      title: '大小',
      dataIndex: 'fileSize',
      key: 'fileSize',
      width: 100,
      render: (size: number) => `${(size / 1024 / 1024).toFixed(2)}MB`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const colors: any = {
          recording: 'processing',
          completed: 'success',
          processing: 'processing',
          failed: 'error',
        };
        const labels: any = {
          recording: '录音中',
          completed: '已完成',
          processing: '处理中',
          failed: '失败',
        };
        return <Tag color={colors[status]}>{labels[status]}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record: Recording) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(record.id, record.filename)}
          />
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          />
        </Space>
      ),
    },
  ];

  const filteredRecordings = recordings.filter(
    (r) =>
      r.filename.toLowerCase().includes(searchText.toLowerCase()) ||
      r.extensionId.includes(searchText)
  );

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '16px' }}>
        <Input.Search
          placeholder="搜索文件名或分机"
          style={{ width: 200 }}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
      </div>

      <Table
        columns={columns}
        dataSource={filteredRecordings}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 20 }}
        scroll={{ x: 1200 }}
      />
    </div>
  );
};

export default RecordingManagement;
