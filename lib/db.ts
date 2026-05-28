const DB_NAME = 'zenith'
const DB_VERSION = 1

export type Task = {
  id: string
  title: string
  urgent: boolean
  completed: boolean
  dueDate?: string
  createdAt: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains('tasks')) {
        const store = db.createObjectStore('tasks', { keyPath: 'id' })
        store.createIndex('urgent', 'urgent', { unique: false })
        store.createIndex('completed', 'completed', { unique: false })
      }
    }
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result)
    req.onerror = (e) => reject((e.target as IDBOpenDBRequest).error)
  })
}

export async function getUrgentTasks(): Promise<Task[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tasks', 'readonly')
    const store = tx.objectStore('tasks')
    const req = store.getAll()
    req.onsuccess = () => {
      resolve((req.result as Task[]).filter((t) => t.urgent && !t.completed))
    }
    req.onerror = () => reject(req.error)
  })
}

export async function addTask(task: Omit<Task, 'id' | 'createdAt'>): Promise<Task> {
  const db = await openDB()
  const full: Task = { ...task, id: crypto.randomUUID(), createdAt: Date.now() }
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tasks', 'readwrite')
    const store = tx.objectStore('tasks')
    const req = store.add(full)
    req.onsuccess = () => resolve(full)
    req.onerror = () => reject(req.error)
  })
}

export async function completeTask(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tasks', 'readwrite')
    const store = tx.objectStore('tasks')
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      const task = getReq.result as Task
      if (!task) return resolve()
      const putReq = store.put({ ...task, completed: true })
      putReq.onsuccess = () => resolve()
      putReq.onerror = () => reject(putReq.error)
    }
    getReq.onerror = () => reject(getReq.error)
  })
}
