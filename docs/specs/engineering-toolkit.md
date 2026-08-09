# Engineering Toolkit — Module Spec

**Status:** draft · **Surface:** new module `toolkit` · **Data:** none

---

## 1. What this is

Two reference tools an engineering student reaches for mid-problem:

- **Unit conversion** — across the dimensions that actually come up
  (length, mass, force, pressure, energy, power, temperature, angle,
  volume, flow, torque, area, velocity, data)
- **Formula reference** — searchable, with variables named and units given

It is the only planned module with no existing overlap and no data layer.
That makes it the cheapest real exercise of the module registry: if adding
it needs edits beyond one registry entry and one view, the registry is
wrong.

---

## 2. No persistence

Nothing here is user data. Conversions are stateless; formulas are static
content. No Dexie tables, no localStorage beyond a "last used dimension"
convenience, no network.

Consequence: it works offline, needs no backup coverage, and cannot break
the cloud snapshot.

---

## 3. Unit conversion

`utils/unitConversion.ts` — pure, testable, zero dependencies.

```ts
export interface Unit {
  id:     string    // 'm', 'ft', 'psi'
  label:  string    // 'metre'
  /** Factor to the dimension's SI base unit. */
  factor: number
  /** Offset, for scales that don't share an origin (°C, °F). */
  offset?: number
}

export interface Dimension {
  id:    string     // 'length'
  label: string
  base:  string     // unit id treated as base
  units: Unit[]
}

export function convert(value: number, from: Unit, to: Unit): number
```

**Temperature is the reason `offset` exists.** °C → °F is not a ratio, and
a factor-only model silently produces nonsense for exactly the conversion
students use most. Convert through the base as
`(v + from.offset) * from.factor` → `/ to.factor - to.offset`.

**Precision:** display with significant-figure control rather than fixed
decimals — `0.000012 m` should not render as `0.00`. Keep full precision
internally; round only at render.

### UI

Two-column picker with a live result, dimension tabs across the top, and a
swap control. Copy-to-clipboard on the result — the whole point is getting
a number into something else.

---

## 4. Formula reference

`data/formulas.ts` — a static array, same pattern as `data/trails.ts`.

```ts
export interface Formula {
  id:         string
  name:       string          // 'Ideal Gas Law'
  category:   string          // 'Thermodynamics'
  expression: string          // LaTeX: 'PV = nRT'
  variables:  { symbol: string; meaning: string; unit?: string }[]
  note?:      string          // assumptions, when it does not apply
  tags:       string[]        // search terms
}
```

Initial coverage — roughly 60 entries across Statics, Dynamics, Thermo,
Fluids, Circuits, Materials, Calculus/Series, Probability.

`note` is not decoration. A formula without its assumptions is a trap;
ideal-gas without "ideal gas, no intermolecular forces" invites misuse.

### Rendering

LaTeX via KaTeX. **Shares the loader built in Phase 3** — whichever module
loads first pays the download, the other gets it free. If the Toolkit
lands before Study Companion it introduces the lazy KaTeX wrapper and
Study Companion reuses it.

### Search

Client-side across `name`, `category`, `tags` and variable meanings.
No fuzzy matching library — a `toLowerCase().includes()` over 60 rows is
instant and predictable.

---

## 5. Registry entry

```ts
{
  id: 'toolkit', label: 'Engineering Toolkit',
  description: 'Unit conversion and a searchable formula reference.',
  icon: 'Wrench', color: '#38bdf8', enabled: true,
  nav: { category: 'essentials', group: 'scholastic', order: 3 },
  widgets: [],
}
```

Scholastic, after Vocab Builder. **No dashboard widget** — there is no
state to summarise, and a widget that just links somewhere is clutter.
This is the case the registry's optional `widgets: []` exists for.

---

## 6. Build order

1. `unitConversion.ts` + tests (temperature offsets, round-tripping,
   significant figures)
2. Converter UI
3. `formulas.ts` dataset
4. Formula browser + search
5. KaTeX rendering (shared loader)

---

## 7. Out of scope

- Symbolic algebra or equation solving
- User-defined formulas or units
- Unit-aware arithmetic across a whole expression
- Currency (rates need a network call; wrong module)
