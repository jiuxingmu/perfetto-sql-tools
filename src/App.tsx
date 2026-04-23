import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Card, Col, Empty, Input, Layout, Row, Select, Space, Statistic, Table, Tabs, Tag, Typography, Upload, Button, message } from 'antd';
import type { UploadProps } from 'antd';
import ReactECharts from 'echarts-for-react';
import { PLUGINS, runPluginQuery } from './lib/plugins';
import {
  isAbsoluteTraceTimeColumn,
  mapRowsToRelativeTraceTimes,
  relativeTraceSecFractionDigits,
  roundRelativeSec,
  toRelativeTraceSecDisplay,
} from './lib/traceRelativeTime';
import type { PluginDefinition, QueryParams, QueryResult, TraceDataset } from './types';

const { Header, Sider, Content } = Layout;

/** 结果表列宽：总和用于 `scroll.x`，避免列多时被压到只看见前几列。 */
function getResultColumnWidth(key: string): number {
  if (key === 'cmdline') return 360;
  if (key === 'name' || key === 'process') return 180;
  if (key === 'status') return 96;
  if (key === 'active_in_window_sec') return 140;
  if (isAbsoluteTraceTimeColumn(key)) return 132;
  if (key === 'parent_upid' || key === 'arg_set_id' || key === 'android_appid' || key === 'uid') return 112;
  if (key === 'upid' || key === 'pid') return 88;
  return 108;
}

/** 进程列表：主表仅展示这些列，其余在悬停浮层中展示。 */
const PROCESS_LIST_TABLE_KEYS = ['pid', 'name', 'process', 'uid', 'status', 'window_start_sec', 'window_end_sec'] as const;

const PROCESS_LIST_EXTRA_KEY_ORDER = [
  'upid',
  'cmdline',
  'parent_upid',
  'android_appid',
  'arg_set_id',
  'active_in_window_sec',
  'start_ts_sec',
  'end_ts_sec',
];

function processListExtraRank(key: string): number {
  const i = PROCESS_LIST_EXTRA_KEY_ORDER.indexOf(key);
  return i === -1 ? 1000 + key.charCodeAt(0) : i;
}

function getProcessListColumnWidth(key: string): number {
  if (key === 'name' || key === 'process') return 160;
  if (key === 'status') return 88;
  if (key === 'window_start_sec' || key === 'window_end_sec' || key === 'start_ts_sec' || key === 'end_ts_sec') return 120;
  if (key === 'uid' || key === 'pid') return 88;
  return 100;
}

function formatProcessListDetailValue(key: string, value: unknown, traceStartSec: number): string {
  if (value === null || value === undefined || value === '') return '—';
  if (key === 'active_in_window_sec') {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? `${n.toFixed(3)} s` : String(value);
  }
  if (isAbsoluteTraceTimeColumn(key)) {
    return `${toRelativeTraceSecDisplay(value, traceStartSec, relativeTraceSecFractionDigits(key))} s`;
  }
  return String(value);
}

function App() {
  const [dataset, setDataset] = useState<TraceDataset | null>(null);
  const [loading, setLoading] = useState(false);
  const [activePluginId, setActivePluginId] = useState<PluginDefinition['id']>('slice-list');
  const [params, setParams] = useState<QueryParams>({ startSec: 0, endSec: 10, bucketMs: 1000, process: '', thread: '', keyword: '' });
  const [result, setResult] = useState<QueryResult | null>(null);
  const [running, setRunning] = useState(false);
  const traceStartSec = dataset?.summary.timeRange[0] ?? 0;
  const traceEndSec = dataset?.summary.timeRange[1] ?? 0;
  const traceDurationSec = Math.max(0, traceEndSec - traceStartSec);

  const activePlugin = useMemo(() => PLUGINS.find((p) => p.id === activePluginId)!, [activePluginId]);
  const showThreadFilter = activePlugin.id !== 'process-list';

  const [processListHover, setProcessListHover] = useState<{
    record: Record<string, unknown>;
    x: number;
    y: number;
  } | null>(null);
  const processListLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelProcessListHide = () => {
    if (processListLeaveTimerRef.current) {
      clearTimeout(processListLeaveTimerRef.current);
      processListLeaveTimerRef.current = null;
    }
  };

  const scheduleProcessListHide = () => {
    cancelProcessListHide();
    processListLeaveTimerRef.current = setTimeout(() => {
      setProcessListHover(null);
      processListLeaveTimerRef.current = null;
    }, 200);
  };

  useEffect(() => {
    cancelProcessListHide();
    setProcessListHover(null);
  }, [activePluginId, result]);

  useEffect(() => () => cancelProcessListHide(), []);

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
          startSec: 0,
          endSec: Number((parsed.summary.timeRange[1] - parsed.summary.timeRange[0]).toFixed(3)),
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
      const absParams: QueryParams = {
        ...params,
        startSec: params.startSec + traceStartSec,
        endSec: params.endSec + traceStartSec,
      };
      const r = await runPluginQuery(activePlugin, absParams);
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

  const { tableColumns, tableScrollX } = useMemo(() => {
    if (!result?.rows?.length) return { tableColumns: [], tableScrollX: 0 };
    const row0 = result.rows[0] as Record<string, unknown>;

    if (activePluginId === 'process-list') {
      const keys = (PROCESS_LIST_TABLE_KEYS as readonly string[]).filter((k) =>
        Object.prototype.hasOwnProperty.call(row0, k),
      );
      const scrollX = Math.max(640, keys.reduce((acc, k) => acc + getProcessListColumnWidth(k), 0));
      const cols = keys.map((k) => ({
        title: k,
        dataIndex: k,
        key: k,
        width: getProcessListColumnWidth(k),
        ellipsis: true as const,
        render: isAbsoluteTraceTimeColumn(k)
          ? (v: unknown) => toRelativeTraceSecDisplay(v, traceStartSec, relativeTraceSecFractionDigits(k))
          : undefined,
      }));
      return { tableColumns: cols, tableScrollX: scrollX };
    }

    const keys = Object.keys(row0);
    const scrollX = Math.max(720, keys.reduce((acc, k) => acc + getResultColumnWidth(k), 0));
    const cols = keys.map((k) => ({
      title: isAbsoluteTraceTimeColumn(k) ? `${k} (rel s)` : k,
      dataIndex: k,
      key: k,
      width: getResultColumnWidth(k),
      ellipsis: true as const,
      render:
        k === 'active_in_window_sec'
          ? (v: unknown) => {
              const n = typeof v === 'number' ? v : Number(v);
              return Number.isFinite(n) ? n.toFixed(3) : String(v ?? '');
            }
          : isAbsoluteTraceTimeColumn(k)
            ? (v: unknown) => toRelativeTraceSecDisplay(v, traceStartSec, relativeTraceSecFractionDigits(k))
            : undefined,
    }));
    return { tableColumns: cols, tableScrollX: scrollX };
  }, [result, traceStartSec, activePluginId]);

  const tableRowKey = (record: Record<string, unknown>, index?: number) => {
    const i = index ?? 0;
    const id = record.upid ?? record.pid ?? record.ts_sec ?? record.bucket_ts_sec ?? i;
    return `${i}-${String(id)}`;
  };

  const lineOption = useMemo(() => {
    if (!result?.rows?.length || activePlugin.id !== 'thread-trend') return null;
    return {
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        name: 'Relative time (s)',
        data: result.rows.map((r) => roundRelativeSec(Number(r.bucket_ts_sec) - traceStartSec, 3).toFixed(3)),
      },
      yAxis: { type: 'value' },
      series: [{ type: 'line', smooth: true, data: result.rows.map((r) => Number(r.thread_count ?? 0)) }],
      grid: { left: 32, right: 24, top: 20, bottom: 32 },
    };
  }, [result, activePlugin.id, traceStartSec]);

  const rawRowsJson = useMemo(() => {
    const rows = result?.rows ?? [];
    if (!rows.length) return '[]';
    return JSON.stringify(mapRowsToRelativeTraceTimes(rows, traceStartSec), null, 2);
  }, [result?.rows, traceStartSec]);

  const processListHoverPortal =
    processListHover && activePlugin.id === 'process-list'
      ? (() => {
          const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
          const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
          const panelW = Math.min(560, vw - 24);
          const panelH = 360;
          const left = Math.max(8, Math.min(processListHover.x, vw - panelW - 8));
          const top = Math.max(8, Math.min(processListHover.y, vh - panelH - 8));
          const extraRows = Object.entries(processListHover.record)
            .filter(([k]) => !(PROCESS_LIST_TABLE_KEYS as readonly string[]).includes(k))
            .sort((a, b) => processListExtraRank(a[0]) - processListExtraRank(b[0]) || a[0].localeCompare(b[0]));
          return createPortal(
            <div
              role="tooltip"
              style={{
                position: 'fixed',
                left,
                top,
                zIndex: 2000,
                width: panelW,
                maxHeight: panelH,
                overflow: 'auto',
                pointerEvents: 'auto',
                boxShadow: '0 8px 24px rgba(15,23,42,0.18)',
                borderRadius: 8,
              }}
              onMouseEnter={cancelProcessListHide}
              onMouseLeave={scheduleProcessListHide}
            >
              <Card size="small" title="More fields" styles={{ body: { padding: 12 } }}>
                {extraRows.length ? (
                  <Space direction="vertical" size={6} style={{ width: '100%' }}>
                    {extraRows.map(([k, v]) => {
                      const display = formatProcessListDetailValue(k, v, traceStartSec);
                      const longRaw = typeof v === 'string' && String(v).length > 80;
                      return (
                        <div
                          key={k}
                          style={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 10,
                            minWidth: 0,
                            width: '100%',
                          }}
                        >
                          <Typography.Text
                            strong
                            ellipsis={{ tooltip: k }}
                            style={{ width: 200, flexShrink: 0, margin: 0 }}
                          >
                            {k}
                          </Typography.Text>
                          <Typography.Text
                            ellipsis={{ tooltip: display }}
                            copyable={longRaw ? { text: String(v) } : false}
                            style={{ flex: 1, minWidth: 0, margin: 0 }}
                          >
                            {display}
                          </Typography.Text>
                        </div>
                      );
                    })}
                  </Space>
                ) : (
                  <Typography.Text type="secondary">No more fields</Typography.Text>
                )}
              </Card>
            </div>,
            document.body,
          );
        })()
      : null;

  const processListTableOnRow =
    activePlugin.id === 'process-list'
      ? (record: Record<string, unknown>) => ({
          onMouseEnter: (e: { clientX: number; clientY: number }) => {
            cancelProcessListHide();
            setProcessListHover({ record, x: e.clientX + 10, y: e.clientY + 10 });
          },
          onMouseMove: (e: { clientX: number; clientY: number }) => {
            setProcessListHover((prev) =>
              prev?.record === record ? { record, x: e.clientX + 10, y: e.clientY + 10 } : prev,
            );
          },
          onMouseLeave: scheduleProcessListHide,
        })
      : undefined;

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
                <Col span={6}><Statistic title="时间范围(相对s)" value={`0.00 - ${traceDurationSec.toFixed(2)}`} /></Col>
                <Col span={6}><Statistic title="Trace 名称" value={dataset.summary.traceName} /></Col>
              </Row>
            ) : <Empty description="请先导入 trace 文件" />}

            <Card title={`参数配置 - ${activePlugin.name}`}>
              <Row gutter={12}>
                <Col span={4}>
                  <Input
                    type="number"
                    addonBefore="开始(s)"
                    value={params.startSec}
                    onChange={(e) => setParams((p) => ({ ...p, startSec: Number(e.target.value) }))}
                  />
                </Col>
                <Col span={4}>
                  <Input
                    type="number"
                    addonBefore="结束(s)"
                    value={params.endSec}
                    onChange={(e) => setParams((p) => ({ ...p, endSec: Number(e.target.value) }))}
                    max={traceDurationSec || undefined}
                  />
                </Col>
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
                {showThreadFilter ? (
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
                ) : null}
                {activePlugin.id !== 'process-list' ? (
                  <Col span={4}>
                    <Input
                      placeholder="事件关键字"
                      value={params.keyword}
                      onChange={(e) => setParams((p) => ({ ...p, keyword: e.target.value }))}
                    />
                  </Col>
                ) : null}
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
                  children: activePlugin.id === 'thread-trend' && lineOption ? (
                    <ReactECharts option={lineOption} style={{ height: 320 }} />
                  ) : (
                    <Table<Record<string, unknown>>
                      rowKey={tableRowKey}
                      size="small"
                      sticky
                      tableLayout="fixed"
                      scroll={tableScrollX ? { x: tableScrollX } : undefined}
                      columns={tableColumns}
                      dataSource={result?.rows ?? []}
                      pagination={{ pageSize: 100, showSizeChanger: true, pageSizeOptions: [20, 50, 100, 200] }}
                      onRow={processListTableOnRow}
                    />
                  ),
                },
                {
                  key: 'sql',
                  label: 'SQL 预览',
                  children: <pre style={{ margin: 0, background: '#0b1020', color: '#e2e8f0', padding: 12, borderRadius: 8, overflowX: 'auto' }}>{result?.sqlPreview ?? '--'}</pre>,
                },
                {
                  key: 'raw',
                  label: '原始数据',
                  children: <pre style={{ margin: 0, background: '#f6f8fa', padding: 12, borderRadius: 8, maxHeight: 320, overflow: 'auto' }}>{rawRowsJson}</pre>,
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
      {processListHoverPortal}
    </Layout>
  );
}

export default App;
