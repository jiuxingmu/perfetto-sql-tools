
# 1. 进程表 `process`
描述系统中的进程
- `upid`：进程唯一 ID（主键）
- `pid`：系统进程号
- `name`：进程名
- `uid`：用户 ID
- `cmdline`：命令行参数
- `parent_upid`：父进程 upid
- `start_ts`：进程启动时间
- `end_ts`：进程结束时间
- `android_appid`：Android app ID
- `arg_set_id`：扩展参数 ID

# 2. 线程表 `thread`
描述线程，归属进程
- `utid`：线程唯一 ID（主键）
- `tid`：系统线程 ID
- `upid`：所属进程（关联 process.upid）
- `name`：线程名
- `is_main_thread`：是否主线程
- `start_ts`：线程创建时间
- `end_ts`：线程退出时间

# 3. 切片表 `slice`
函数调用、耗时事件（最常用）
- `id`：切片 ID
- `type`：切片类型
- `ts`：开始时间
- `dur`：持续时长
- `cat`：类别（如 app、sched、view）
- `name`：事件名（函数名/任务名）
- `depth`：调用栈深度
- `stack_id`：调用栈 ID
- `parent_id`：父切片 ID
- `utid`：所属线程（关联 thread.utid）
- `upid`：所属进程
- `arg_set_id`：参数 ID
- `thread_ts` / `thread_dur`：线程内时间

# 4. 调度切片表 `sched_slice`
CPU 调度切片
- `ts`：开始时间
- `dur`：时长
- `cpu`：CPU 核心号
- `utid`：线程 ID
- `prev_state`：之前线程状态
- `end_state`：结束时状态

# 5. 线程状态表 `thread_state`
线程阻塞、运行、睡眠等状态
- `utid`
- `state`：状态（running/runnable/interruptible/uninterruptible等）
- `ts`
- `dur`
- `cpu`
- `waker_utid`：唤醒此线程的线程
- `io_wait`：是否在等 IO
- `blocked_function`：阻塞函数名

# 6. 计数器表 `counter`
数值随时间变化（CPU/内存/帧率等）
- `id`
- `name`
- `ts`
- `value`
- `unit`
- `description`
- `upid` / `utid`

# 7. 参数表 `args`
切片/进程/线程的附加键值对
- `arg_set_id`
- `key`
- `int_value`
- `string_value`
- `real_value`

# 8. 调用栈表 `stack`
- `id`
- `frame_ids`：帧 ID 列表

# 9. 栈帧表 `frame`
- `id`
- `name`：函数名
- `mapping`：库/模块名
- `rel_pc`：相对地址

# 10. 内存相关
- `heap_profile`：堆分配事件
- `heap_allocation`：单次分配
- `memory_snapshot`：内存快照

# 11. Android 专用
- `android_log`：日志
- `graphics_frame_slice`：界面帧
- `view_calls`：View 系统调用
- `activity`：Activity 生命周期
- `package_list`：应用包信息