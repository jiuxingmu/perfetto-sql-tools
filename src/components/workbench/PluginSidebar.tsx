import { Card, Layout, Space, Tag, Typography } from 'antd';
import type { PluginDefinition } from '../../types';

const { Sider } = Layout;

type PluginSidebarProps = {
  orderedPlugins: PluginDefinition[];
  activePluginId: PluginDefinition['id'];
  onSelectPlugin: (id: PluginDefinition['id']) => void;
};

export function PluginSidebar({ orderedPlugins, activePluginId, onSelectPlugin }: PluginSidebarProps) {
  return (
    <Sider width={280} theme="light" style={{ borderRight: '1px solid #f0f0f0', padding: 12 }}>
      <Typography.Title level={5}>内置插件</Typography.Title>
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        {orderedPlugins.map((p) => (
          <Card
            key={p.id}
            size="small"
            hoverable
            onClick={() => onSelectPlugin(p.id)}
            style={{ borderColor: p.id === activePluginId ? '#1677ff' : undefined }}
          >
            <Space direction="vertical" size={2} style={{ width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%' }}>
                <Typography.Text strong ellipsis style={{ minWidth: 0 }}>
                  {p.name}
                </Typography.Text>
                <Tag color="blue" style={{ marginInlineEnd: 0, flexShrink: 0 }}>{p.outputType}</Tag>
              </div>
              <Typography.Text type="secondary" ellipsis={{ tooltip: p.description }} style={{ display: 'block' }}>
                {p.description}
              </Typography.Text>
            </Space>
          </Card>
        ))}
      </Space>
    </Sider>
  );
}
