import type { PluginDefinition } from '../types';

export type PluginExplanation = {
  purpose: string;
  principle: string;
  params: Array<{ name: string; meaning: string; scope: string }>;
  flow: string[];
};

export const PLUGIN_EXPLANATIONS: Record<PluginDefinition['id'], PluginExplanation> = {
  'process-list': {
    purpose: '在时间窗口内给出进程级总览，回答“先看哪个进程”。',
    principle: '基于 process/thread/sched/thread_state 聚合进程活跃时长、CPU 时间、线程规模，并给出后续分析建议。',
    params: [
      { name: 'startSec/endSec', meaning: '分析时间窗口', scope: '相对 trace 起点秒数，查询时转换为绝对时间戳' },
      { name: 'process', meaning: '限定进程名', scope: '精确匹配 process.name；空表示全部' },
      { name: 'pid/uid/statusFilter', meaning: '进程筛选', scope: '按 PID/UID/运行状态过滤候选进程' },
      { name: 'topN', meaning: '结果上限', scope: '按排序字段截断前 N 个进程' },
      { name: 'sortBy', meaning: '排序字段', scope: 'cpu_time/thread_count/active_duration' },
      { name: 'onlyActive', meaning: '仅活跃进程', scope: '仅保留窗口内有活跃或 CPU 片段的进程' },
    ],
    flow: [
      '构建窗口参数并筛选与窗口相交的进程。',
      '聚合 sched 得到进程 CPU 时间，聚合 thread/thread_state 得到线程规模和活跃时长。',
      '按 sortBy 排序并截断 topN。',
      '输出进程画像字段和 next_step 建议。',
    ],
  },
  'thread-overview': {
    purpose: '在线程维度输出画像，定位“哪个线程异常忙/切换频繁/唤醒频繁”。',
    principle: '以线程为主键聚合窗口内 active/cpu/switch/wakeup 等指标，附带线程类型与建议动作。',
    params: [
      { name: 'startSec/endSec', meaning: '分析时间窗口', scope: '相对 trace 起点秒数' },
      { name: 'process/pid/tid/thread', meaning: '线程筛选', scope: '进程与线程名/ID联合过滤' },
      { name: 'topN', meaning: '输出条数', scope: '排序后取前 N 条' },
      { name: 'sortBy', meaning: '排序字段', scope: 'cpu_time/active_duration/switch_count/wakeup_count' },
      { name: 'onlyActive', meaning: '仅活跃线程', scope: '过滤掉活跃时长与 CPU 均为 0 的线程' },
      { name: 'onlyMainThread', meaning: '仅主线程', scope: '只保留 main/is_main_thread=1 的线程' },
    ],
    flow: [
      '确定线程候选集（process/thread/pid/tid/onlyMainThread）。',
      '从 sched 聚合 CPU 时间和切换次数，从 thread_state 聚合唤醒等指标。',
      '组装线程画像并按 sortBy 排序。',
      '返回 TopN 明细用于图表与表格联动。',
    ],
  },
  'thread-trend': {
    purpose: '观察线程数量随时间变化趋势，定位线程暴涨/波峰时段。',
    principle: '按 bucketMs 切分时间桶，统计每个时间桶的线程数，形成时间序列。',
    params: [
      { name: 'startSec/endSec', meaning: '趋势区间', scope: '相对 trace 起点秒数' },
      { name: 'process/thread', meaning: '范围限定', scope: '限制统计对象所属进程/线程名' },
      { name: 'bucketMs', meaning: '分桶粒度', scope: '越小越细，点数越多' },
    ],
    flow: [
      '根据窗口与 bucketMs 生成连续时间桶。',
      '把线程生命周期与每个桶做相交计算。',
      '得到每个桶的 thread_count。',
      '输出折线序列并计算峰值/均值等统计。',
    ],
  },
  'cpu-usage-analysis': {
    purpose: '识别 CPU 热点对象（进程或线程），回答“谁最忙、占比多少”。',
    principle: '基于 sched 与窗口裁剪得到有效运行时长，再按进程/线程聚合并计算占比。',
    params: [
      { name: 'startSec/endSec', meaning: '分析窗口', scope: '相对 trace 起点秒数' },
      { name: 'process/pid', meaning: '对象过滤', scope: '限定进程范围' },
      { name: 'statLevel', meaning: '统计粒度', scope: 'process 或 thread' },
      { name: 'topN', meaning: '返回数量', scope: '按 CPU 时间降序截断' },
      { name: 'onlyMainThread', meaning: '仅主线程', scope: '线程粒度下过滤到 main 线程' },
    ],
    flow: [
      '选出与窗口相交的 sched 片段并裁剪 overlap 时长。',
      '按 statLevel 聚合 cpu_dur/slice_count/avg_slice_dur。',
      '计算 cpu_ratio（占总 CPU 裁剪时长比例）。',
      '按 cpu_dur 降序取 TopN 输出。',
    ],
  },
  'main-thread-jank-analysis': {
    purpose: '定位慢帧与卡顿区间，回答“哪里卡了、卡多久”。',
    principle: '把主线程运行片段视作候选帧，按阈值判定 slow/severe 并关联 slice 上下文。',
    params: [
      { name: 'startSec/endSec', meaning: '分析窗口', scope: '相对 trace 起点秒数' },
      { name: 'process/thread/pid/tid', meaning: '线程定位', scope: '确定目标线程（默认主线程）' },
      { name: 'frameThresholdMs', meaning: '慢帧阈值', scope: 'dur >= 该值记为 slow_flag=1' },
      { name: 'slowFrameThresholdMs', meaning: '严重慢帧阈值', scope: 'dur >= 该值记为 severe_jank' },
      { name: 'onlyMainThread', meaning: '仅主线程', scope: '默认开启，聚焦 UI 主线程' },
    ],
    flow: [
      '确定目标线程集合（可仅主线程）。',
      '在窗口内提取 sched 运行片段作为候选帧。',
      '按阈值标记 normal/slow/severe，并关联重叠 slice 名称。',
      '按帧耗时降序输出慢帧明细。',
    ],
  },
  'wait-reason-analysis': {
    purpose: '解释线程“为什么在等”，给出等待类型归因与上下文。',
    principle: '基于 thread_state 阻塞片段，结合 blocked_function/io_wait/state 规则分类为 io/lock/binder 等类型。',
    params: [
      { name: 'startSec/endSec', meaning: '分析窗口', scope: '相对 trace 起点秒数' },
      { name: 'process/thread/pid/tid', meaning: '目标筛选', scope: '限制到指定进程/线程范围' },
      { name: 'blockedThresholdMs', meaning: '最小时长阈值', scope: '仅保留 dur >= 阈值的等待片段' },
      { name: 'waitTypeFilter', meaning: '等待类型过滤', scope: '只看某一类等待' },
      { name: 'onlyMainThread', meaning: '仅主线程', scope: '默认开启，聚焦主线程等待' },
    ],
    flow: [
      '抽取窗口内 thread_state 阻塞片段（排除 Running）。',
      '按 blocked_function/io_wait/state 规则做 wait_type 归类。',
      '关联 waker 线程与进程信息。',
      '输出时长、类型、函数与唤醒上下文明细。',
    ],
  },
  'main-thread-stack-diff-analysis': {
    purpose: '对比两个时间窗口或两个 trace 文件中的线程调用链差异，快速定位性能劣化路径。',
    principle: '对基线侧与目标侧分别按 stack_key 聚合 calls/cost，再做差得到增减变化、风险等级和排序结果。',
    params: [
      { name: 'stackDiffMode', meaning: '对比模式', scope: 'single-trace=同文件双窗口；dual-trace=主/基线两文件对比' },
      { name: 'startSec/endSec', meaning: '目标窗口', scope: '相对目标 trace 起点秒数' },
      { name: 'compareStartSec/compareEndSec', meaning: '基线窗口', scope: 'single-trace 时相对主 trace；dual-trace 时相对基线 trace' },
      { name: 'process/thread/pid/tid', meaning: '范围过滤', scope: '两侧使用同一过滤条件，限定候选线程与 slice' },
      { name: 'onlyMainThread', meaning: '仅主线程', scope: '限制到 main/is_main_thread=1 线程' },
      { name: 'diffTopN/diffSortBy', meaning: '结果排序与截断', scope: '按 cost/calls/avg 增量排序后取前 N 条' },
      { name: 'diffMinCalls/diffMinCostMs', meaning: '噪声过滤阈值', scope: '过滤掉调用次数少或耗时过低的项' },
    ],
    flow: [
      '按模式确定基线数据源（主库或 baseline 库）与目标数据源（主库）。',
      '两侧分别执行聚合 SQL：筛线程、取窗口相交 slice、按 stack_key 汇总 calls/cost。',
      '客户端按 stack_key 合并两侧结果，计算 calls_delta/cost_delta/avg_delta。',
      '根据差值规则标记 change_type 与 risk_level。',
      '按 diffSortBy 排序、应用 TopN 与阈值过滤后输出明细。',
    ],
  },
  'thread-blocked': {
    purpose: '输出主线程阻塞/睡眠片段，快速圈定疑似阻塞事件。',
    principle: '从 thread_state 中提取 blocked/sleeping 状态，按 suspiciousOnly 口径筛选。',
    params: [
      { name: 'startSec/endSec', meaning: '分析窗口', scope: '相对 trace 起点秒数' },
      { name: 'process', meaning: '进程过滤', scope: '按进程名定位目标主线程' },
      { name: 'suspiciousOnly', meaning: '疑似阻塞过滤', scope: '仅保留 D 状态、io_wait 或长时阻塞事件' },
    ],
    flow: [
      '定位目标进程的主线程。',
      '提取窗口内 blocked/sleeping 状态片段。',
      '根据 suspiciousOnly 口径过滤。',
      '输出阻塞开始/结束/时长及唤醒信息。',
    ],
  },
  'event-aggregate': {
    purpose: '统计事件耗时分布，回答“哪些事件最耗时/最频繁”。',
    principle: '按 slice.name 分组，聚合 total/avg/count 指标并支持多种排序口径。',
    params: [
      { name: 'startSec/endSec', meaning: '统计窗口', scope: '相对 trace 起点秒数' },
      { name: 'process/thread', meaning: '范围过滤', scope: '限定统计对象所在进程/线程' },
      { name: 'keyword', meaning: '事件关键字', scope: '按 slice.name 模糊匹配' },
      { name: 'aggregateOrder', meaning: '排序规则', scope: 'avg_desc/total_desc/count_desc' },
    ],
    flow: [
      '筛选窗口内命中的 slice 记录。',
      '按事件名分组聚合 total_dur/avg_dur/count。',
      '按 aggregateOrder 规则排序。',
      '输出聚合表与摘要统计。',
    ],
  },
};
