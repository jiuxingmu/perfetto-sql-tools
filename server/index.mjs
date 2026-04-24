import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { WasmEngine } from '@lynx-js/trace-processor';

const app = express();
const upload = multer();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

/** @type {WasmEngine | null} */
let primaryEngine = null;
/** @type {WasmEngine | null} */
let baselineEngine = null;

function toRows(result) {
  const rows = [];
  for (const it = result.iter({}); it.valid(); it.next()) {
    const row = {};
    for (const col of result.columns()) {
      const v = it.get(col);
      row[col] = typeof v === 'bigint' ? Number(v) : v;
    }
    rows.push(row);
  }
  return rows;
}

function disposeEngine(engine) {
  if (!engine) return;
  try {
    engine[Symbol.dispose]?.();
  } catch {
    // ignore
  }
}

/**
 * @param {'primary' | 'baseline'} role
 */
async function queryRows(sql, role = 'primary') {
  const engine = role === 'baseline' ? baselineEngine : primaryEngine;
  if (!engine) {
    if (role === 'baseline') {
      throw new Error('请先导入基线 trace 文件');
    }
    throw new Error('请先导入 trace 文件');
  }
  const result = await engine.query(sql, 'perfetto-sql-tool');
  return toRows(result);
}

async function loadTraceFromBuffer(fileBuffer, role) {
  const nextEngine = new WasmEngine(`engine-${role}-${Date.now()}`);
  const chunkSize = 4 * 1024 * 1024;
  const bytes = new Uint8Array(fileBuffer.buffer, fileBuffer.byteOffset, fileBuffer.byteLength);

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(bytes.length, offset + chunkSize));
    await nextEngine.parse(chunk);
  }
  await nextEngine.notifyEof();

  if (role === 'baseline') {
    disposeEngine(baselineEngine);
    baselineEngine = nextEngine;
  } else {
    disposeEngine(primaryEngine);
    primaryEngine = nextEngine;
  }
}

app.post('/api/trace/import', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).send('缺少 trace 文件');
      return;
    }

    await loadTraceFromBuffer(file.buffer, 'primary');
    disposeEngine(baselineEngine);
    baselineEngine = null;

    const [bounds] = await queryRows('SELECT start_ts, end_ts FROM trace_bounds LIMIT 1;', 'primary');
    const [sliceCount] = await queryRows('SELECT COUNT(1) AS cnt FROM slice;', 'primary');
    const [tableCount] = await queryRows("SELECT COUNT(1) AS cnt FROM sqlite_master WHERE type='table';", 'primary');
    const processRows = await queryRows("SELECT DISTINCT COALESCE(name, printf('pid_%d', pid)) AS process FROM process WHERE upid IS NOT NULL ORDER BY process;", 'primary');
    const threadRows = await queryRows("SELECT DISTINCT COALESCE(name, printf('tid_%d', tid)) AS thread FROM thread WHERE utid IS NOT NULL ORDER BY thread;", 'primary');

    const summary = {
      traceName: file.originalname,
      timeRange: [Number(bounds?.start_ts ?? 0) / 1e9, Number(bounds?.end_ts ?? 0) / 1e9],
      processCount: processRows.length,
      threadCount: threadRows.length,
      tableCount: Number(tableCount?.cnt ?? 0),
      recordCount: Number(sliceCount?.cnt ?? 0),
    };

    res.json({
      summary,
      processes: processRows.map((r) => String(r.process)),
      threads: threadRows.map((r) => String(r.thread)),
    });
  } catch (err) {
    res.status(500).send(`trace 导入失败: ${String(err)}`);
  }
});

app.post('/api/trace/import-baseline', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).send('缺少基线 trace 文件');
      return;
    }

    if (!primaryEngine) {
      res.status(400).send('请先导入主 trace，再导入基线 trace');
      return;
    }

    await loadTraceFromBuffer(file.buffer, 'baseline');

    const [bounds] = await queryRows('SELECT start_ts, end_ts FROM trace_bounds LIMIT 1;', 'baseline');
    const [sliceCount] = await queryRows('SELECT COUNT(1) AS cnt FROM slice;', 'baseline');
    const [tableCount] = await queryRows("SELECT COUNT(1) AS cnt FROM sqlite_master WHERE type='table';", 'baseline');
    const processRows = await queryRows("SELECT DISTINCT COALESCE(name, printf('pid_%d', pid)) AS process FROM process WHERE upid IS NOT NULL ORDER BY process;", 'baseline');
    const threadRows = await queryRows("SELECT DISTINCT COALESCE(name, printf('tid_%d', tid)) AS thread FROM thread WHERE utid IS NOT NULL ORDER BY thread;", 'baseline');

    const summary = {
      traceName: file.originalname,
      timeRange: [Number(bounds?.start_ts ?? 0) / 1e9, Number(bounds?.end_ts ?? 0) / 1e9],
      processCount: processRows.length,
      threadCount: threadRows.length,
      tableCount: Number(tableCount?.cnt ?? 0),
      recordCount: Number(sliceCount?.cnt ?? 0),
    };

    res.json({
      summary,
      processes: processRows.map((r) => String(r.process)),
      threads: threadRows.map((r) => String(r.thread)),
    });
  } catch (err) {
    res.status(500).send(`基线 trace 导入失败: ${String(err)}`);
  }
});

app.delete('/api/trace/baseline', (_req, res) => {
  try {
    disposeEngine(baselineEngine);
    baselineEngine = null;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).send(`清除基线失败: ${String(err)}`);
  }
});

app.post('/api/query', async (req, res) => {
  try {
    const sql = String(req.body?.sql ?? '').trim();
    if (!sql) {
      res.status(400).send('缺少 sql');
      return;
    }
    const trace = req.body?.trace === 'baseline' ? 'baseline' : 'primary';
    const rows = await queryRows(sql, trace);
    res.json(rows);
  } catch (err) {
    res.status(500).send(`查询失败: ${String(err)}`);
  }
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`Perfetto API listening on http://localhost:${port}`);
});
