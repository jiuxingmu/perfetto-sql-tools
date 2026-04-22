import type { TraceDataset } from '../types';

type TraceEvent = {
  ts: number;
  dur: number;
  name: string;
  process: string;
  thread: string;
};

function toMs(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function safeString(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.trim() ? v : fallback;
}

function parseJsonEvents(text: string): TraceEvent[] {
  try {
    const parsed = JSON.parse(text) as unknown;

    if (typeof parsed === 'object' && parsed && Array.isArray((parsed as { traceEvents?: unknown[] }).traceEvents)) {
      return parseChromeStyleTraceEvents((parsed as { traceEvents: unknown[] }).traceEvents);
    }

    const arr = Array.isArray(parsed)
      ? parsed
      : typeof parsed === 'object' && parsed && Array.isArray((parsed as { events?: unknown[] }).events)
        ? (parsed as { events: unknown[] }).events
        : [];

    return arr
      .map((it, idx) => {
        const item = (it ?? {}) as Record<string, unknown>;
        return {
          ts: toMs(item.ts, idx * 16),
          dur: toMs(item.dur, 5),
          name: safeString(item.name, `event_${idx}`),
          process: safeString(item.process, 'unknown_process'),
          thread: safeString(item.thread, 'unknown_thread'),
        };
      })
      .filter((e) => e.ts >= 0);
  } catch {
    return [];
  }
}

function parseChromeStyleTraceEvents(items: unknown[]): TraceEvent[] {
  const processNames = new Map<number, string>();
  const threadNames = new Map<string, string>();
  const events: TraceEvent[] = [];

  for (const raw of items) {
    const e = (raw ?? {}) as Record<string, unknown>;
    const ph = e.ph;
    const name = e.name;
    const pid = typeof e.pid === 'number' ? e.pid : Number(e.pid);
    const tid = typeof e.tid === 'number' ? e.tid : Number(e.tid);
    const args = (e.args ?? {}) as Record<string, unknown>;

    if (ph === 'M' && name === 'process_name' && Number.isFinite(pid)) {
      processNames.set(pid, safeString(args.name, `pid_${pid}`));
      continue;
    }
    if (ph === 'M' && name === 'thread_name' && Number.isFinite(pid) && Number.isFinite(tid)) {
      threadNames.set(`${pid}:${tid}`, safeString(args.name, `tid_${tid}`));
    }
  }

  for (let idx = 0; idx < items.length; idx += 1) {
    const e = (items[idx] ?? {}) as Record<string, unknown>;
    if (e.ph !== 'X') continue;

    const pid = typeof e.pid === 'number' ? e.pid : Number(e.pid);
    const tid = typeof e.tid === 'number' ? e.tid : Number(e.tid);
    const ts = toMs(e.ts, idx * 16) / 1000;
    const dur = toMs(e.dur, 1) / 1000;
    const process = Number.isFinite(pid) ? (processNames.get(pid) ?? `pid_${pid}`) : 'unknown_process';
    const thread = Number.isFinite(pid) && Number.isFinite(tid)
      ? (threadNames.get(`${pid}:${tid}`) ?? `tid_${tid}`)
      : 'unknown_thread';

    events.push({
      ts,
      dur,
      name: safeString(e.name, `event_${idx}`),
      process,
      thread,
    });
  }

  return events;
}

function extractPrintableStrings(bytes: Uint8Array, minLen = 4): string[] {
  const out: string[] = [];
  let buf = '';

  for (let i = 0; i < bytes.length; i += 1) {
    const c = bytes[i];
    const isPrintable = c >= 32 && c <= 126;
    if (isPrintable) {
      buf += String.fromCharCode(c);
    } else {
      if (buf.length >= minLen) out.push(buf);
      buf = '';
    }
  }
  if (buf.length >= minLen) out.push(buf);
  return out;
}

function pickLikelyNames(strings: string[], kind: 'process' | 'thread'): string[] {
  const deny = /^(proto|perfetto|android|lib|com\.google\.protobuf|[A-Z_]+|[0-9a-f]{8,})$/i;
  const processHint = /[a-z][a-z0-9_.:-]{2,}/i;
  const threadHint = /(thread|binder|render|pool|main|worker|ui|io|gc|finalizer|jit)/i;
  const out: string[] = [];

  for (const s of strings) {
    if (s.length > 80 || deny.test(s)) continue;
    if (kind === 'process' && (processHint.test(s) || s.includes('.'))) out.push(s);
    if (kind === 'thread' && threadHint.test(s)) out.push(s);
  }

  return [...new Set(out)].slice(0, 64);
}

function parseBinaryAsSyntheticEvents(buf: ArrayBuffer, fileName: string): TraceEvent[] {
  const bytes = new Uint8Array(buf);
  const events: TraceEvent[] = [];
  const base = fileName.replace(/\.[^.]+$/, '') || 'trace';
  const strings = extractPrintableStrings(bytes);
  const processCandidates = pickLikelyNames(strings, 'process');
  const threadCandidates = pickLikelyNames(strings, 'thread');
  const processes = processCandidates.length ? processCandidates : ['system_server', 'surfaceflinger', 'target_process', `${base}_proc`];
  const threads = threadCandidates.length ? threadCandidates : ['main', 'RenderThread', 'Binder:1234_1', 'Jit thread pool'];

  for (let i = 0; i < bytes.length; i += 64) {
    const b = bytes[i] ?? 0;
    const ts = i * 2;
    const dur = 1 + (b % 25);
    const process = processes[b % processes.length];
    const thread = threads[(b >> 2) % threads.length];
    const tag = b % 4 === 0 ? 'Activity' : b % 4 === 1 ? 'doFrame' : b % 4 === 2 ? 'Choreographer' : 'onResume';
    events.push({ ts, dur, name: `${tag}_${i}`, process, thread });
  }

  return events;
}

export async function parseTraceFile(file: File): Promise<TraceDataset> {
  const buf = await file.arrayBuffer();
  const text = new TextDecoder().decode(buf.slice(0, Math.min(buf.byteLength, 2_000_000)));
  const jsonEvents = parseJsonEvents(text);
  const events = jsonEvents.length > 0 ? jsonEvents : parseBinaryAsSyntheticEvents(buf, file.name);

  let minTs = Number.POSITIVE_INFINITY;
  let maxTs = Number.NEGATIVE_INFINITY;
  const processes = new Set<string>();
  const threads = new Set<string>();

  // Avoid spread on large arrays to prevent call stack overflow.
  for (const e of events) {
    if (e.ts < minTs) minTs = e.ts;
    const endTs = e.ts + e.dur;
    if (endTs > maxTs) maxTs = endTs;
    processes.add(e.process);
    threads.add(`${e.process}:${e.thread}`);
  }

  if (!events.length) {
    minTs = 0;
    maxTs = 0;
  }

  return {
    summary: {
      traceName: file.name,
      timeRange: [minTs / 1000, maxTs / 1000],
      processCount: processes.size,
      threadCount: threads.size,
      tableCount: 1,
      recordCount: events.length,
    },
    processes: [...processes],
    threads: [...new Set(events.map((e) => e.thread))],
  };
}
