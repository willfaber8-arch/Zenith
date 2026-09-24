/**
 * Every module the app can reach has to be findable by searching for it.
 *
 * `MODULE_REGISTRY` (lib/modules.ts) says what exists; `MODULE_INDEX`
 * (lib/moduleSearch.ts) says what the command palette and the topbar
 * search can find. They are two hand-maintained lists of the same
 * thing, so they drifted: Notes and the Engineering Toolkit were
 * shipped, navigable, and completely unsearchable — typing "notes"
 * returned nothing.
 *
 * Keeping them in one list would be better, but the index carries
 * search keywords the registry has no business knowing about. So the
 * lists stay separate and this test is the thing that stops them
 * drifting: add a module without indexing it and this fails, naming
 * the module you forgot.
 */

import { MODULE_REGISTRY } from '@/lib/modules'
import { MODULE_INDEX } from '@/lib/moduleSearch'
import { searchModules } from '@/lib/moduleSearch'

const registryIds = MODULE_REGISTRY.map(m => m.id).sort()
const indexIds    = MODULE_INDEX.map(m => m.id).sort()

describe('the search index and the module registry', () => {
  it('cover exactly the same modules', () => {
    expect(indexIds).toEqual(registryIds)
  })

  it('names any module that exists but cannot be searched for', () => {
    const unsearchable = registryIds.filter(id => !indexIds.includes(id))
    expect(unsearchable).toEqual([])
  })

  it('names any indexed module that no longer exists', () => {
    const orphaned = indexIds.filter(id => !registryIds.includes(id))
    expect(orphaned).toEqual([])
  })
})

describe('the two that were missing', () => {
  it('finds Notes by name', () => {
    expect(searchModules('notes').map(m => m.id)).toContain('notes')
  })

  it('finds the Engineering Toolkit by name and by what it does', () => {
    expect(searchModules('toolkit').map(m => m.id)).toContain('toolkit')
    expect(searchModules('convert').map(m => m.id)).toContain('toolkit')
  })
})

describe('every indexed module is actually reachable', () => {
  /*
   * A search result that goes nowhere is worse than no result. Each
   * entry's label should find its own module.
   */
  it.each(MODULE_INDEX.map(m => [m.id, m.label] as const))(
    'finds %s by its own label', (id, label) => {
      expect(searchModules(label).map(m => m.id)).toContain(id)
    },
  )
})
