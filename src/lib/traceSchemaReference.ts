/**
 * 本项目中插件 SQL 实际用到的 Perfetto trace processor 表及常用字段说明。
 * 时间与时长在 trace DB 中多为纳秒（ns）；展示层可能换算为秒或毫秒。
 * 权威定义见 Perfetto 文档：https://perfetto.dev/docs/analysis/sql-tables
 */

export type TraceColumnDoc = {
  name: string;
  type: string;
  meaning: string;
  /** 典型取值、单位、与业务相关的约束说明 */
  valueRange: string;
};

export type TraceTableDoc = {
  name: string;
  description: string;
  /** 在本仓库中的用途简述 */
  usedInPlugins: string;
  columns: TraceColumnDoc[];
  notes?: string[];
};

export const TRACE_SCHEMA_DOC_URL = 'https://perfetto.dev/docs/analysis/sql-tables';

export const TRACE_SCHEMA_TABLES: TraceTableDoc[] = [
  {
    name: 'trace_bounds',
    description: '整条 trace 的全局时间范围，用于把绝对纳秒换算成相对 trace 起点的时间。',
    usedInPlugins: '慢帧分析、等待归因、主线程阻塞总览等（trace_window CTE）。',
    columns: [
      { name: 'start_ts', type: 'int64', meaning: 'trace 起始时间戳', valueRange: '纳秒；通常 ≤ 任意事件 ts' },
      { name: 'end_ts', type: 'int64', meaning: 'trace 结束时间戳', valueRange: '纳秒；通常 ≥ 窗口内事件 ts' },
    ],
  },
  {
    name: 'process',
    description: '进程维度的静态与生命周期信息，是 thread、sched 等通过 upid 向上归并时的主表之一。',
    usedInPlugins: '几乎全部插件（进程名过滤、展示 pid/uid/cmdline 等）。',
    columns: [
      { name: 'upid', type: 'uint32', meaning: '进程在 trace 内的唯一 id', valueRange: '正整数；与 thread.upid 外键关联' },
      { name: 'pid', type: 'int32', meaning: '操作系统进程号', valueRange: 'Linux/Android pid；可能重复于不同 upid 若进程复用' },
      { name: 'name', type: 'string', meaning: '进程可执行名 / 包名', valueRange: '可为空；本项目中常用 COALESCE(name, printf(\'pid_%d\', pid))' },
      { name: 'uid', type: 'int32', meaning: 'Android/Linux 用户 id（若有）', valueRange: '常 ≥ 0；未解析时可能为 NULL' },
      { name: 'cmdline', type: 'string', meaning: '启动命令行', valueRange: '可为空字符串' },
      { name: 'parent_upid', type: 'uint32', meaning: '父进程 upid', valueRange: '无父进程时可能为 NULL' },
      { name: 'start_ts', type: 'int64', meaning: '进程创建时间', valueRange: '纳秒；可为 NULL' },
      { name: 'end_ts', type: 'int64', meaning: '进程退出时间', valueRange: '纳秒；NULL 常表示进程在 trace 结束时仍在运行' },
      { name: 'android_appid', type: 'int32', meaning: 'Android 应用 id（若采集）', valueRange: '视 trace 源而定，可为 NULL' },
      { name: 'arg_set_id', type: 'uint32', meaning: '附加参数集合 id', valueRange: '可关联 args 表；本项目中多为展示列' },
    ],
    notes: [
      '进程画像总览中用进程生命期与「分析窗口」求交集得到 active_in_window_sec。',
    ],
  },
  {
    name: 'thread',
    description: '线程维度信息；与 sched、thread_state、slice（经 thread_track）关联的核心键是 utid。',
    usedInPlugins: '全部插件中涉及线程筛选、主线程判定、趋势与热点等。',
    columns: [
      { name: 'utid', type: 'uint32', meaning: '线程在 trace 内的唯一 id', valueRange: '正整数；sched.utid、thread_state.utid 与之对应' },
      { name: 'tid', type: 'int32', meaning: '操作系统线程号 tid', valueRange: 'Linux tid；同 pid 下多线程 tid 不同' },
      { name: 'upid', type: 'uint32', meaning: '所属进程 upid', valueRange: '必须能 join 到 process.upid' },
      { name: 'name', type: 'string', meaning: '线程名', valueRange: '可为空；主线程常为 main 或依赖 is_main_thread' },
      { name: 'is_main_thread', type: 'uint32', meaning: '是否主线程（若 trace 含该列）', valueRange: '0/1；缺失时 SQL 中用 name=main 等规则兜底' },
      { name: 'start_ts', type: 'int64', meaning: '线程创建时间', valueRange: '纳秒；线程趋势里与桶边界比较「是否已创建」' },
      { name: 'end_ts', type: 'int64', meaning: '线程结束时间', valueRange: '纳秒；NULL 表示 trace 结束时仍存在；趋势里用大数表示仍存活' },
    ],
  },
  {
    name: 'sched',
    description: 'CPU 调度片：某线程在某个 CPU 上连续运行的一段时间，来自 ftrace sched/switch 等。',
    usedInPlugins: '进程画像（CPU 聚合）、热点线程分析、慢帧（main_sched）、线程画像总览（cpu_agg）。',
    columns: [
      { name: 'id', type: 'SchedSliceTable::Id', meaning: '调度片主键', valueRange: 'trace 内唯一' },
      { name: 'ts', type: 'int64', meaning: '该片开始时间', valueRange: '纳秒；与窗口 [start,end] 做相交判断' },
      { name: 'dur', type: 'int64', meaning: '该片持续时间', valueRange: '纳秒；≥0；为 0 的片在部分查询中被过滤' },
      { name: 'utid', type: 'uint32', meaning: '运行线程 utid', valueRange: 'join thread.utid' },
      { name: 'end_state', type: 'string', meaning: '片结束时线程调度状态', valueRange: '单字符码：R/S/D/T/… 见 Perfetto 文档' },
      { name: 'priority', type: 'int32', meaning: '运行时的内核优先级', valueRange: '与平台调度策略相关' },
      { name: 'ucpu', type: 'CpuTable::Id', meaning: '执行的逻辑 CPU id', valueRange: '可 join cpu.id；本项目中多数 SQL 未展开 cpu 表' },
    ],
    notes: [
      '与窗口重叠的时长常用公式：MAX(0, MIN(ts+dur, end_ns) - MAX(ts, start_ns))。',
    ],
  },
  {
    name: 'thread_state',
    description: '线程调度状态时间线（Running、Sleeping、blocked 等），比 sched 更细地描述「为何不在跑」。',
    usedInPlugins: '等待归因、进程画像（wait_top）、线程画像（wakeup）、主线程阻塞总览。',
    columns: [
      { name: 'utid', type: 'uint32', meaning: '线程 utid', valueRange: 'join thread.utid' },
      { name: 'ts', type: 'int64', meaning: '状态片段开始时间', valueRange: '纳秒' },
      { name: 'dur', type: 'int64', meaning: '状态片段持续时间', valueRange: '纳秒；>0 才参与多数阻塞分析' },
      { name: 'state', type: 'string', meaning: '状态名', valueRange: '如 Running、R、S、D 等；与 end_state 字符集有对应关系' },
      { name: 'io_wait', type: 'uint32', meaning: '是否处于 io 等待（若采集）', valueRange: '0/1' },
      { name: 'blocked_function', type: 'string', meaning: '阻塞点内核符号 / 函数名', valueRange: '可为空；用于归因 io/futex/binder 等' },
      { name: 'waker_utid', type: 'uint32', meaning: '唤醒本线程的线程 utid', valueRange: '可为 NULL；无唤醒事件时为空' },
    ],
  },
  {
    name: 'slice',
    description: '通用「时间片」事件表，track 上的一段区间；用户态 trace、Chromium slice 等多来源写入。',
    usedInPlugins: '事件耗时聚合、慢帧（与 sched 帧重叠的 slice 名）、线程堆栈 Diff（按 slice.name 聚合栈）。',
    columns: [
      { name: 'id', type: 'SliceTable::Id', meaning: 'slice 主键', valueRange: 'trace 内唯一' },
      { name: 'track_id', type: 'uint32', meaning: '所属轨道 id', valueRange: 'join thread_track.id 等 track 表' },
      { name: 'ts', type: 'int64', meaning: 'slice 开始时间', valueRange: '纳秒' },
      { name: 'dur', type: 'int64', meaning: 'slice 持续时间', valueRange: '纳秒；本项目中常要求 >0' },
      { name: 'name', type: 'string', meaning: 'slice 名称 / 栈帧描述', valueRange: '堆栈 Diff 中作 stack_key；可为空字符串' },
    ],
  },
  {
    name: 'thread_track',
    description: '把 slice 轨道关联到具体线程 utid 的桥表。',
    usedInPlugins: '事件聚合、慢帧 slice_ctx、堆栈 Diff 的 slice_events。',
    columns: [
      { name: 'id', type: 'uint32', meaning: '轨道 id', valueRange: '等于 slice.track_id' },
      { name: 'utid', type: 'uint32', meaning: '该轨道对应线程', valueRange: 'join thread.utid' },
    ],
    notes: [
      '部分 trace 中 thread_track 还有 name 等列；本项目 SQL 主要使用 id 与 utid。',
    ],
  },
];
