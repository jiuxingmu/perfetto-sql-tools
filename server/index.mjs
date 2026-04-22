import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { WasmEngine } from '@lynx-js/trace-processor';

const app = express();
const upload = multer();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

/** @type {WasmEngine | null} */
let engine = null;

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

async function queryRows(sql) {
  if (!engine) {
    throw new Error('请先导入 trace 文件');
  }
  const result = await engine.query(sql, 'perfetto-sql-tool');
  return toRows(result);
}

async function loadTraceFromBuffer(fileBuffer) {
  if (engine) {
    try {
      engine[Symbol.dispose]?.();
    } catch {
      // ignore dispose failure for old engine
    }
  }

  const nextEngine = new WasmEngine(`engine-${Date.now()}`);
  const chunkSize = 4 * 1024 * 1024;
  const bytes = new Uint8Array(fileBuffer.buffer, fileBuffer.byteOffset, fileBuffer.byteLength);

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(bytes.length, offset + chunkSize));
    await nextEngine.parse(chunk);
  }
  await nextEngine.notifyEof();

  engine = nextEngine;
}

app.post('/api/trace/import', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).send('缺少 trace 文件');
      return;
    }

    await loadTraceFromBuffer(file.buffer);

    const [bounds] = await queryRows('SELECT start_ts, end_ts FROM trace_bounds LIMIT 1;');
    const [sliceCount] = await queryRows('SELECT COUNT(1) AS cnt FROM slice;');
    const [tableCount] = await queryRows("SELECT COUNT(1) AS cnt FROM sqlite_master WHERE type='table';");
    const processRows = await queryRows("SELECT DISTINCT COALESCE(name, printf('pid_%d', pid)) AS process FROM process WHERE upid IS NOT NULL ORDER BY process;");
    const threadRows = await queryRows("SELECT DISTINCT COALESCE(name, printf('tid_%d', tid)) AS thread FROM thread WHERE utid IS NOT NULL ORDER BY thread;");

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

app.post('/api/query', async (req, res) => {
  try {
    const sql = String(req.body?.sql ?? '').trim();
    if (!sql) {
      res.status(400).send('缺少 sql');
      return;
    }
    const rows = await queryRows(sql);
    res.json(rows);
  } catch (err) {
    res.status(500).send(`查询失败: ${String(err)}`);
  }
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`Perfetto API listening on http://localhost:${port}`);
});
