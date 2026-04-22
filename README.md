# Perfetto SQL Tools

基于 Perfetto Trace Processor 的可视化 SQL 分析工具。  
目标是让用户不需要熟悉复杂 SQL，也能通过插件化表单快速完成常见性能分析任务。

## Why

Perfetto 官方 SQL 功能很强，但对很多开发者来说仍有明显门槛：

- 不清楚 trace 中有哪些表和字段
- 常见分析每次都要重复写 SQL
- 结果很难快速图表化和复用

本项目把“高频 SQL 查询”抽象成可配置插件，提供可视化结果、SQL 预览和原始数据三视图。

## Features

- Trace 文件导入（直接导入 trace，不需要先转换数据库）
- 基于 Trace Processor 的真实 SQL 查询执行
- 内置三类核心分析插件
  - Slice 模糊匹配列表
  - 线程数量变化趋势
  - 事件总耗时聚合
- 统一结果面板
  - 可视化结果
  - SQL 预览
  - 原始数据
- 统计信息展示（时间范围、进程/线程数量、记录数等）

## Tech Stack

- Frontend: React + TypeScript + Vite + Ant Design + ECharts
- Backend: Node.js + Express + Multer
- Query Engine: `@lynx-js/trace-processor` (WASM)

## Project Structure

```text
perfetto-sql/
├─ doc/                 # PRD / 技术与风格文档
├─ server/              # 后端 API（导入 trace、执行 SQL）
├─ src/                 # 前端页面与插件逻辑
│  ├─ lib/
│  │  ├─ plugins.ts     # 插件定义与 SQL 模板
│  │  └─ traceParser.ts # 本地解析兜底逻辑
│  ├─ App.tsx
│  └─ types.ts
└─ vite.config.ts       # 前端 dev 代理 /api -> 3001
```

## Quick Start

### 1) Install

```bash
npm install
```

### 2) Start frontend + backend (recommended)

```bash
npm run dev:all
```

该命令会同时启动：

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3001`

### 3) Start separately (optional)

```bash
npm run server
npm run dev
```

### 4) Build

```bash
npm run build
```

## Usage

1. 打开页面后点击“导入 Trace 文件”
2. 选择插件（左侧）
3. 配置时间范围、进程、线程、关键字
4. 点击“运行”查看结果
5. 在“可视化结果 / SQL 预览 / 原始数据”之间切换

## Roadmap

- [ ] 插件 D：关键事件时间戳与时间轴标记
- [ ] 插件管理（新增/编辑/复制/启停）
- [ ] 查询历史与收藏
- [ ] 更完整的 Perfetto schema 浏览能力
- [ ] 大结果集分页与异步流式渲染

## Known Limitations

- 当前主要围绕 `slice/thread/process` 做分析，更多 trace 表仍在扩展中
- 前端图表暂未做细粒度性能优化（大体量数据下会有渲染压力）

## Contributing

欢迎提交 Issue / PR：

1. Fork 本仓库
2. 创建特性分支
3. 提交改动与说明
4. 发起 Pull Request

---

如果这个工具对你有帮助，欢迎 Star 支持。
