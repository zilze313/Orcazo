// Minimal structured logger. Swap to pino/winston in prod if needed.
type Level = 'info' | 'warn' | 'error' | 'debug';

function emit(level: Level, msg: string, meta?: Record<string, unknown>) {
  const line = JSON.stringify({
    t: new Date().toISOString(),
    lvl: level,
    msg,
    ...(meta ?? {}),
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const log = {
  info:  (msg: string, meta?: Record<string, unknown>) => emit('info', msg, meta),
  warn:  (msg: string, meta?: Record<string, unknown>) => emit('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit('error', msg, meta),
  debug: (msg: string, meta?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== 'production') emit('debug', msg, meta);
  },
};
