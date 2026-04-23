import { Button, Layout, Select, Space, Typography, Upload } from 'antd';
import type { UploadProps } from 'antd';

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
      <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>Perfetto SQL 可视化工具</Typography.Title>
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
