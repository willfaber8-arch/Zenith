/**
 * data/formulas.ts — engineering formula reference.
 *
 * Static content, same pattern as data/trails.ts. No persistence, no
 * network.
 *
 * `note` is not decoration. A formula without its assumptions is a trap —
 * ideal-gas without "ideal gas, no intermolecular forces" invites misuse,
 * and Bernoulli without "incompressible, inviscid, along a streamline" is
 * actively dangerous in a design context. Every entry that has conditions
 * states them.
 */

export interface FormulaVariable {
  symbol:  string
  meaning: string
  unit?:   string
}

export interface Formula {
  id:         string
  name:       string
  category:   string
  /** Plain-text expression. Rendered as-is; no LaTeX dependency yet. */
  expression: string
  variables:  FormulaVariable[]
  note?:      string
  tags:       string[]
}

export const FORMULA_CATEGORIES = [
  'Statics', 'Dynamics', 'Thermodynamics', 'Fluids',
  'Circuits', 'Materials', 'Mathematics', 'Probability',
] as const

export const FORMULAS: readonly Formula[] = [
  /* ── Statics ─────────────────────────────────────────────── */
  { id: 'moment', name: 'Moment of a Force', category: 'Statics',
    expression: 'M = F · d',
    variables: [
      { symbol: 'M', meaning: 'moment about a point', unit: 'N·m' },
      { symbol: 'F', meaning: 'applied force', unit: 'N' },
      { symbol: 'd', meaning: 'perpendicular distance to the line of action', unit: 'm' },
    ],
    note: 'd is the PERPENDICULAR distance, not the distance along the member.',
    tags: ['torque', 'moment', 'lever', 'equilibrium'] },

  { id: 'equilibrium', name: 'Static Equilibrium', category: 'Statics',
    expression: 'ΣF = 0,  ΣM = 0',
    variables: [
      { symbol: 'ΣF', meaning: 'vector sum of all forces', unit: 'N' },
      { symbol: 'ΣM', meaning: 'sum of moments about any point', unit: 'N·m' },
    ],
    note: 'Both must hold in every direction. Moments can be summed about ANY point — choose one that eliminates unknowns.',
    tags: ['equilibrium', 'statics', 'free body'] },

  { id: 'centroid', name: 'Centroid of a Composite Area', category: 'Statics',
    expression: 'x̄ = Σ(Aᵢ·x̄ᵢ) / ΣAᵢ',
    variables: [
      { symbol: 'x̄',  meaning: 'centroid coordinate', unit: 'm' },
      { symbol: 'Aᵢ', meaning: 'area of part i', unit: 'm²' },
      { symbol: 'x̄ᵢ', meaning: 'centroid of part i', unit: 'm' },
    ],
    note: 'Subtract areas for holes — use a negative Aᵢ.',
    tags: ['centroid', 'area', 'composite'] },

  { id: 'friction', name: 'Dry Friction', category: 'Statics',
    expression: 'F_f ≤ μ · N',
    variables: [
      { symbol: 'F_f', meaning: 'friction force', unit: 'N' },
      { symbol: 'μ',   meaning: 'coefficient of friction' },
      { symbol: 'N',   meaning: 'normal force', unit: 'N' },
    ],
    note: 'Equality holds only at impending slip. Below that, friction takes whatever value equilibrium requires.',
    tags: ['friction', 'slip', 'normal force'] },

  /* ── Dynamics ────────────────────────────────────────────── */
  { id: 'newton2', name: "Newton's Second Law", category: 'Dynamics',
    expression: 'F = m · a',
    variables: [
      { symbol: 'F', meaning: 'net force', unit: 'N' },
      { symbol: 'm', meaning: 'mass', unit: 'kg' },
      { symbol: 'a', meaning: 'acceleration', unit: 'm/s²' },
    ],
    note: 'F is the NET force. Constant mass only — use F = dp/dt otherwise.',
    tags: ['newton', 'force', 'acceleration'] },

  { id: 'kinematic-v', name: 'Kinematics — Velocity', category: 'Dynamics',
    expression: 'v = v₀ + a·t',
    variables: [
      { symbol: 'v',  meaning: 'final velocity', unit: 'm/s' },
      { symbol: 'v₀', meaning: 'initial velocity', unit: 'm/s' },
      { symbol: 'a',  meaning: 'acceleration', unit: 'm/s²' },
      { symbol: 't',  meaning: 'elapsed time', unit: 's' },
    ],
    note: 'Constant acceleration only.',
    tags: ['kinematics', 'suvat', 'velocity'] },

  { id: 'kinematic-s', name: 'Kinematics — Displacement', category: 'Dynamics',
    expression: 's = v₀·t + ½·a·t²',
    variables: [
      { symbol: 's',  meaning: 'displacement', unit: 'm' },
      { symbol: 'v₀', meaning: 'initial velocity', unit: 'm/s' },
      { symbol: 'a',  meaning: 'acceleration', unit: 'm/s²' },
      { symbol: 't',  meaning: 'elapsed time', unit: 's' },
    ],
    note: 'Constant acceleration only.',
    tags: ['kinematics', 'suvat', 'displacement'] },

  { id: 'kinematic-v2', name: 'Kinematics — Timeless', category: 'Dynamics',
    expression: 'v² = v₀² + 2·a·s',
    variables: [
      { symbol: 'v',  meaning: 'final velocity', unit: 'm/s' },
      { symbol: 'v₀', meaning: 'initial velocity', unit: 'm/s' },
      { symbol: 'a',  meaning: 'acceleration', unit: 'm/s²' },
      { symbol: 's',  meaning: 'displacement', unit: 'm' },
    ],
    note: 'Use when time is unknown. Constant acceleration only.',
    tags: ['kinematics', 'suvat'] },

  { id: 'ke', name: 'Kinetic Energy', category: 'Dynamics',
    expression: 'KE = ½·m·v²',
    variables: [
      { symbol: 'KE', meaning: 'kinetic energy', unit: 'J' },
      { symbol: 'm',  meaning: 'mass', unit: 'kg' },
      { symbol: 'v',  meaning: 'speed', unit: 'm/s' },
    ],
    tags: ['energy', 'kinetic'] },

  { id: 'pe', name: 'Gravitational Potential Energy', category: 'Dynamics',
    expression: 'PE = m·g·h',
    variables: [
      { symbol: 'PE', meaning: 'potential energy', unit: 'J' },
      { symbol: 'm',  meaning: 'mass', unit: 'kg' },
      { symbol: 'g',  meaning: 'gravitational acceleration', unit: '9.81 m/s²' },
      { symbol: 'h',  meaning: 'height above datum', unit: 'm' },
    ],
    note: 'Near-surface approximation — g is not constant at altitude.',
    tags: ['energy', 'potential', 'gravity'] },

  { id: 'momentum', name: 'Linear Momentum', category: 'Dynamics',
    expression: 'p = m · v',
    variables: [
      { symbol: 'p', meaning: 'momentum', unit: 'kg·m/s' },
      { symbol: 'm', meaning: 'mass', unit: 'kg' },
      { symbol: 'v', meaning: 'velocity', unit: 'm/s' },
    ],
    note: 'Conserved in a closed system — true even when energy is not.',
    tags: ['momentum', 'collision', 'conservation'] },

  { id: 'shm', name: 'Simple Harmonic Motion', category: 'Dynamics',
    expression: 'ω = √(k/m),  T = 2π/ω',
    variables: [
      { symbol: 'ω', meaning: 'angular frequency', unit: 'rad/s' },
      { symbol: 'k', meaning: 'spring constant', unit: 'N/m' },
      { symbol: 'm', meaning: 'mass', unit: 'kg' },
      { symbol: 'T', meaning: 'period', unit: 's' },
    ],
    note: 'Undamped, small-displacement, linear spring.',
    tags: ['oscillation', 'spring', 'frequency', 'period'] },

  /* ── Thermodynamics ──────────────────────────────────────── */
  { id: 'ideal-gas', name: 'Ideal Gas Law', category: 'Thermodynamics',
    expression: 'P·V = n·R·T',
    variables: [
      { symbol: 'P', meaning: 'absolute pressure', unit: 'Pa' },
      { symbol: 'V', meaning: 'volume', unit: 'm³' },
      { symbol: 'n', meaning: 'amount of substance', unit: 'mol' },
      { symbol: 'R', meaning: 'gas constant', unit: '8.314 J/(mol·K)' },
      { symbol: 'T', meaning: 'absolute temperature', unit: 'K' },
    ],
    note: 'Ideal gas only — no intermolecular forces, negligible molecular volume. Breaks down at high pressure or near condensation. T and P must be ABSOLUTE.',
    tags: ['gas', 'pressure', 'volume', 'temperature'] },

  { id: 'first-law', name: 'First Law of Thermodynamics', category: 'Thermodynamics',
    expression: 'ΔU = Q − W',
    variables: [
      { symbol: 'ΔU', meaning: 'change in internal energy', unit: 'J' },
      { symbol: 'Q',  meaning: 'heat added TO the system', unit: 'J' },
      { symbol: 'W',  meaning: 'work done BY the system', unit: 'J' },
    ],
    note: 'Sign convention matters and varies by textbook — some write ΔU = Q + W with W done ON the system.',
    tags: ['energy', 'heat', 'work', 'conservation'] },

  { id: 'sensible-heat', name: 'Sensible Heat', category: 'Thermodynamics',
    expression: 'Q = m·c·ΔT',
    variables: [
      { symbol: 'Q',  meaning: 'heat transferred', unit: 'J' },
      { symbol: 'm',  meaning: 'mass', unit: 'kg' },
      { symbol: 'c',  meaning: 'specific heat capacity', unit: 'J/(kg·K)' },
      { symbol: 'ΔT', meaning: 'temperature change', unit: 'K' },
    ],
    note: 'No phase change. Use latent heat (Q = m·L) across a transition.',
    tags: ['heat', 'temperature', 'specific heat'] },

  { id: 'carnot', name: 'Carnot Efficiency', category: 'Thermodynamics',
    expression: 'η = 1 − T_c / T_h',
    variables: [
      { symbol: 'η',   meaning: 'maximum thermal efficiency' },
      { symbol: 'T_c', meaning: 'cold reservoir temperature', unit: 'K' },
      { symbol: 'T_h', meaning: 'hot reservoir temperature', unit: 'K' },
    ],
    note: 'Theoretical ceiling — no real engine reaches it. Temperatures MUST be in kelvin.',
    tags: ['efficiency', 'engine', 'carnot'] },

  { id: 'conduction', name: 'Fourier Conduction', category: 'Thermodynamics',
    expression: 'q = −k·A·(dT/dx)',
    variables: [
      { symbol: 'q',     meaning: 'heat transfer rate', unit: 'W' },
      { symbol: 'k',     meaning: 'thermal conductivity', unit: 'W/(m·K)' },
      { symbol: 'A',     meaning: 'cross-sectional area', unit: 'm²' },
      { symbol: 'dT/dx', meaning: 'temperature gradient', unit: 'K/m' },
    ],
    note: 'The minus sign is physical: heat flows down the gradient.',
    tags: ['heat transfer', 'conduction', 'fourier'] },

  /* ── Fluids ──────────────────────────────────────────────── */
  { id: 'bernoulli', name: "Bernoulli's Equation", category: 'Fluids',
    expression: 'P + ½·ρ·v² + ρ·g·h = constant',
    variables: [
      { symbol: 'P', meaning: 'static pressure', unit: 'Pa' },
      { symbol: 'ρ', meaning: 'fluid density', unit: 'kg/m³' },
      { symbol: 'v', meaning: 'flow velocity', unit: 'm/s' },
      { symbol: 'h', meaning: 'elevation', unit: 'm' },
    ],
    note: 'Incompressible, inviscid, steady flow, ALONG A STREAMLINE. Not valid across a pump, through a shock, or where viscous losses matter.',
    tags: ['bernoulli', 'pressure', 'flow', 'streamline'] },

  { id: 'continuity', name: 'Continuity Equation', category: 'Fluids',
    expression: 'A₁·v₁ = A₂·v₂',
    variables: [
      { symbol: 'A', meaning: 'cross-sectional area', unit: 'm²' },
      { symbol: 'v', meaning: 'mean velocity', unit: 'm/s' },
    ],
    note: 'Incompressible, steady flow. Use ρ₁A₁v₁ = ρ₂A₂v₂ for compressible.',
    tags: ['continuity', 'flow rate', 'mass conservation'] },

  { id: 'reynolds', name: 'Reynolds Number', category: 'Fluids',
    expression: 'Re = ρ·v·L / μ',
    variables: [
      { symbol: 'Re', meaning: 'Reynolds number (dimensionless)' },
      { symbol: 'ρ',  meaning: 'density', unit: 'kg/m³' },
      { symbol: 'v',  meaning: 'characteristic velocity', unit: 'm/s' },
      { symbol: 'L',  meaning: 'characteristic length', unit: 'm' },
      { symbol: 'μ',  meaning: 'dynamic viscosity', unit: 'Pa·s' },
    ],
    note: 'In a pipe: laminar below ~2300, turbulent above ~4000. L is the diameter for pipe flow.',
    tags: ['reynolds', 'turbulence', 'laminar', 'viscosity'] },

  { id: 'hydrostatic', name: 'Hydrostatic Pressure', category: 'Fluids',
    expression: 'P = ρ·g·h',
    variables: [
      { symbol: 'P', meaning: 'gauge pressure at depth', unit: 'Pa' },
      { symbol: 'ρ', meaning: 'fluid density', unit: 'kg/m³' },
      { symbol: 'h', meaning: 'depth below surface', unit: 'm' },
    ],
    note: 'Gauge pressure. Add atmospheric for absolute. Constant density assumed.',
    tags: ['pressure', 'depth', 'hydrostatic'] },

  /* ── Circuits ────────────────────────────────────────────── */
  { id: 'ohm', name: "Ohm's Law", category: 'Circuits',
    expression: 'V = I · R',
    variables: [
      { symbol: 'V', meaning: 'voltage across the element', unit: 'V' },
      { symbol: 'I', meaning: 'current through it', unit: 'A' },
      { symbol: 'R', meaning: 'resistance', unit: 'Ω' },
    ],
    note: 'Ohmic components only — does not hold for diodes or transistors.',
    tags: ['ohm', 'voltage', 'current', 'resistance'] },

  { id: 'power-elec', name: 'Electrical Power', category: 'Circuits',
    expression: 'P = V·I = I²·R = V²/R',
    variables: [
      { symbol: 'P', meaning: 'power dissipated', unit: 'W' },
      { symbol: 'V', meaning: 'voltage', unit: 'V' },
      { symbol: 'I', meaning: 'current', unit: 'A' },
      { symbol: 'R', meaning: 'resistance', unit: 'Ω' },
    ],
    note: 'The I²R and V²/R forms assume a purely resistive load.',
    tags: ['power', 'dissipation', 'joule heating'] },

  { id: 'series-parallel', name: 'Series & Parallel Resistance', category: 'Circuits',
    expression: 'R_s = ΣRᵢ    1/R_p = Σ(1/Rᵢ)',
    variables: [
      { symbol: 'R_s', meaning: 'series equivalent', unit: 'Ω' },
      { symbol: 'R_p', meaning: 'parallel equivalent', unit: 'Ω' },
    ],
    note: 'Capacitors are the reverse: they add in parallel, reciprocate in series.',
    tags: ['resistance', 'series', 'parallel', 'equivalent'] },

  { id: 'rc-time', name: 'RC Time Constant', category: 'Circuits',
    expression: 'τ = R·C',
    variables: [
      { symbol: 'τ', meaning: 'time constant', unit: 's' },
      { symbol: 'R', meaning: 'resistance', unit: 'Ω' },
      { symbol: 'C', meaning: 'capacitance', unit: 'F' },
    ],
    note: 'One τ reaches ~63% of final value; ~99% at 5τ.',
    tags: ['rc', 'time constant', 'charging', 'capacitor'] },

  { id: 'kirchhoff', name: "Kirchhoff's Laws", category: 'Circuits',
    expression: 'ΣI_in = ΣI_out,   ΣV_loop = 0',
    variables: [
      { symbol: 'ΣI', meaning: 'currents at a node', unit: 'A' },
      { symbol: 'ΣV', meaning: 'voltages around a closed loop', unit: 'V' },
    ],
    note: 'Current law is charge conservation; voltage law is energy conservation.',
    tags: ['kirchhoff', 'node', 'loop', 'kcl', 'kvl'] },

  /* ── Materials ───────────────────────────────────────────── */
  { id: 'stress', name: 'Normal Stress', category: 'Materials',
    expression: 'σ = F / A',
    variables: [
      { symbol: 'σ', meaning: 'normal stress', unit: 'Pa' },
      { symbol: 'F', meaning: 'axial force', unit: 'N' },
      { symbol: 'A', meaning: 'cross-sectional area', unit: 'm²' },
    ],
    note: 'Uniform distribution assumed — not valid near holes, notches or point loads.',
    tags: ['stress', 'axial', 'tension', 'compression'] },

  { id: 'strain', name: 'Engineering Strain', category: 'Materials',
    expression: 'ε = ΔL / L₀',
    variables: [
      { symbol: 'ε',  meaning: 'strain (dimensionless)' },
      { symbol: 'ΔL', meaning: 'change in length', unit: 'm' },
      { symbol: 'L₀', meaning: 'original length', unit: 'm' },
    ],
    note: 'Engineering strain uses the ORIGINAL length — diverges from true strain at large deformation.',
    tags: ['strain', 'deformation', 'elongation'] },

  { id: 'hooke', name: "Hooke's Law", category: 'Materials',
    expression: 'σ = E · ε',
    variables: [
      { symbol: 'σ', meaning: 'stress', unit: 'Pa' },
      { symbol: 'E', meaning: "Young's modulus", unit: 'Pa' },
      { symbol: 'ε', meaning: 'strain' },
    ],
    note: 'Elastic region ONLY. Past yield the relationship is no longer linear and this gives a wrong answer.',
    tags: ['hooke', 'elastic', 'modulus', 'stiffness'] },

  { id: 'beam-bending', name: 'Beam Bending Stress', category: 'Materials',
    expression: 'σ = M·y / I',
    variables: [
      { symbol: 'σ', meaning: 'bending stress', unit: 'Pa' },
      { symbol: 'M', meaning: 'bending moment', unit: 'N·m' },
      { symbol: 'y', meaning: 'distance from neutral axis', unit: 'm' },
      { symbol: 'I', meaning: 'second moment of area', unit: 'm⁴' },
    ],
    note: 'Maximum at the outer fibre. Assumes linear-elastic, initially straight, symmetric cross-section.',
    tags: ['bending', 'beam', 'flexure', 'moment of inertia'] },

  { id: 'torsion', name: 'Torsional Shear Stress', category: 'Materials',
    expression: 'τ = T·r / J',
    variables: [
      { symbol: 'τ', meaning: 'shear stress', unit: 'Pa' },
      { symbol: 'T', meaning: 'applied torque', unit: 'N·m' },
      { symbol: 'r', meaning: 'radial distance from centre', unit: 'm' },
      { symbol: 'J', meaning: 'polar moment of area', unit: 'm⁴' },
    ],
    note: 'Circular cross-sections only. Non-circular sections warp and need a different treatment.',
    tags: ['torsion', 'shear', 'shaft', 'torque'] },

  { id: 'euler-buckling', name: 'Euler Buckling Load', category: 'Materials',
    expression: 'P_cr = π²·E·I / (K·L)²',
    variables: [
      { symbol: 'P_cr', meaning: 'critical buckling load', unit: 'N' },
      { symbol: 'E',    meaning: "Young's modulus", unit: 'Pa' },
      { symbol: 'I',    meaning: 'minimum second moment of area', unit: 'm⁴' },
      { symbol: 'K',    meaning: 'effective length factor' },
      { symbol: 'L',    meaning: 'unsupported length', unit: 'm' },
    ],
    note: 'Long slender columns only. K = 1 pinned-pinned, 0.5 fixed-fixed, 2 fixed-free. Use the SMALLEST I.',
    tags: ['buckling', 'column', 'euler', 'stability'] },

  /* ── Mathematics ─────────────────────────────────────────── */
  { id: 'quadratic', name: 'Quadratic Formula', category: 'Mathematics',
    expression: 'x = (−b ± √(b² − 4ac)) / 2a',
    variables: [
      { symbol: 'a, b, c', meaning: 'coefficients of ax² + bx + c = 0' },
    ],
    note: 'The discriminant b² − 4ac tells you the root type: positive → two real, zero → repeated, negative → complex pair.',
    tags: ['quadratic', 'roots', 'algebra'] },

  { id: 'taylor', name: 'Taylor Series', category: 'Mathematics',
    expression: 'f(x) ≈ Σ f⁽ⁿ⁾(a)·(x−a)ⁿ / n!',
    variables: [
      { symbol: 'a', meaning: 'expansion point' },
      { symbol: 'n', meaning: 'term index' },
    ],
    note: 'Accuracy falls away from a. Maclaurin is the special case a = 0.',
    tags: ['taylor', 'series', 'expansion', 'approximation'] },

  { id: 'integration-parts', name: 'Integration by Parts', category: 'Mathematics',
    expression: '∫u·dv = u·v − ∫v·du',
    variables: [
      { symbol: 'u',  meaning: 'chosen to simplify when differentiated' },
      { symbol: 'dv', meaning: 'chosen to be integrable' },
    ],
    note: 'Pick u by LIATE: Log, Inverse trig, Algebraic, Trig, Exponential.',
    tags: ['integration', 'calculus', 'parts'] },

  { id: 'euler-identity', name: "Euler's Formula", category: 'Mathematics',
    expression: 'e^(iθ) = cos θ + i·sin θ',
    variables: [
      { symbol: 'θ', meaning: 'angle', unit: 'rad' },
    ],
    note: 'The bridge between exponentials and oscillation — underlies all phasor analysis.',
    tags: ['euler', 'complex', 'phasor', 'exponential'] },

  /* ── Probability ─────────────────────────────────────────── */
  { id: 'bayes', name: "Bayes' Theorem", category: 'Probability',
    expression: 'P(A|B) = P(B|A)·P(A) / P(B)',
    variables: [
      { symbol: 'P(A|B)', meaning: 'probability of A given B' },
      { symbol: 'P(A)',   meaning: 'prior probability of A' },
    ],
    note: 'The base rate P(A) is what intuition usually drops — a rare condition stays unlikely even after a positive test.',
    tags: ['bayes', 'conditional', 'probability', 'prior'] },

  { id: 'std-dev', name: 'Standard Deviation', category: 'Probability',
    expression: 's = √( Σ(xᵢ − x̄)² / (n − 1) )',
    variables: [
      { symbol: 's',  meaning: 'sample standard deviation' },
      { symbol: 'x̄',  meaning: 'sample mean' },
      { symbol: 'n',  meaning: 'sample size' },
    ],
    note: 'Divide by n−1 for a SAMPLE, n for a whole population. Using the wrong one biases the estimate.',
    tags: ['standard deviation', 'variance', 'statistics', 'spread'] },

  { id: 'normal', name: 'Normal Distribution', category: 'Probability',
    expression: 'f(x) = (1 / (σ√(2π))) · e^(−(x−μ)² / 2σ²)',
    variables: [
      { symbol: 'μ', meaning: 'mean' },
      { symbol: 'σ', meaning: 'standard deviation' },
    ],
    note: '68% within 1σ, 95% within 2σ, 99.7% within 3σ.',
    tags: ['normal', 'gaussian', 'distribution', 'bell curve'] },

  { id: 'combinations', name: 'Combinations & Permutations', category: 'Probability',
    expression: 'C(n,r) = n! / (r!·(n−r)!)     P(n,r) = n! / (n−r)!',
    variables: [
      { symbol: 'n', meaning: 'total items' },
      { symbol: 'r', meaning: 'items chosen' },
    ],
    note: 'Combinations ignore order; permutations do not.',
    tags: ['combinations', 'permutations', 'counting', 'factorial'] },
]

export const FORMULA_COUNT = FORMULAS.length
