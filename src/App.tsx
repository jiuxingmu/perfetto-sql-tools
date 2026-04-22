import { useMemo, useState } from 'react';
import { Card, Col, Empty, Input, Layout, Row, Select, Space, Statistic, Table, Tabs, Tag, Typography, Upload, Button, message } from 'antd';
import type { UploadProps } from 'antd';
import ReactECharts from 'echarts-for-react';
import { PLUGINS, runPluginQuery } from './lib/plugins';
import type { PluginDefinition, QueryParams, QueryResult, TraceDataset } from './types';

const { Header, Sider, Content } = Layout;

function App() {
  const [dataset, setDataset] = useState<TraceDataset | null>(null);
  const [loading, setLoading] = useState(false);
  const [activePluginId, setActivePluginId] = useState<PluginDefinition['id']>('slice-list');
  const [params, setParams] = useState<QueryParams>({ startSec: 0, endSec: 10, bucketMs: 1000, process: '', thread: '', keyword: '' });
  const [result, setResult] = useState<QueryResult | null>(null);
  const [running, setRunning] = useState(false);

  const activePlugin = useMemo(() => PLUGINS.find((p) => p.id === activePluginId)!, [activePluginId]);

  const processOptions = useMemo(() => {
    if (!dataset) return [];
    return dataset.processes.map((p) => ({ label: p, value: p }));
  }, [dataset]);

  const threadOptions = useMemo(() => {
    if (!dataset) return [];
    return dataset.threads.map((t) => ({ label: t, value: t }));
  }, [dataset]);

  const uploadProps: UploadProps = {
    showUploadList: false,
    maxCount: 1,
    beforeUpload: async (file) => {
      setLoading(true);
      try {
        const form = new FormData();
        form.append('file', file);
        const resp = await fetch('/api/trace/import', { method: 'POST', body: form });
        if (!resp.ok) {
          throw new Error(await resp.text());
        }
        const parsed = (await resp.json()) as TraceDataset;
        setDataset(parsed);
        setResult(null);
        setParams((p) => ({
          ...p,
          startSec: parsed.summary.timeRange[0],
          endSec: Math.ceil(parsed.summary.timeRange[1]),
          process: '',
          thread: '',
        }));
        message.success(`已导入 trace: ${file.name}`);
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        const hint = text.includes('Failed to fetch') || text.includes('ECONNREFUSED')
          ? '后端服务未启动，请先执行 npm run server'
          : text;
        message.error(`导入失败: ${hint}`);
      } finally {
        setLoading(false);
      }
      return false;
    },
  };

  const onRun = async () => {
    if (!dataset) {
      message.warning('请先导入 trace 文件');
      return;
    }
    setRunning(true);
    try {
      const r = await runPluginQuery(activePlugin, params);
      setResult(r);
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      const hint = text.includes('Failed to fetch') || text.includes('ECONNREFUSED')
        ? '后端服务未启动，请先执行 npm run server'
        : text;
      message.error(`查询失败: ${hint}`);
    } finally {
      setRunning(false);
    }
  };

  const tableColumns = useMemo(() => {
    if (!result?.rows?.length) return [];
    return Object.keys(result.rows[0]).map((k) => ({ title: k, dataIndex: k, key: k }));
  }, [result]);

  const lineOption = useMemo(() => {
    if (!result?.rows?.length || activePlugin.id !== 'thread-trend') return null;
    return {
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: result.rows.map((r) => Number(r.bucket_ts_sec).toFixed(3)) },
      yAxis: { type: 'value' },
      series: [{ type: 'line', smooth: true, data: result.rows.map((r) => Number(r.thread_count ?? 0)) }],
      grid: { left: 32, right: 24, top: 20, bottom: 32 },
    };
  }, [result, activePlugin.id]);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a' }}>
        <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>Perfetto SQL 可视化工具</Typography.Title>
        <Upload {...uploadProps}><Button loading={loading} type="primary">导入 Trace 文件</Button></Upload>
      </Header>
      <Layout>
        <Sider width={280} theme="light" style={{ borderRight: '1px solid #f0f0f0', padding: 12 }}>
          <Typography.Title level={5}>内置插件</Typography.Title>
          <Space direction="vertical" style={{ width: '100%' }}>
            {PLUGINS.map((p) => (
              <Card key={p.id} size="small" hoverable onClick={() => setActivePluginId(p.id)} style={{ borderColor: p.id === activePluginId ? '#1677ff' : undefined }}>
                <Space direction="vertical" size={2}>
                  <Typography.Text strong>{p.name}</Typography.Text>
                  <Typography.Text type="secondary">{p.description}</Typography.Text>
                  <Tag color="blue">{p.outputType}</Tag>
                </Space>
              </Card>
            ))}
          </Space>
        </Sider>
        <Content style={{ padding: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            {dataset ? (
              <Row gutter={12}>
                <Col span={4}><Statistic title="进程数" value={dataset.summary.processCount} /></Col>
                <Col span={4}><Statistic title="线程数" value={dataset.summary.threadCount} /></Col>
                <Col span={4}><Statistic title="记录数" value={dataset.summary.recordCount} /></Col>
                <Col span={6}><Statistic title="时间范围(s)" value={`${dataset.summary.timeRange[0].toFixed(2)} - ${dataset.summary.timeRange[1].toFixed(2)}`} /></Col>
                <Col span={6}><Statistic title="Trace 名称" value={dataset.summary.traceName} /></Col>
              </Row>
            ) : <Empty description="请先导入 trace 文件" />}

            <Card title={`参数配置 - ${activePlugin.name}`}>
              <Row gutter={12}>
                <Col span={4}><Input type="number" addonBefore="开始(s)" value={params.startSec} onChange={(e) => setParams((p) => ({ ...p, startSec: Number(e.target.value) }))} /></Col>
                <Col span={4}><Input type="number" addonBefore="结束(s)" value={params.endSec} onChange={(e) => setParams((p) => ({ ...p, endSec: Number(e.target.value) }))} /></Col>
                <Col span={5}>
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder="进程"
                    style={{ width: '100%' }}
                    options={processOptions}
                    value={params.process || undefined}
                    onChange={(v) => setParams((p) => ({ ...p, process: v ?? '' }))}
                  />
                </Col>
                <Col span={5}>
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder="线程"
                    style={{ width: '100%' }}
                    options={threadOptions}
                    value={params.thread || undefined}
                    onChange={(v) => setParams((p) => ({ ...p, thread: v ?? '' }))}
                  />
                </Col>
                <Col span={4}><Input placeholder="事件关键字" value={params.keyword} onChange={(e) => setParams((p) => ({ ...p, keyword: e.target.value }))} /></Col>
                <Col span={2}><Button type="primary" block loading={running} onClick={onRun}>运行</Button></Col>
              </Row>
              {activePlugin.id === 'thread-trend' && (
                <Row style={{ marginTop: 12 }}>
                  <Col span={8}>
                    <Input type="number" addonBefore="分桶(ms)" value={params.bucketMs} onChange={(e) => setParams((p) => ({ ...p, bucketMs: Number(e.target.value) }))} />
                  </Col>
                </Row>
              )}
            </Card>

            <Card title="结果">
              <Tabs items={[
                {
                  key: 'viz',
                  label: '可视化结果',
                  children: activePlugin.id === 'thread-trend' && lineOption ? <ReactECharts option={lineOption} style={{ height: 320 }} /> : <Table rowKey={(r) => JSON.stringify(r)} size="small" columns={tableColumns} dataSource={result?.rows ?? []} pagination={{ pageSize: 10 }} />,
                },
                {
                  key: 'sql',
                  label: 'SQL 预览',
                  children: <pre style={{ margin: 0, background: '#0b1020', color: '#e2e8f0', padding: 12, borderRadius: 8, overflowX: 'auto' }}>{result?.sqlPreview ?? '--'}</pre>,
                },
                {
                  key: 'raw',
                  label: '原始数据',
                  children: <pre style={{ margin: 0, background: '#f6f8fa', padding: 12, borderRadius: 8, maxHeight: 320, overflow: 'auto' }}>{JSON.stringify(result?.rows ?? [], null, 2)}</pre>,
                },
              ]} />
              {result?.stats?.length ? (
                <Row gutter={12} style={{ marginTop: 12 }}>
                  {result.stats.map((s) => <Col key={s.label} span={6}><Card size="small"><Statistic title={s.label} value={s.value} /></Card></Col>)}
                </Row>
              ) : null}
            </Card>
          </Space>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
