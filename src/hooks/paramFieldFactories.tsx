import { Input, Select, Switch } from 'antd';
import type { ParamFieldConfig } from '../components/workbench/WorkbenchTypes';
import type { QueryParams } from '../types';

type SharedArgs = {
  activeParams: QueryParams;
  processOptions: Array<{ label: string; value: string }>;
  globalProcess: string;
  traceDurationSec: number;
  setActiveParams: (updater: (p: QueryParams) => QueryParams) => void;
};

type ParamFieldDraft = ParamFieldConfig & {
  key: string;
  visible: boolean;
};

export function buildCommonParamFields({
  activeParams,
  processOptions,
  globalProcess,
  traceDurationSec,
  setActiveParams,
}: SharedArgs): ParamFieldDraft[] {
  return [
    {
      key: 'startSec',
      label: '开始(s)',
      visible: true,
      control: (
        <Input
          type="number"
          value={activeParams.startSec}
          onChange={(e) => setActiveParams((p) => ({ ...p, startSec: Number(e.target.value) }))}
        />
      ),
    },
    {
      key: 'endSec',
      label: '结束(s)',
      visible: true,
      control: (
        <Input
          type="number"
          value={activeParams.endSec}
          onChange={(e) => setActiveParams((p) => ({ ...p, endSec: Number(e.target.value) }))}
          max={traceDurationSec || undefined}
        />
      ),
    },
    {
      key: 'process',
      label: '进程',
      visible: true,
      control: (
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="全部进程"
          style={{ width: '100%' }}
          options={processOptions}
          value={(globalProcess || activeParams.process) || undefined}
          onChange={(v) => setActiveParams((p) => ({ ...p, process: v ?? '' }))}
        />
      ),
    },
  ];
}

export function buildPluginSpecificParamFields({
  activeParams,
  isEventAggregate,
  isThreadTrend,
  isThreadBlocked,
  isCpuUsageAnalysis,
  setActiveParams,
}: Pick<SharedArgs, 'activeParams' | 'setActiveParams'> & {
  isEventAggregate: boolean;
  isThreadTrend: boolean;
  isThreadBlocked: boolean;
  isCpuUsageAnalysis: boolean;
}): ParamFieldDraft[] {
  return [
    {
      key: 'keyword',
      label: '事件关键字',
      visible: isEventAggregate,
      control: (
        <Input
          placeholder="如: methodA"
          value={activeParams.keyword}
          onChange={(e) => setActiveParams((p) => ({ ...p, keyword: e.target.value }))}
        />
      ),
    },
    {
      key: 'aggregateOrder',
      label: '排序规则',
      visible: isEventAggregate,
      control: (
        <Select
          style={{ width: '100%' }}
          value={activeParams.aggregateOrder ?? 'avg_desc'}
          onChange={(v) => setActiveParams((p) => ({
            ...p,
            aggregateOrder: v as QueryParams['aggregateOrder'],
          }))}
          options={[
            { label: '按平均耗时', value: 'avg_desc' },
            { label: '按总耗时', value: 'total_desc' },
            { label: '按调用次数', value: 'count_desc' },
          ]}
        />
      ),
    },
    {
      key: 'bucketMs',
      label: '分桶(ms)',
      visible: isThreadTrend,
      control: (
        <Input
          type="number"
          value={activeParams.bucketMs}
          onChange={(e) => setActiveParams((p) => ({ ...p, bucketMs: Number(e.target.value) }))}
        />
      ),
    },
    {
      key: 'cpuStatLevel',
      label: '统计粒度',
      visible: isCpuUsageAnalysis,
      control: (
        <Select
          style={{ width: '100%' }}
          value={activeParams.statLevel ?? 'thread'}
          onChange={(v) => setActiveParams((p) => ({ ...p, statLevel: v as QueryParams['statLevel'] }))}
          options={[
            { label: '按线程', value: 'thread' },
            { label: '按进程', value: 'process' },
          ]}
        />
      ),
    },
    {
      key: 'cpuPid',
      label: 'PID(可选)',
      visible: isCpuUsageAnalysis,
      control: (
        <Input
          type="number"
          placeholder="不填表示全部"
          value={activeParams.pid}
          onChange={(e) => {
            const value = Number(e.target.value);
            setActiveParams((p) => ({ ...p, pid: Number.isFinite(value) ? value : undefined }));
          }}
        />
      ),
    },
    {
      key: 'cpuTopN',
      label: 'Top N',
      visible: isCpuUsageAnalysis,
      control: (
        <Input
          type="number"
          min={1}
          max={500}
          value={activeParams.topN ?? 10}
          onChange={(e) => {
            const value = Number(e.target.value);
            setActiveParams((p) => ({ ...p, topN: Number.isFinite(value) ? value : 10 }));
          }}
        />
      ),
    },
    {
      key: 'cpuOnlyMain',
      label: '仅主线程',
      visible: isCpuUsageAnalysis,
      control: (
        <div className="param-switch-wrap">
          <Switch
            checked={(activeParams.onlyMainThread ?? 0) === 1}
            onChange={(checked) => setActiveParams((p) => ({ ...p, onlyMainThread: checked ? 1 : 0 }))}
          />
        </div>
      ),
    },
    {
      key: 'suspiciousOnly',
      label: '疑似阻塞过滤',
      visible: isThreadBlocked,
      control: (
        <div className="param-switch-wrap">
          <Switch
            checked={(activeParams.suspiciousOnly ?? 1) === 1}
            onChange={(checked) => setActiveParams((p) => ({ ...p, suspiciousOnly: checked ? 1 : 0 }))}
          />
        </div>
      ),
    },
  ];
}
