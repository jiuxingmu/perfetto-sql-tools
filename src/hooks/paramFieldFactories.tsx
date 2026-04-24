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
  isThreadOverview,
  isThreadBlocked,
  isCpuUsageAnalysis,
  isMainThreadJankAnalysis,
  isWaitReasonAnalysis,
  isProcessListOverview,
  isMainThreadStackDiffAnalysis,
  setActiveParams,
}: Pick<SharedArgs, 'activeParams' | 'setActiveParams'> & {
  isEventAggregate: boolean;
  isThreadTrend: boolean;
  isThreadOverview: boolean;
  isThreadBlocked: boolean;
  isCpuUsageAnalysis: boolean;
  isMainThreadJankAnalysis: boolean;
  isWaitReasonAnalysis: boolean;
  isProcessListOverview: boolean;
  isMainThreadStackDiffAnalysis: boolean;
}): ParamFieldDraft[] {
  return [
    {
      key: 'stackDiffMode',
      label: '对比模式',
      visible: isMainThreadStackDiffAnalysis,
      control: (
        <Select
          style={{ width: '100%' }}
          value={activeParams.stackDiffMode ?? 'single-trace'}
          onChange={(v) => setActiveParams((p) => ({ ...p, stackDiffMode: v as QueryParams['stackDiffMode'] }))}
          options={[
            { label: '单 trace 双窗口', value: 'single-trace' },
            { label: '双 trace（基线文件）', value: 'dual-trace' },
          ]}
        />
      ),
    },
    {
      key: 'diffCompareStartSec',
      label: '基线开始(s)',
      visible: isMainThreadStackDiffAnalysis,
      control: (
        <Input
          type="number"
          min={0}
          value={activeParams.compareStartSec ?? 0}
          onChange={(e) => {
            const value = Number(e.target.value);
            setActiveParams((p) => ({ ...p, compareStartSec: Number.isFinite(value) ? value : 0 }));
          }}
        />
      ),
    },
    {
      key: 'diffCompareEndSec',
      label: '基线结束(s)',
      visible: isMainThreadStackDiffAnalysis,
      control: (
        <Input
          type="number"
          min={0}
          value={activeParams.compareEndSec ?? 0}
          onChange={(e) => {
            const value = Number(e.target.value);
            setActiveParams((p) => ({ ...p, compareEndSec: Number.isFinite(value) ? value : 0 }));
          }}
        />
      ),
    },
    {
      key: 'diffTopN',
      label: 'Diff Top N',
      visible: isMainThreadStackDiffAnalysis,
      control: (
        <Input
          type="number"
          min={1}
          max={200}
          value={activeParams.diffTopN ?? 30}
          onChange={(e) => {
            const value = Number(e.target.value);
            setActiveParams((p) => ({ ...p, diffTopN: Number.isFinite(value) ? value : 30 }));
          }}
        />
      ),
    },
    {
      key: 'diffSortBy',
      label: '排序方式',
      visible: isMainThreadStackDiffAnalysis,
      control: (
        <Select
          style={{ width: '100%' }}
          value={activeParams.diffSortBy ?? 'cost_delta'}
          onChange={(v) => setActiveParams((p) => ({ ...p, diffSortBy: v as QueryParams['diffSortBy'] }))}
          options={[
            { label: '总耗时增量', value: 'cost_delta' },
            { label: '调用次数增量', value: 'calls_delta' },
            { label: '平均耗时增量', value: 'avg_delta' },
          ]}
        />
      ),
    },
    {
      key: 'diffMinCalls',
      label: '最小调用次数',
      visible: isMainThreadStackDiffAnalysis,
      control: (
        <Input
          type="number"
          min={0}
          value={activeParams.diffMinCalls ?? 1}
          onChange={(e) => {
            const value = Number(e.target.value);
            setActiveParams((p) => ({ ...p, diffMinCalls: Number.isFinite(value) ? value : 1 }));
          }}
        />
      ),
    },
    {
      key: 'diffMinCostMs',
      label: '最小耗时(ms)',
      visible: isMainThreadStackDiffAnalysis,
      control: (
        <Input
          type="number"
          min={0}
          value={activeParams.diffMinCostMs ?? 0.1}
          onChange={(e) => {
            const value = Number(e.target.value);
            setActiveParams((p) => ({ ...p, diffMinCostMs: Number.isFinite(value) ? value : 0.1 }));
          }}
        />
      ),
    },
    {
      key: 'diffOnlyMainThread',
      label: '仅主线程',
      visible: isMainThreadStackDiffAnalysis,
      control: (
        <div className="param-switch-wrap">
          <Switch
            checked={(activeParams.onlyMainThread ?? 1) === 1}
            onChange={(checked) => setActiveParams((p) => ({ ...p, onlyMainThread: checked ? 1 : 0 }))}
          />
        </div>
      ),
    },
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
          min={1}
          value={activeParams.bucketMs ?? 1000}
          onChange={(e) => {
            const value = Number(e.target.value);
            setActiveParams((p) => ({ ...p, bucketMs: Number.isFinite(value) ? value : 1000 }));
          }}
        />
      ),
    },
    {
      key: 'threadTopN',
      label: 'Top N',
      visible: isThreadOverview,
      control: (
        <Input
          type="number"
          min={1}
          max={200}
          value={activeParams.topN ?? 20}
          onChange={(e) => {
            const value = Number(e.target.value);
            setActiveParams((p) => ({ ...p, topN: Number.isFinite(value) ? value : 20 }));
          }}
        />
      ),
    },
    {
      key: 'threadPid',
      label: 'PID(可选)',
      visible: isThreadOverview,
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
      key: 'threadTid',
      label: 'TID(可选)',
      visible: isThreadOverview,
      control: (
        <Input
          type="number"
          placeholder="不填表示全部"
          value={activeParams.tid}
          onChange={(e) => {
            const value = Number(e.target.value);
            setActiveParams((p) => ({ ...p, tid: Number.isFinite(value) ? value : undefined }));
          }}
        />
      ),
    },
    {
      key: 'threadSortBy',
      label: '排序字段',
      visible: isThreadOverview,
      control: (
        <Select
          style={{ width: '100%' }}
          value={activeParams.sortBy ?? 'cpu_time'}
          onChange={(v) => setActiveParams((p) => ({ ...p, sortBy: v as QueryParams['sortBy'] }))}
          options={[
            { label: 'CPU 时间', value: 'cpu_time' },
            { label: '活跃时长', value: 'active_duration' },
            { label: '切换次数', value: 'switch_count' },
            { label: '唤醒次数', value: 'wakeup_count' },
          ]}
        />
      ),
    },
    {
      key: 'threadOnlyActive',
      label: '仅活跃线程',
      visible: isThreadOverview,
      control: (
        <div className="param-switch-wrap">
          <Switch
            checked={(activeParams.onlyActive ?? 1) === 1}
            onChange={(checked) => setActiveParams((p) => ({ ...p, onlyActive: checked ? 1 : 0 }))}
          />
        </div>
      ),
    },
    {
      key: 'threadOnlyMain',
      label: '仅主线程',
      visible: isThreadOverview,
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
      key: 'processTopN',
      label: 'Top N',
      visible: isProcessListOverview,
      control: (
        <Input
          type="number"
          min={1}
          max={200}
          value={activeParams.topN ?? 20}
          onChange={(e) => {
            const value = Number(e.target.value);
            setActiveParams((p) => ({ ...p, topN: Number.isFinite(value) ? value : 20 }));
          }}
        />
      ),
    },
    {
      key: 'processPid',
      label: 'PID(可选)',
      visible: isProcessListOverview,
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
      key: 'processUid',
      label: 'UID(可选)',
      visible: isProcessListOverview,
      control: (
        <Input
          type="number"
          placeholder="不填表示全部"
          value={activeParams.uid}
          onChange={(e) => {
            const value = Number(e.target.value);
            setActiveParams((p) => ({ ...p, uid: Number.isFinite(value) ? value : undefined }));
          }}
        />
      ),
    },
    {
      key: 'processStatus',
      label: '状态',
      visible: isProcessListOverview,
      control: (
        <Select
          style={{ width: '100%' }}
          value={activeParams.statusFilter ?? ''}
          onChange={(v) => setActiveParams((p) => ({ ...p, statusFilter: v as QueryParams['statusFilter'] }))}
          options={[
            { label: '全部', value: '' },
            { label: '运行中', value: 'running' },
            { label: '已结束', value: 'ended' },
          ]}
        />
      ),
    },
    {
      key: 'processSortBy',
      label: '排序字段',
      visible: isProcessListOverview,
      control: (
        <Select
          style={{ width: '100%' }}
          value={activeParams.sortBy ?? 'cpu_time'}
          onChange={(v) => setActiveParams((p) => ({ ...p, sortBy: v as QueryParams['sortBy'] }))}
          options={[
            { label: 'CPU 时间', value: 'cpu_time' },
            { label: '线程数', value: 'thread_count' },
            { label: '活跃时长', value: 'active_duration' },
          ]}
        />
      ),
    },
    {
      key: 'processOnlyActive',
      label: '仅活跃进程',
      visible: isProcessListOverview,
      control: (
        <div className="param-switch-wrap">
          <Switch
            checked={(activeParams.onlyActive ?? 1) === 1}
            onChange={(checked) => setActiveParams((p) => ({ ...p, onlyActive: checked ? 1 : 0 }))}
          />
        </div>
      ),
    },
    {
      key: 'jankThreadName',
      label: '线程名(可选)',
      visible: isMainThreadJankAnalysis,
      control: (
        <Input
          placeholder="线程名模糊匹配"
          value={activeParams.thread}
          onChange={(e) => setActiveParams((p) => ({ ...p, thread: e.target.value }))}
        />
      ),
    },
    {
      key: 'jankTid',
      label: 'TID(可选)',
      visible: isMainThreadJankAnalysis,
      control: (
        <Input
          type="number"
          placeholder="不填表示全部"
          value={activeParams.tid}
          onChange={(e) => {
            const value = Number(e.target.value);
            setActiveParams((p) => ({ ...p, tid: Number.isFinite(value) ? value : undefined }));
          }}
        />
      ),
    },
    {
      key: 'jankFrameThreshold',
      label: '帧阈值(ms)',
      visible: isMainThreadJankAnalysis,
      control: (
        <Input
          type="number"
          min={1}
          value={activeParams.frameThresholdMs ?? 16.6}
          onChange={(e) => {
            const value = Number(e.target.value);
            setActiveParams((p) => ({ ...p, frameThresholdMs: Number.isFinite(value) ? value : 16.6 }));
          }}
        />
      ),
    },
    {
      key: 'jankSlowFrameThreshold',
      label: '慢帧阈值(ms)',
      visible: isMainThreadJankAnalysis,
      control: (
        <Input
          type="number"
          min={1}
          value={activeParams.slowFrameThresholdMs ?? 33}
          onChange={(e) => {
            const value = Number(e.target.value);
            setActiveParams((p) => ({ ...p, slowFrameThresholdMs: Number.isFinite(value) ? value : 33 }));
          }}
        />
      ),
    },
    {
      key: 'jankOnlyMainThread',
      label: '仅主线程',
      visible: isMainThreadJankAnalysis,
      control: (
        <div className="param-switch-wrap">
          <Switch
            checked={(activeParams.onlyMainThread ?? 1) === 1}
            onChange={(checked) => setActiveParams((p) => ({ ...p, onlyMainThread: checked ? 1 : 0 }))}
          />
        </div>
      ),
    },
    {
      key: 'waitThreadName',
      label: '线程名(可选)',
      visible: isWaitReasonAnalysis,
      control: (
        <Input
          placeholder="线程名模糊匹配"
          value={activeParams.thread}
          onChange={(e) => setActiveParams((p) => ({ ...p, thread: e.target.value }))}
        />
      ),
    },
    {
      key: 'waitTid',
      label: 'TID(可选)',
      visible: isWaitReasonAnalysis,
      control: (
        <Input
          type="number"
          placeholder="不填表示全部"
          value={activeParams.tid}
          onChange={(e) => {
            const value = Number(e.target.value);
            setActiveParams((p) => ({ ...p, tid: Number.isFinite(value) ? value : undefined }));
          }}
        />
      ),
    },
    {
      key: 'waitBlockedThreshold',
      label: '阻塞阈值(ms)',
      visible: isWaitReasonAnalysis,
      control: (
        <Input
          type="number"
          min={1}
          value={activeParams.blockedThresholdMs ?? 5}
          onChange={(e) => {
            const value = Number(e.target.value);
            setActiveParams((p) => ({ ...p, blockedThresholdMs: Number.isFinite(value) ? value : 5 }));
          }}
        />
      ),
    },
    {
      key: 'waitTypeFilter',
      label: '等待类型',
      visible: isWaitReasonAnalysis,
      control: (
        <Select
          style={{ width: '100%' }}
          value={activeParams.waitTypeFilter ?? ''}
          onChange={(v) => setActiveParams((p) => ({ ...p, waitTypeFilter: v as QueryParams['waitTypeFilter'] }))}
          options={[
            { label: '全部', value: '' },
            { label: 'io', value: 'io' },
            { label: 'lock', value: 'lock' },
            { label: 'binder', value: 'binder' },
            { label: 'futex', value: 'futex' },
            { label: 'workqueue', value: 'workqueue' },
            { label: 'schedule', value: 'schedule' },
          ]}
        />
      ),
    },
    {
      key: 'waitOnlyMain',
      label: '仅主线程',
      visible: isWaitReasonAnalysis,
      control: (
        <div className="param-switch-wrap">
          <Switch
            checked={(activeParams.onlyMainThread ?? 1) === 1}
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
