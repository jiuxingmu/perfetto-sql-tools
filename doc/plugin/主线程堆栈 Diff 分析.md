# 主线程堆栈 Diff 分析

## 目标
- 在同一 trace 的两个时间窗口内对比主线程调用链差异。
- 快速识别新增/增强/减少/消失的热点调用链。
- 给出可优先关注的高风险差异项。

## 当前实现（MVP）
- 对比模式：单 trace 双窗口（基线窗口 vs 目标窗口）。
- 分析范围：主线程（支持切换是否仅主线程）。
- 差异维度：调用次数、总耗时、平均耗时。
- 输出结构：结论摘要、统计卡片、差异排行图、差异明细表、CSV 导出。

## 输入参数
- `start_ts` / `end_ts`：目标窗口（沿用通用时间参数）
- `compare_start_ts` / `compare_end_ts`：基线窗口
- `process_name` / `thread_name` / `pid` / `tid`
- `only_main_thread`
- `diff_top_n`
- `diff_sort_by`：`cost_delta` / `calls_delta` / `avg_delta`
- `diff_min_calls`
- `diff_min_cost_ms`

## 输出字段
- `stack_key`
- `calls_a` / `calls_b` / `calls_delta`
- `cost_a_ms` / `cost_b_ms` / `cost_delta_ms`
- `avg_cost_a_ms` / `avg_cost_b_ms` / `avg_delta_ms`
- `change_type`
- `risk_level`

## 后续可扩展
- 双 trace 对比模式（A/B trace）。
- 调用树 diff 与火焰图 diff。
- 右侧详情抽屉（上下文栈、关联事件、优化建议）。
