# 线程堆栈 Diff 分析

## 目标
- 对比两个时间窗口或两个 trace 文件中的线程 slice 调用链差异。
- 快速识别新增/增强/减少/消失的热点调用链。
- 给出可优先关注的高风险差异项。

## 对比模式

### 单 trace 双窗口
- 主 trace 内：基线时间窗口 vs 目标时间窗口。
- 基线/目标时间均为 **相对当前主 trace 起点** 的秒数；查询时换算为绝对时间戳。

### 双 trace（基线文件）
- **主 trace**：顶部「导入 Trace 文件」加载，用于目标侧聚合。
- **基线 trace**：在参数区选择「双 trace」后，通过「导入基线 Trace」加载；基线侧聚合在该文件上执行。
- 基线开始/结束时间为 **相对基线文件自身起点** 的秒数；目标窗口仍为相对主 trace 起点。
- 重新导入主 trace 会清空服务端基线库与本地基线状态。

## 技术说明
- 两侧各执行一条「按 `stack_key` 聚合 slice」的 SQL，再在浏览器内合并为 diff 表（与历史单条 SQL 语义一致）。
- 服务端维护两个 Wasm 引擎：`primary`（主 trace）、`baseline`（基线 trace）；`/api/query` 支持 `trace` 字段选择库。

## 输入参数
- `stack_diff_mode`：`single-trace` | `dual-trace`
- `start_ts` / `end_ts`：目标窗口（相对主 trace 起点）
- `compare_start_ts` / `compare_end_ts`：基线窗口（单 trace 时相对主 trace；双 trace 时相对基线 trace）
- `process_name` / `thread_name` / `pid` / `tid`（两侧使用同一套筛选，进程名通常与全局进程一致）
- `only_main_thread`
- `diff_top_n`、`diff_sort_by`、`diff_min_calls`、`diff_min_cost_ms`

## 输出字段
- `stack_key`
- `calls_a` / `calls_b` / `calls_delta`（A=基线侧，B=目标侧）
- `cost_a_ms` / `cost_b_ms` / `cost_delta_ms`
- `avg_cost_a_ms` / `avg_cost_b_ms` / `avg_delta_ms`
- `change_type`、`risk_level`

## 后续可扩展
- 调用树 diff 与火焰图 diff。
- 右侧详情抽屉（上下文栈、关联事件、优化建议）。
- 基线独立进程/线程筛选 UI。
