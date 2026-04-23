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
  setActiveParams,
}: Pick<SharedArgs, 'activeParams' | 'setActiveParams'> & {
  isEventAggregate: boolean;
  isThreadTrend: boolean;
  isThreadBlocked: boolean;
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
