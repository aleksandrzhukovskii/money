import { useEffect, useState, useRef, useCallback } from 'react'
import initSqlJs, { type Database } from 'sql.js'
import { openDB } from 'idb'
import { runMigrations } from '@/db/migrations'
import schema from '@/db/schema.sql?raw'

const IDB_NAME = 'money-tracker'
const IDB_STORE = 'app-data'
const IDB_KEY = 'sqlite-db'

async function getIdb() {
  return openDB(IDB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE)
      }
    },
  })
}

async function loadFromIndexedDB(): Promise<Uint8Array | null> {
  const idb = await getIdb()
  const data = await idb.get(IDB_STORE, IDB_KEY)
  return data ?? null
}

async function saveToIndexedDB(data: Uint8Array): Promise<void> {
  const idb = await getIdb()
  await idb.put(IDB_STORE, data, IDB_KEY)
}

// Singleton state — shared across all hook instances
let dbInstance: Database | null = null
let initPromise: Promise<Database> | null = null

// Dirty flag — tracks whether local changes exist that haven't been synced
let _dirty = false
export function markDirty() { _dirty = true }
export function markClean() { _dirty = false }
export function isDirty() { return _dirty }

export function deleteLocalDatabase() {
  indexedDB.deleteDatabase(IDB_NAME)
}

export function getDb(): Database | null {
  return dbInstance
}

export function resetDatabase() {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
  initPromise = null
}

async function initDatabase(): Promise<Database> {
  const SQL = await initSqlJs({
    locateFile: (file: string) => `${import.meta.env.BASE_URL}${file}`,
  })

  const savedBytes = await loadFromIndexedDB()

  if (savedBytes) {
    const db = new SQL.Database(savedBytes)
    runMigrations(db)
    return db
  }

  const db = new SQL.Database()
  // Run schema as individual statements (split on semicolons)
  const statements = schema
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  for (const stmt of statements) {
    db.run(stmt)
  }

  // Persist the fresh database
  const bytes = db.export()
  await saveToIndexedDB(bytes)

  return db
}

export function useDatabase() {
  const [db, setDb] = useState<Database | null>(dbInstance)
  const [isReady, setIsReady] = useState(dbInstance !== null)
  const [error, setError] = useState<string | null>(null)
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (dbInstance) {
      setDb(dbInstance)
      setIsReady(true)
      return
    }

    if (!initPromise) {
      initPromise = initDatabase()
    }

    initPromise
      .then((instance) => {
        dbInstance = instance
        setDb(instance)
        setIsReady(true)
      })
      .catch((err) => {
        setError(String(err))
        console.error('Failed to initialize database:', err)
      })
  }, [])

  const persist = useCallback(async () => {
    if (!dbInstance) return
    const bytes = dbInstance.export()
    await saveToIndexedDB(bytes)
  }, [])

  // Debounced persist — call this after every write
  const persistDebounced = useCallback(() => {
    if (persistTimer.current) {
      clearTimeout(persistTimer.current)
    }
    persistTimer.current = setTimeout(async () => {
      _dirty = true
      await persist()
      window.dispatchEvent(new CustomEvent('db-persisted'))
    }, 500)
  }, [persist])

  const exportRaw = useCallback((): Uint8Array | null => {
    if (!dbInstance) return null
    return dbInstance.export()
  }, [])

  const importRaw = useCallback(async (bytes: Uint8Array) => {
    if (!dbInstance) return
    const SQL = await initSqlJs({
      locateFile: (file: string) => `${import.meta.env.BASE_URL}${file}`,
    })
    const newDb = new SQL.Database(bytes)
    runMigrations(newDb)

    // Replace singleton
    dbInstance.close()
    dbInstance = newDb
    setDb(newDb)

    await saveToIndexedDB(bytes)
  }, [])

  return { db, isReady, error, persist, persistDebounced, exportRaw, importRaw }
}
