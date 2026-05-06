import { Button, Layout, Select, Space, Typography, Upload } from 'antd';
import type { UploadProps } from 'antd';
import { Link } from 'react-router-dom';

const { Header } = Layout;

type AppHeaderProps = {
  loading: boolean;
  uploadProps: UploadProps;
  processOptions: Array<{ label: string; value: string }>;
  globalProcess: string;
  onChangeGlobalProcess: (value: string) => void;
};

export function AppHeader({
  loading,
  uploadProps,
  processOptions,
  globalProcess,
  onChangeGlobalProcess,
}: AppHeaderProps) {
  return (
    <Header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a' }}>
      <Space size={16} align="center">
        <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>
          Perfetto SQL 可视化工具
        </Typography.Title>
        <Link
          to="/schema"
          style={{
            color: '#94a3b8',
            fontSize: 14,
            whiteSpace: 'nowrap',
            textDecoration: 'none',
          }}
        >
          数据表与字段
        </Link>
      </Space>
      <Space size={10}>
        <Upload {...uploadProps}>
          <Button
            loading={loading}
            type="primary"
            style={{
              background: '#1677ff',
              borderColor: '#1677ff',
              color: '#fff',
              fontWeight: 600,
              boxShadow: '0 2px 8px rgba(22,119,255,0.35)',
            }}
          >
            导入 Trace 文件
          </Button>
        </Upload>
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="全局进程(可选)"
          style={{ width: 260 }}
          options={processOptions}
          value={globalProcess || undefined}
          onChange={(v) => onChangeGlobalProcess(v ?? '')}
        />
      </Space>
    </Header>
  );
}
