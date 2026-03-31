// Offline buffer — queues failed API writes to local SQLite and flushes on reconnect
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { logger } from './logger'

const DB_PATH = path.join(process.cwd(), 'worker-buffer.db')

let db: Database.Database

export function initBuffer() {
  db = new Database(DB_PATH)
  db.exec(`
    CREATE TABLE IF NOT EXISTS pending_writes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL,
      method TEXT NOT NULL DEFAULT 'POST',
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      attempts INTEGER NOT NULL DEFAULT 0
    )
  `)
  logger.info(`[buffer] SQLite buffer ready at ${DB_PATH}`)
}

export function enqueue(endpoint: string, method: 'POST' | 'PATCH', body: object) {
  if (!db) initBuffer()
  db.prepare(
    'INSERT INTO pending_writes (endpoint, method, body) VALUES (?, ?, ?)'
  ).run(endpoint, method, JSON.stringify(body))
  logger.warn(`[buffer] Queued ${method} ${endpoint} (offline)`)
}

export function getPending(): Array<{ id: number; endpoint: string; method: string; body: string }> {
  if (!db) initBuffer()
  return db.prepare(
    'SELECT id, endpoint, method, body FROM pending_writes ORDER BY id ASC LIMIT 50'
  ).all() as any[]
}

export function markFlushed(id: number) {
  if (!db) return
  db.prepare('DELETE FROM pending_writes WHERE id = ?').run(id)
}

export function incrementAttempts(id: number) {
  if (!db) return
  db.prepare('UPDATE pending_writes SET attempts = attempts + 1 WHERE id = ?').run(id)
}

export function getPendingCount(): number {
  if (!db) initBuffer()
  const row = db.prepare('SELECT COUNT(*) as n FROM pending_writes').get() as { n: number }
  return row.n
}
