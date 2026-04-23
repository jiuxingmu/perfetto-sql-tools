export type WaitTypeMeta = {
  label: string;
  description: string;
};

export const WAIT_TYPE_META: Record<string, WaitTypeMeta> = {
  io: { label: 'IO 等待', description: '线程在等待磁盘/文件/块设备 IO 完成。' },
  lock: { label: '锁等待', description: '线程在等待 mutex/rwlock 等锁资源。' },
  binder: { label: 'Binder 等待', description: '线程在 Binder 调用链路中等待返回或处理。' },
  futex: { label: 'futex 等待', description: '线程在 futex 同步原语上等待唤醒。' },
  workqueue: { label: 'workqueue 等待', description: '线程在等待 workqueue/flush work 等后台任务。' },
  schedule: { label: '调度等待', description: '线程 runnable 或可运行，但尚未获取 CPU 时间片。' },
  unknown_io: { label: '未知等待(IO 相关)', description: '存在 IO 特征，但无法精确归因到明确等待类型。' },
  unknown_lock: { label: '未知等待(锁相关)', description: '存在锁竞争特征，但无法精确识别锁类型。' },
  unknown_sync: { label: '未知等待(同步相关)', description: '存在同步原语特征，但不足以归到 futex/lock。' },
  unknown_kernel: { label: '未知等待(内核态等待)', description: '线程处于内核等待相关状态，原因未完全可见。' },
  unknown_other: { label: '未知等待', description: '等待原因暂不可判定，建议结合上下文继续排查。' },
};
