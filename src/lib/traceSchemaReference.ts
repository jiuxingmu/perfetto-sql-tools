/**
 * 本项目中插件 SQL 用到的 Perfetto trace processor 表，以及分析时常一并查阅的表。
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
  {
    name: 'cpu',
    description: '逻辑 CPU（核心）维表；与调度片上的 ucpu 对应，用于把「第几颗核」还原成可读信息。',
    usedInPlugins: '当前内置插件 SQL 未直接 JOIN；sched.ucpu 可关联 cpu.id 做核号、机型等扩展分析。',
    columns: [
      { name: 'id', type: 'CpuTable::Id', meaning: 'CPU 主键', valueRange: '与 sched.ucpu 一致' },
      { name: 'cpu', type: 'uint32', meaning: '设备上 CPU 核心下标', valueRange: '通常从 0 起的无符号整数；可为 NULL' },
      { name: 'cluster_id', type: 'uint32', meaning: '簇 id', valueRange: '同簇核心共享同一 cluster_id' },
      { name: 'processor', type: 'string', meaning: '核心描述字符串', valueRange: '如厂商给出的 core 名称' },
      { name: 'machine_id', type: 'MachineTable::Id', meaning: '远端机标识', valueRange: '单机 trace 多为默认机；可 join machine' },
      { name: 'capacity', type: 'uint32', meaning: '相对算力标定（若采集）', valueRange: '可为 NULL；参见内核 CPU capacity 文档' },
      { name: 'arg_set_id', type: 'uint32', meaning: '扩展参数集', valueRange: '可 join args；可为 NULL' },
    ],
  },
  {
    name: 'args',
    description: '键值型扩展参数表；多类事件通过 arg_set_id 挂上同一套「扁平化」参数。',
    usedInPlugins: '当前内置插件 SQL 未直接查询；slice/process 等表上的 arg_set_id 可关联此处做深度排查。',
    columns: [
      { name: 'id', type: 'ArgTable::Id', meaning: '参数行主键', valueRange: 'trace 内唯一' },
      { name: 'arg_set_id', type: 'uint32', meaning: '参数集 id', valueRange: '与 slice.arg_set_id、sched 等表上字段对应' },
      { name: 'flat_key', type: 'string', meaning: '扁平化后的完整 key', valueRange: '如 debug.deeplink 形式' },
      { name: 'key', type: 'string', meaning: '短 key 名', valueRange: '与 flat_key 二选一语义见文档' },
      { name: 'int_value', type: 'int64', meaning: '整型值', valueRange: '与 value_type 搭配；可为 NULL' },
      { name: 'string_value', type: 'string', meaning: '字符串值', valueRange: '可为 NULL' },
      { name: 'real_value', type: 'double', meaning: '浮点值', valueRange: '可为 NULL' },
      { name: 'value_type', type: 'string', meaning: '本行值类型标记', valueRange: '如 int、string、real 等' },
    ],
  },
  {
    name: 'flow',
    description: 'slice 之间的因果/流向边，用于表达「从哪段 slice 流向哪段 slice」（如 Binder、异步链）。',
    usedInPlugins: '当前内置插件 SQL 未使用；做 slice 关联、调用链可视化时常与 slice 联查。',
    columns: [
      { name: 'id', type: 'FlowTable::Id', meaning: 'flow 行主键', valueRange: 'trace 内唯一' },
      { name: 'slice_out', type: 'SliceTable::Id', meaning: '流出方 slice', valueRange: 'join slice.id' },
      { name: 'slice_in', type: 'SliceTable::Id', meaning: '流入方 slice', valueRange: 'join slice.id' },
      { name: 'trace_id', type: 'int64', meaning: '跨 slice 的流程 id（若采集）', valueRange: '可为 NULL；隐式推断的链可能无值' },
      { name: 'arg_set_id', type: 'uint32', meaning: '附加参数集', valueRange: '可为 NULL' },
    ],
  },
  {
    name: 'cpu_freq',
    description: '各逻辑 CPU 在采样时刻的运行频率，用于和 sched、功耗一起对照。',
    usedInPlugins: '当前内置插件 SQL 未使用；做 CPU 频率、降频与卡顿关联分析时常查。',
    columns: [
      { name: 'id', type: 'CpuFreqTable::Id', meaning: '行主键', valueRange: 'trace 内唯一' },
      { name: 'ucpu', type: 'CpuTable::Id', meaning: '逻辑 CPU', valueRange: 'join cpu.id' },
      { name: 'freq', type: 'uint32', meaning: '该 ucpu 上的频率采样值', valueRange: '单位以数据源为准，常见为 kHz；详见 Perfetto 文档' },
    ],
    notes: [
      '部分 trace 中频率随时间可能以 counter 等形式出现；若本表为空或列不一致，以 PRAGMA table_info(cpu_freq) 为准。',
    ],
  },
  {
    name: 'track',
    description: '轨道维表：slice、counter 等通过 track_id 指向的「画在哪条轨道上」；thread_track 是其中一类线程轨道。',
    usedInPlugins: '当前内置插件 SQL 主要直接用 thread_track；通用 slice 在完整 schema 中常 join track 取轨道名、层级。',
    columns: [
      { name: 'id', type: 'TrackTable::Id', meaning: '轨道主键', valueRange: '与 slice.track_id 对应（文档中亦见 __intrinsic_track）' },
      { name: 'name', type: 'string', meaning: '轨道显示名', valueRange: '可为空' },
      { name: 'parent_id', type: 'TrackTable::Id', meaning: '父轨道', valueRange: '根轨道时为 NULL' },
    ],
    notes: [
      '完整 schema 中还可含 classification、machine_id、source_arg_set_id 等；以 Perfetto 文档与 PRAGMA table_info(track) 为准。',
    ],
  },
  {
    name: 'package_list',
    description: '设备上已安装包元数据（需采集 android.packages_list 等数据源）。',
    usedInPlugins: '当前内置插件 SQL 未使用；对照 uid、包名、是否可调试时常查。',
    columns: [
      { name: 'id', type: 'PackageListTable::Id', meaning: '行主键', valueRange: 'trace 内唯一' },
      { name: 'package_name', type: 'string', meaning: '包名', valueRange: '如 com.example.app' },
      { name: 'uid', type: 'int64', meaning: '该包进程使用的 uid', valueRange: '可与 process.uid 对照' },
      { name: 'debuggable', type: 'int32', meaning: '是否可调试', valueRange: '布尔语义 0/1' },
      { name: 'profileable_from_shell', type: 'int32', meaning: '是否可通过 shell profile', valueRange: '布尔语义 0/1' },
      { name: 'version_code', type: 'int64', meaning: 'APK versionCode', valueRange: '整数' },
    ],
  },
];
