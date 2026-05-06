import { ArrowLeftOutlined } from '@ant-design/icons';
import { Button, Collapse, Layout, Table, Typography } from 'antd';
import { Link } from 'react-router-dom';
import {
  TRACE_SCHEMA_DOC_URL,
  TRACE_SCHEMA_TABLES,
} from '../lib/traceSchemaReference';

const { Header, Content } = Layout;
const { Paragraph, Text } = Typography;

export function SchemaDocsPage() {
  return (
    <Layout style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          background: '#0f172a',
          padding: '0 20px',
        }}
      >
        <Link to="/">
          <Button type="text" icon={<ArrowLeftOutlined />} style={{ color: '#e2e8f0' }}>
            返回工作台
          </Button>
        </Link>
      </Header>
      <Content style={{ padding: '24px 20px 40px', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
        <Paragraph style={{ marginBottom: 20 }}>
          下列表均来自 <Text code>trace processor</Text> 暴露的 SQLite 视图/表，供本工具内置插件 SQL 查询使用。
          字段含义与 Perfetto 版本可能略有差异；完整权威定义见
          {' '}
          <Typography.Link href={TRACE_SCHEMA_DOC_URL} target="_blank" rel="noreferrer">
            Perfetto SQL 表文档
          </Typography.Link>
          。
        </Paragraph>

        <Collapse
          bordered={false}
          style={{ background: '#fff', borderRadius: 12 }}
          items={TRACE_SCHEMA_TABLES.map((table) => ({
            key: table.name,
            label: (
              <span>
                <Text code style={{ fontSize: 15 }}>{table.name}</Text>
                <Text type="secondary" style={{ marginLeft: 12, fontWeight: 400 }}>
                  {table.description}
                </Text>
              </span>
            ),
            children: (
              <div style={{ paddingBottom: 8 }}>
                <Paragraph type="secondary" style={{ marginTop: 0 }}>
                  <Text strong>在本项目中的用途：</Text>
                  {table.usedInPlugins}
                </Paragraph>
                <Table
                  size="small"
                  pagination={false}
                  rowKey="name"
                  columns={[
                    { title: '字段', dataIndex: 'name', width: 140, render: (v: string) => <Text code>{v}</Text> },
                    { title: '类型', dataIndex: 'type', width: 160 },
                    { title: '含义', dataIndex: 'meaning', width: 220 },
                    { title: '取值与说明', dataIndex: 'valueRange' },
                  ]}
                  dataSource={table.columns}
                  scroll={{ x: 720 }}
                />
                {table.notes?.length
                  ? (
                    <ul style={{ margin: '12px 0 0', paddingLeft: 20, color: '#64748b', fontSize: 13 }}>
                      {table.notes.map((n) => <li key={n}>{n}</li>)}
                    </ul>
                  )
                  : null}
              </div>
            ),
          }))}
        />
      </Content>
    </Layout>
  );
}
