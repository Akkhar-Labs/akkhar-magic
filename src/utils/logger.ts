/**
 * Akkhar-Magic :: Logger
 * =======================
 * Structured console logger with color-coded severity levels.
 * Zero external dependencies — chalk is used only for terminal color.
 */

import chalk from 'chalk';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

const LEVEL_COLORS: Record<LogLevel, (s: string) => string> = {
  debug: chalk.gray,
  info: chalk.cyan,
  warn: chalk.yellow,
  error: chalk.red,
  fatal: chalk.bgRed.white,
};

const COMPONENT_COLOR = chalk.magenta;

let currentLevel: LogLevel = (process.env.AKKHAR_LOG_LEVEL as LogLevel) ?? 'info';

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel];
}

function formatTimestamp(): string {
  return chalk.gray(new Date().toISOString().slice(11, 23));
}

function log(level: LogLevel, component: string, message: string, data?: unknown): void {
  if (!shouldLog(level)) return;

  const timestamp = formatTimestamp();
  const levelTag = LEVEL_COLORS[level](`[${level.toUpperCase().padEnd(5)}]`);
  const componentTag = COMPONENT_COLOR(`[${component}]`);

  const parts = [timestamp, levelTag, componentTag, message];
  console.log(parts.join(' '));

  if (data !== undefined) {
    console.log(chalk.gray(JSON.stringify(data, null, 2)));
  }
}

/**
 * Creates a scoped logger for a specific component.
 */
export function createLogger(component: string) {
  return {
    debug: (msg: string, data?: unknown) => log('debug', component, msg, data),
    info: (msg: string, data?: unknown) => log('info', component, msg, data),
    warn: (msg: string, data?: unknown) => log('warn', component, msg, data),
    error: (msg: string, data?: unknown) => log('error', component, msg, data),
    fatal: (msg: string, data?: unknown) => log('fatal', component, msg, data),
  };
}
