/**
 * A fake of the one Supabase table cloud sync uses — `zenith_snapshots` —
 * shared by the sync tests. It behaves like the real one where it
 * matters: row-level security by account, `updated_at` stamped by the
 * server on every write, and a primary key that refuses a second insert.
 *
 * Use with:  jest.mock('@/lib/supabase', () => require('./fakeCloud').supabaseModule)
 */

/* ── A fake zenith_snapshots table ─────────────────────────────────── */

export interface Row {
  user_id: string; payload: unknown; schema_version: number | null
  device_label: string | null; updated_at: string
}

export const cloud = {
  row: null as Row | null,
  signedIn: 'user-A' as string | null,
  clock: Date.UTC(2026, 8, 26, 9, 0, 0),
  /* Lets a test simulate another device writing mid-operation. */
  beforeWrite: null as null | (() => void),
  stamp() { this.clock += 1000; return new Date(this.clock).toISOString() },
}

type Filter = [string, unknown]

class Query {
  private filters: Filter[] = []
  private cols = ''
  constructor(private op: 'select' | 'update' | 'insert', private body?: Record<string, unknown>) {}
  select(cols: string) { this.cols = cols; return this }
  eq(col: string, val: unknown) { this.filters.push([col, val]); return this }

  private visible(): Row | null {
    const r = cloud.row
    if (!r || r.user_id !== cloud.signedIn) return null            // RLS
    for (const [c, v] of this.filters) {
      if (c === 'updated_at' ? Date.parse(String(v)) !== Date.parse(r.updated_at) : (r as never)[c] !== v) return null
    }
    return r
  }
  private pick(r: Row) {
    const out: Record<string, unknown> = {}
    for (const c of this.cols.split(',').map(x => x.trim()).filter(Boolean)) {
      /* alias:column->>key — a text value out of a jsonb column, as PostgREST does. */
      const m = /^(\w+):(\w+)(->>?)(\w+)$/.exec(c)
      if (m) {
        const v = ((r as never)[m[2]] as Record<string, unknown> | null)?.[m[4]]
        /* ->> is text; -> is the JSON value itself. */
        out[m[1]] = v === undefined || v === null ? null : m[3] === '->>' ? String(v) : v
      } else {
        out[c] = (r as never)[c]
      }
    }
    return out
  }
  private run(): { data: unknown; error: { message: string } | null } {
    if (this.op === 'select') {
      const r = this.visible()
      return { data: r ? this.pick(r) : null, error: null }
    }
    cloud.beforeWrite?.(); cloud.beforeWrite = null
    if (this.op === 'update') {
      const r = this.visible()
      if (!r) return { data: [], error: null }
      Object.assign(r, this.body, { updated_at: cloud.stamp() })   // trigger
      return { data: [this.pick(r)], error: null }
    }
    /* insert */
    if (cloud.row) return { data: null, error: { message: 'duplicate key value violates unique constraint' } }
    if (this.body!.user_id !== cloud.signedIn) return { data: null, error: { message: 'row-level security' } }
    cloud.row = { ...(this.body as unknown as Row), updated_at: cloud.stamp() }
    return { data: this.pick(cloud.row), error: null }
  }
  maybeSingle() { return Promise.resolve(this.run()) }
  single()      { return Promise.resolve(this.run()) }
  then<T>(res: (v: { data: unknown; error: { message: string } | null }) => T) { return Promise.resolve(this.run()).then(res) }
}

export const supabaseModule = {
  isSupabaseConfigured: true,
  getSupabaseClient: () => ({
    auth: { getSession: async () => ({ data: { session: cloud.signedIn ? { user: { id: cloud.signedIn } } : null } }) },
    from: () => ({
      select: (cols: string) => new Query('select').select(cols),
      update: (body: Record<string, unknown>) => new Query('update', body),
      insert: (body: Record<string, unknown>) => new Query('insert', body),
    }),
  }),
}


/** A reset to call in beforeEach. */
export function resetCloud(signedIn: string | null = 'user-A') {
  cloud.row = null
  cloud.signedIn = signedIn
  cloud.beforeWrite = null
}
