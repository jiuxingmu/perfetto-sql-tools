import { InfoCircleOutlined } from '@ant-design/icons';
import { Button, Card, Drawer, Layout, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { useMemo, useState } from 'react';
import type { PluginDefinition } from '../../types';
import { PLUGIN_EXPLANATIONS } from '../../lib/pluginExplanations';

const { Sider } = Layout;

type PluginSidebarProps = {
  orderedPlugins: PluginDefinition[];
  activePluginId: PluginDefinition['id'];
  onSelectPlugin: (id: PluginDefinition['id']) => void;
};

export function PluginSidebar({ orderedPlugins, activePluginId, onSelectPlugin }: PluginSidebarProps) {
  const [explainPluginId, setExplainPluginId] = useState<PluginDefinition['id'] | null>(null);
  const explainPlugin = useMemo(
    () => orderedPlugins.find((plugin) => plugin.id === explainPluginId) ?? null,
    [explainPluginId, orderedPlugins],
  );
  const explain = explainPlugin ? PLUGIN_EXPLANATIONS[explainPlugin.id] : null;

  return (
    <>
      <Sider width={280} theme="light" style={{ borderRight: '1px solid #f0f0f0', padding: 12 }}>
        <Typography.Title level={5}>内置插件</Typography.Title>
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          {orderedPlugins.map((p) => (
            <Card
              key={p.id}
              size="small"
              hoverable
              onClick={() => onSelectPlugin(p.id)}
              className={`plugin-sidebar-card ${p.id === activePluginId ? 'plugin-sidebar-card--active' : ''}`}
            >
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <div className="plugin-sidebar-card-header">
                  <Typography.Text strong ellipsis className="plugin-sidebar-title">
                    {p.name}
                  </Typography.Text>
                  <Space size={6} align="center">
                    <Tag color="blue" className="plugin-sidebar-type-tag">{p.outputType}</Tag>
                    <Tooltip title="查看插件说明（功能、原理、参数口径、计算流程）">
                      <Button
                        type="text"
                        size="small"
                        className="plugin-sidebar-info-btn"
                        icon={<InfoCircleOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          setExplainPluginId(p.id);
                        }}
                      />
                    </Tooltip>
                  </Space>
                </div>
                <Typography.Text type="secondary" ellipsis={{ tooltip: p.description }} className="plugin-sidebar-desc">
                  {p.description}
                </Typography.Text>
              </Space>
            </Card>
          ))}
        </Space>
      </Sider>
      <Drawer
        title={explainPlugin ? `${explainPlugin.name} - 说明` : '插件说明'}
        width={760}
        open={Boolean(explainPlugin && explain)}
        onClose={() => setExplainPluginId(null)}
        destroyOnClose
      >
        {!explain ? null : (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <div>
              <Typography.Title level={5}>1. 这个插件功能是什么</Typography.Title>
              <Typography.Paragraph>{explain.purpose}</Typography.Paragraph>
            </div>
            <div>
              <Typography.Title level={5}>2. 这个插件的原理是什么</Typography.Title>
              <Typography.Paragraph>{explain.principle}</Typography.Paragraph>
            </div>
            <div>
              <Typography.Title level={5}>3. 参数含义与统计口径</Typography.Title>
              <Table
                size="small"
                pagination={false}
                rowKey="name"
                dataSource={explain.params}
                columns={[
                  { title: '参数', dataIndex: 'name', key: 'name', width: 180 },
                  { title: '含义', dataIndex: 'meaning', key: 'meaning', width: 220 },
                  { title: '口径', dataIndex: 'scope', key: 'scope' },
                ]}
              />
            </div>
            <div>
              <Typography.Title level={5}>4. SQL 详细计算流程（语言化）</Typography.Title>
              <ol style={{ paddingInlineStart: 18, margin: 0 }}>
                {explain.flow.map((step) => (
                  <li key={step} style={{ marginBottom: 6 }}>
                    <Typography.Text>{step}</Typography.Text>
                  </li>
                ))}
              </ol>
            </div>
          </Space>
        )}
      </Drawer>
    </>
  );
}
