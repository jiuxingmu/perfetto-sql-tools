import type { PluginDefinition } from '../types';

export type PluginExplanation = {
  purpose: string;
  principle: string;
  params: Array<{ name: string; meaning: string; scope: string }>;
  /** 面试口述风格：先讲目标与拆分，再按执行顺序讲表、关联、聚合与排序 */
  flow: string[];
};

export const PLUGIN_EXPLANATIONS: Record<PluginDefinition['id'], PluginExplanation> = {
  'process-list': {
    purpose: '在时间窗口内给出进程级总览，回答“先看哪个进程”。',
    principle: '基于 process/thread/sched/thread_state 聚合进程活跃时长、CPU 时间、线程规模，并给出后续分析建议。',
    params: [
      { name: 'startSec/endSec', meaning: '分析时间窗口', scope: '相对 trace 起点秒数，查询时转换为绝对时间戳' },
      { name: 'process', meaning: '限定进程名', scope: 'SQL 中使用 COALESCE(p.name) LIKE %process%，子串匹配' },
      { name: 'pid/uid/statusFilter', meaning: '进程筛选', scope: '按 PID/UID/运行状态过滤候选进程' },
      { name: 'topN', meaning: '结果上限', scope: 'ORDER BY 之后 LIMIT top_n' },
      { name: 'sortBy', meaning: '排序口径', scope: '映射为 ORDER BY：active_duration / cpu_time / thread_count 等组合' },
      { name: 'onlyActive', meaning: '仅活跃进程', scope: '仅保留窗口内 active_in_window_sec>0 的进程（或关闭过滤）' },
    ],
    flow: [
      '目标是「在选定时间窗里，一眼看出哪些进程值得先看」。做法是把进程表里跟窗口有交集的进程挑出来，再分别挂上 CPU、线程规模、常见等待类型，最后按你选的排序取 TopN。',
      '开头用 params 把窗口和两个开关定死：起止纳秒、要不要只看活跃进程、TopN 上限、可选的 pid/uid。后面所有 CTE 都引用它，读起来不会迷路。',
      '第一步从 process 读进程身份和生命周期，用进程名模糊匹配、可选 pid/uid，并要求进程存活区间和窗口有重叠。顺带算出窗口内的活跃秒数、窗口起止秒、以及进程是还在跑还是已经结束。',
      '第二步算 CPU：到 sched 里找和窗口相交的调度片，通过 thread 的 utid 归到进程 upid 上，把重叠时长加起来换成毫秒。这是「这个进程底下所有线程在窗里跑了多少 CPU」的近似。',
      '第三步数线程：在 thread 表里按进程 upid 数行数。注意这是 trace 里登记了多少条线程记录，不是严格意义上的「窗内活跃线程数」，但足够做规模感。',
      '第四步给每个进程估一个「最常见的等待大类」：扫窗口里的 thread_state，把 blocked_function、io_wait 等粗分成 io/futex/binder/lock 等，再按进程计数，用窗口函数取每个进程出现最多的那一类。',
      '把这些结果左连接回进程主表，slow_frame_count 先占位为 0。再套一层规则生成 next_step，告诉用户下一步更适合点进热点线程、线程画像还是慢帧。',
      '最后过滤掉你不想看的进程：比如只要窗里有交集的活跃进程，或者按运行中/已结束筛一下。排序字段会映射成「按 CPU、按线程数、按活跃时长」等组合，再 LIMIT 截断。',
    ],
  },
  'thread-overview': {
    purpose: '在线程维度输出画像，定位“哪个线程异常忙/切换频繁/唤醒频繁”。',
    principle: '以线程为主键聚合窗口内 active/cpu/switch/wakeup 等指标，附带线程类型与建议动作。',
    params: [
      { name: 'startSec/endSec', meaning: '分析时间窗口', scope: '相对 trace 起点秒数' },
      { name: 'process/pid/tid/thread', meaning: '线程筛选', scope: '进程与线程名/ID 联合过滤' },
      { name: 'topN', meaning: '输出条数', scope: '排序后 LIMIT top_n' },
      { name: 'sortBy', meaning: '排序字段', scope: '映射为 threadOrderBy：cpu_time / active_duration / switch_count / wakeup_count' },
      { name: 'onlyActive', meaning: '仅活跃线程', scope: '过滤掉活跃时长与 CPU 均为 0 的线程（或关闭）' },
      { name: 'onlyMainThread', meaning: '仅主线程', scope: '只保留 main / is_main_thread=1' },
    ],
    flow: [
      '这条 SQL 回答的是「在窗口里，每条线程到底有多忙、多爱切、多常被唤醒」，所以主键是 utid，而不是进程。',
      '同样先用 params 固定窗口、TopN、要不要过滤非活跃、要不要只看主线程，以及 pid/tid 这类硬条件。',
      '接着在 thread 上联 process，按进程名、线程名模糊、pid/tid、主线程开关，把候选线程圈出来。每一行带上线程自己的 start_ts/end_ts，后面算「在窗口里实际活跃了多久」要用。',
      '对每条候选线程，把它的生命周期和窗口做一次交集，得到窗内起点、终点，以及活跃毫秒数。这一步完全在 SQL 里用 MIN/MAX 裁剪完成，不依赖应用层。',
      '然后分两路聚合：一路去 sched，把和窗口相交的片按 utid 加总 CPU 毫秒，并用片条数近似当「切换次数」；另一路去 thread_state，数有多少段带 waker 的片，当作「被唤醒次数」的粗指标。',
      '把两路结果左连接回线程画像，再根据线程名猜一个 thread_type（binder、render 之类），并生成一句 next_step，方便 UI 引导你下一步点哪个插件。',
      '最后丢掉「既不活跃也没 CPU」的线程（除非你关掉 only_active），再按你选的维度排序，比如 CPU、活跃时长、切换次数或唤醒次数，取前 TopN。',
    ],
  },
  'thread-trend': {
    purpose: '观察线程数量随时间变化趋势，定位线程暴涨/波峰时段。',
    principle: '按 bucketMs 切分时间桶，统计每个时间桶的线程数，形成时间序列。',
    params: [
      { name: 'startSec/endSec', meaning: '趋势区间', scope: '相对 trace 起点秒数' },
      { name: 'process/thread', meaning: '范围限定', scope: '限制统计对象所属进程/线程名（LIKE）' },
      { name: 'bucketMs', meaning: '分桶粒度', scope: '每个桶长度（毫秒→纳秒）' },
    ],
    flow: [
      '这条 SQL 回答的是「线程数量随时间怎么变」：核心是把时间轴切成等宽的桶，再数每个桶边界时刻有多少线程还活着。',
      'params 里除了窗口，还有 bucket_ms 转成的纳秒桶宽，后面递归生成时间轴全靠它。',
      'buckets 这一段用递归 CTE 从窗口左边界一格一格往右推，直到接近右边界或桶数上限，相当于在 SQL 里手搓了一条时间刻度。',
      'threads_filtered 从 thread 表拿每条线程的生死时间，再按进程名、线程名做过滤；没填进程就当全 trace 一起看。',
      '关键判断在 bucketed：每个桶只问一件事——在桶的左边界这一刻，哪些线程已经出生且还没死。用 LEFT JOIN 把桶和线程对齐，再 COUNT DISTINCT utid，就得到这个时刻的线程数。',
      '最后按桶序号排序输出，横轴是桶起点换算成秒，纵轴是 thread_count。折线图和峰值统计是前端用这组点算的，不在 SQL 里。',
    ],
  },
  'cpu-usage-analysis': {
    purpose: '识别 CPU 热点对象（进程或线程），回答“谁最忙、占比多少”。',
    principle: '基于 sched 与窗口裁剪得到有效运行时长，再按进程/线程聚合并计算占比。',
    params: [
      { name: 'startSec/endSec', meaning: '分析窗口', scope: '相对 trace 起点秒数' },
      { name: 'process/pid', meaning: '对象过滤', scope: '进程名与 PID' },
      { name: 'statLevel', meaning: '统计粒度', scope: 'process：按进程聚合；thread：按线程聚合' },
      { name: 'topN', meaning: '返回数量', scope: 'LIMIT top_n' },
      { name: 'onlyMainThread', meaning: '仅主线程', scope: 'sched_scope 中过滤 is_main_thread' },
    ],
    flow: [
      '热点分析本质上只做一件事：把 sched 里落在窗口内的运行片，按「进程」或「线程」加总成 CPU 时间，再算各自占总量的比例。',
      'params 里写好窗口、TopN、要不要只看主线程、以及可选 pid。后面所有裁剪都用同一套起止纳秒。',
      'sched_scope 把 sched 和 thread、process 串起来，筛掉和窗口不相交的片，也筛掉你不需要的进程或主线程。',
      'clipped 再进一步：对每一段 sched，只保留它和窗口重叠的那一段纳秒数，避免把窗口外的尾巴算进来。',
      '接下来分两支聚合：一支把重叠时长按进程名和 pid 汇总，线程 id 丢掉，相当于进程粒度；另一支按线程名、pid、tid 汇总，并顺带算一下主线程片占比。你选的 statLevel 决定最终 UNION 里保留哪一支。',
      'total 子查询把所有选中行的 CPU 纳秒加起来当分母，这样每条结果都能算出 cpu_ratio，回答「谁占了百分之几」。',
      '最后丢掉 CPU 为 0 的行，按 CPU 时间从大到小排，名字做次序，再 LIMIT。输出里会标明当前是进程视图还是线程视图。',
    ],
  },
  'main-thread-jank-analysis': {
    purpose: '定位慢帧与卡顿区间，回答“哪里卡了、卡多久”。',
    principle: '把主线程运行片段视作候选帧，按阈值判定 slow/severe 并关联 slice 上下文。',
    params: [
      { name: 'startSec/endSec', meaning: '分析窗口', scope: '相对 trace 起点秒数' },
      { name: 'process/thread/pid/tid', meaning: '线程定位', scope: '确定目标线程（默认主线程）' },
      { name: 'frameThresholdMs/slowFrameThresholdMs', meaning: '慢帧/严重卡顿阈值', scope: '与 frame_dur_ns 比较生成 slow_flag、jank_type' },
      { name: 'onlyMainThread', meaning: '仅主线程', scope: 'thread_scope 过滤' },
    ],
    flow: [
      '慢帧分析把「主线程在跑」的 sched 片当成一帧一帧看：每段的 duration 就是帧耗时，再用两个阈值区分正常、偏慢、严重卡顿。',
      'params 里除了窗口和线程定位，还把两个阈值转成了纳秒，后面和 frame_dur_ns 直接比大小就行。',
      'trace_window 读 trace_bounds，拿到 trace 起点，这样输出给 UI 的是相对秒，人好读。',
      'thread_scope 先锁定你要看的线程，默认可以收紧到主线程，避免把后台线程的运行片混进来。',
      'main_sched 从 sched 拉这些线程在窗口内的运行片，只要 duration 大于零，每片就对应一行候选帧。',
      'slice_ctx 这一步是「给帧贴标签」：通过 thread_track 找到同线程上的 slice，看谁和这一帧时间重叠，取一个代表性的 slice 名当作 top_slice_name，方便你猜当时栈在干什么。',
      '最后拼上相对时间、毫秒耗时、慢帧标记、严重卡顿标记和阻塞原因文案，按耗时从长到短排，最多五千条，方便你先看最刺眼的。',
    ],
  },
  'wait-reason-analysis': {
    purpose: '解释线程“为什么在等”，给出等待类型归因与上下文。',
    principle: '基于 thread_state 阻塞片段，结合 blocked_function/io_wait/state 规则分类为 io/lock/binder 等类型。',
    params: [
      { name: 'startSec/endSec', meaning: '分析窗口', scope: '相对 trace 起点秒数' },
      { name: 'process/thread/pid/tid', meaning: '目标筛选', scope: '限制到指定进程/线程范围' },
      { name: 'blockedThresholdMs', meaning: '最小时长阈值', scope: 'dur ≥ 阈值纳秒才进入候选' },
      { name: 'waitTypeFilter', meaning: '等待类型过滤', scope: '最终 WHERE 等式过滤 wait_type' },
      { name: 'onlyMainThread', meaning: '仅主线程', scope: 'candidate 中限制' },
    ],
    flow: [
      '等待归因回答的是「线程没在跑的时候到底在等什么」：数据源是 thread_state 里的阻塞和睡眠片段，而不是 sched。',
      'params 把窗口、最小时长阈值、以及线程过滤条件准备好；太短的片先滤掉，减少噪声。',
      'trace_bounds 用来把纳秒时间戳换成相对 trace 起点的秒，方便和别的面板对齐。',
      'candidate 把 thread_state 和 thread、process 连起来，只保留窗口内、非 Running、且看起来像真阻塞的片段，再按你选的进程线程范围收窄。',
      'enriched 在候选集上左连接唤醒方线程和进程：如果 waker_utid 有值，就能知道是谁把它叫醒的。同时用一套 if-else 规则把 blocked_function、io_wait、state 归并成少数几个 wait_type，后面好筛选、好画图。',
      '最终输出里带上相对起止时间、毫秒时长、类型、函数名、唤醒链路和中文 blocked_reason。若你指定了 wait_type 过滤，就在最外层 WHERE 掉不关心的类型。',
      '排序上优先看「谁等得最久」，所以按 duration 降序，同长再按开始时间，最多五千条。',
    ],
  },
  'main-thread-stack-diff-analysis': {
    purpose: '对比两个时间窗口或两个 trace 文件中的线程调用链差异，快速定位性能劣化路径。',
    principle: '对基线侧与目标侧分别按 stack_key 聚合 calls/cost，再做差得到增减变化、风险等级和排序结果。',
    params: [
      { name: 'stackDiffMode', meaning: '对比模式', scope: 'single-trace=同文件双窗口；dual-trace=主/基线两库各一查' },
      { name: 'startSec/endSec', meaning: '目标窗口', scope: '目标侧 slice 聚合时间（绝对秒）' },
      { name: 'compareStartSec/compareEndSec', meaning: '基线窗口', scope: '基线侧 slice 聚合时间（绝对秒）' },
      { name: 'process/thread/pid/tid/onlyMainThread', meaning: '范围过滤', scope: '两侧 SQL 中 thread_scope 一致' },
      { name: 'diffTopN/diffSortBy/diffMinCalls/diffMinCostMs', meaning: '合并后排序与过滤', scope: '在客户端 merge 后应用（非 SQL 片段内）' },
    ],
    flow: [
      '我会先把问题拆成两段：一段是「单侧怎么从 trace 里抽出栈维度统计」，另一段是「两侧结果怎么合起来给你看 diff」。单侧 SQL 是复用的，只是时间窗口和（可选）连哪个库不一样。',
      '单侧里先用 params 把当前这一侧要看的窗口定成纳秒，顺便带上 pid、tid、是否只看主线程这些过滤条件。后面所有 CTE 都引用它，避免魔法数字散落在各处。',
      '接着在 thread 表上关联 process，按你选的进程名、线程名、pid、tid 和主线程开关，把真正要分析的 utid 圈出来，这就是 thread_scope。',
      '有了线程集合以后，去 slice 上找这些线程轨道上的片段：slice 通过 track_id 连 thread_track，再用 utid 对上 thread_scope。只保留 duration 大于 0、名字不为空的片，因为空名字没法当栈的 key。slice.name 在这里就当成 stack_key。',
      '然后把落在当前窗口里的那些片拿出来做聚合：按 stack_key 分组，调用次数就是行数，总耗时就是把 dur 纳秒求和；进程名、线程名、pid、tid 用 MAX 带一条代表值就行，因为同一栈在同一进程线程下通常一致。',
      '基线侧就是把上面整套 SQL 的窗口换成 compareStart 到 compareEnd。双 trace 时这条请求打到基线文件对应的库；单 trace 时还是打主库，只是 SQL 里的起止时间和目标侧那一遍不同，相当于同一份 trace 里开两个窗口各算一遍。',
      '目标侧同理，窗口换成 start 到 end，始终走主库。两次请求返回的都是「栈名 → 调用次数、总耗时」这种中间结果。',
      'SQL 到这里就结束了。前端会用 mergeStackDiffAggRows 按 stack_key 把两侧对齐，算调用次数差、耗时差、平均耗时差，再打上新增/消退之类的 change_type 和风险等级。最后表格上的排序、TopN、最小调用/最小耗时过滤，都是在这一步完成的，所以你在 SQL 里看不到 diffSortBy 那些条件。',
    ],
  },
  'thread-blocked': {
    purpose: '输出主线程阻塞/睡眠片段，快速圈定疑似阻塞事件。',
    principle: '从 thread_state 中提取 blocked/sleeping 状态，按 suspiciousOnly 口径筛选。',
    params: [
      { name: 'startSec/endSec', meaning: '分析窗口', scope: '相对 trace 起点秒数' },
      { name: 'process', meaning: '进程过滤', scope: '精确匹配进程名以定位主线程' },
      { name: 'suspiciousOnly', meaning: '疑似阻塞过滤', scope: '1 时仅 D/io_wait/长 dur；0 时输出全部候选状态' },
    ],
    flow: [
      '主线程阻塞总览比等待归因更聚焦：先锁定「这个进程的主线程是哪一条」，再只拉这条 utid 上的阻塞片段。',
      'params 只带窗口；trace_window 同样用来输出相对秒。',
      'main_thread_candidates 在指定进程名下枚举所有线程，用 is_main_thread 和名字里是否带 main 打一个分。',
      'target_main_thread 从候选里按分数排序取第一条，相当于自动选中主线程，避免用户手填 tid。',
      'blocked_events 回到 thread_state，只保留这条 utid 上、落在窗口里、duration 大于零、且 state 落在睡眠阻塞字母表里的记录，把 waker、io_wait、blocked_function 一并拿出来。',
      '最终展示时拼上进程名、相对起止时间、毫秒时长、阻塞原因文案，以及一个 suspicious 标记。suspiciousOnly 打开时只保留 D 状态、io_wait、或足够长的阻塞，方便你先扫高危；关掉就看全量。',
      '排序按阻塞时长从长到短，相同时再按开始时间，上限五千条。',
    ],
  },
  'event-aggregate': {
    purpose: '统计事件耗时分布，回答“哪些事件最耗时/最频繁”。',
    principle: '按 slice.name 分组，聚合 total/avg/count 指标并支持多种排序口径。',
    params: [
      { name: 'startSec/endSec', meaning: '统计窗口', scope: 'slice.ts BETWEEN 起止纳秒' },
      { name: 'process/thread', meaning: '范围过滤', scope: '经 thread/process 的 LIKE' },
      { name: 'keyword', meaning: '事件关键字', scope: 'slice.name LIKE' },
      { name: 'aggregateOrder', meaning: '排序规则', scope: '映射 ORDER BY：avg/total/count 相关 DESC' },
    ],
    flow: [
      '事件聚合做的是「按 slice 名字做账单」：同名事件在窗口里出现了多少次、总耗时多少、平均每次多久。',
      'slice 通过 track_id 找到 thread_track，再连到 thread 和 process，这样每条 slice 都知道自己挂在哪个进程线程下。',
      'WHERE 里用 ts 落在窗口内做时间裁剪，再用进程名、线程名、slice 名的模糊匹配收窄范围，相当于三维过滤。',
      'SELECT 里按 slice.name 分组：总耗时是 dur 纳秒求和再换成毫秒，平均耗时直接对 dur 做平均，次数就是行数。',
      '排序完全由 aggregateOrder 决定，你可以按平均耗时、总耗时或次数来排，最后最多一千个事件名，避免一次吐太多。',
    ],
  },
};
