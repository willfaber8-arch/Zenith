/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Engineering Major Resource Map
 * Phase 2 · Step 2.4 — Major-Specific Link Matrix & Resource Hub
 *
 * Loaded on-demand only when a user declares an Engineering major.
 * Never included in the main bundle.
 *
 * Categories:
 *   1. Computation & Mathematics   — WolframAlpha deep links
 *   2. Reference Databases         — Engineering Toolbox, eFunda
 *   3. Technical Typesetting & Coding — Overleaf, GitHub, Stack Overflow
 *   4. Hardware & Electronics       — DigiKey, AllAboutCircuits
 * ════════════════════════════════════════════════════════════════
 */

import type { MajorConfig } from './index'

export const ENGINEERING: MajorConfig = {
  id:         'engineering',
  name:       'Engineering',
  shortName:  'Eng',
  department: 'College of Engineering',
  categories: [

    /* ── 1. Computation & Mathematics ──────────────────────── */
    {
      id:    'computation-math',
      label: 'Computation & Mathematics',
      links: [
        {
          id:          'wolfram-calculus',
          title:       'WolframAlpha — Calculus & Analysis',
          description: 'Interactive visualisation of limits, derivatives, integrals, and series. Deep-linked directly to the calculus and analysis example gallery for instant exploration.',
          url:         'https://www.wolframalpha.com/examples/mathematics/calculus-and-analysis/',
          tag:         'Calculus',
        },
        {
          id:          'wolfram-linalg',
          title:       'WolframAlpha — Linear Algebra & Vectors',
          description: 'Matrix operations, eigenvalue decomposition, vector field analysis, and cross/dot product solvers. Critical for Statics, Dynamics, and Signals coursework.',
          url:         'https://www.wolframalpha.com/examples/mathematics/linear-algebra/',
          tag:         'Linear Algebra',
        },
        {
          id:          'wolfram-odes',
          title:       'WolframAlpha — Differential Equations',
          description: 'Step-by-step ODE and PDE solvers with direction field visualisation. Covers first-order, second-order, and system-of-equations problems common in controls and circuits.',
          url:         'https://www.wolframalpha.com/examples/mathematics/differential-equations/',
          tag:         'ODEs / PDEs',
        },
      ],
    },

    /* ── 2. Reference Databases ─────────────────────────────── */
    {
      id:    'reference-databases',
      label: 'Reference Databases',
      links: [
        {
          id:          'engineering-toolbox',
          title:       'The Engineering Toolbox',
          description: 'Comprehensive niche reference for material properties, thermodynamic data, fluid mechanics metrics, and dimensional unit converters. An essential lookup companion for lab reports and problem sets.',
          url:         'https://www.engineeringtoolbox.com/',
          tag:         'Reference',
        },
        {
          id:          'engineering-toolbox-units',
          title:       'Engineering Toolbox — Unit Converter',
          description: 'Instant conversion across SI, imperial, and specialised engineering units. Covers pressure, energy, viscosity, torque, heat flux, and dozens of derived quantities.',
          url:         'https://www.engineeringtoolbox.com/unit-converter.html',
          tag:         'Units',
        },
        {
          id:          'efunda',
          title:       'eFunda — Engineering Fundamentals',
          description: 'Structured matrices for mechanics of materials, beam deflection tables, stress-strain models, and an introductory finite element analysis reference. Ideal for Solid Mechanics and Structural Analysis.',
          url:         'https://www.efunda.com/',
          tag:         'Mechanics',
        },
      ],
    },

    /* ── 3. Technical Typesetting & Coding ──────────────────── */
    {
      id:    'typesetting-coding',
      label: 'Technical Typesetting & Coding',
      links: [
        {
          id:          'overleaf',
          title:       'Overleaf — LaTeX Editor',
          description: 'Cloud-based collaborative LaTeX sandbox with real-time compilation. Pre-loaded IEEE and ASME journal templates make it the standard environment for engineering lab reports and technical papers.',
          url:         'https://www.overleaf.com/',
          tag:         'LaTeX',
        },
        {
          id:          'github',
          title:       'GitHub — Version Control & Portfolio',
          description: 'Host simulation code, MATLAB scripts, CAD automation, and capstone project repositories. A polished engineering GitHub profile is increasingly expected by technical recruiters.',
          url:         'https://github.com/',
          tag:         'Version Control',
        },
        {
          id:          'stackoverflow',
          title:       'Stack Overflow — Technical Q&A',
          description: 'Curated technical answers for Python, MATLAB, C++, and embedded systems questions. The highest signal-to-noise engineering code reference outside official documentation.',
          url:         'https://stackoverflow.com/',
          tag:         'Q&A',
        },
      ],
    },

    /* ── 4. Hardware & Electronics (ECE / Robotics) ─────────── */
    {
      id:    'hardware-electronics',
      label: 'Hardware & Electronics (ECE / Robotics)',
      links: [
        {
          id:          'digikey',
          title:       'DigiKey — Component Search & Datasheets',
          description: 'Industry-standard parametric component selector covering resistors, ICs, microcontrollers, sensors, and connectors. Cross-reference datasheets and compare manufacturer specs for PCB design and lab builds.',
          url:         'https://www.digikey.com/',
          tag:         'Components',
        },
        {
          id:          'digikey-tools',
          title:       'DigiKey Reference Design Center',
          description: 'Curated reference designs, evaluation board guides, and application notes from leading semiconductor manufacturers. Accelerates schematic design for power, RF, and microcontroller circuits.',
          url:         'https://www.digikey.com/en/resources/design-tools',
          tag:         'Design Tools',
        },
        {
          id:          'all-about-circuits',
          title:       'AllAboutCircuits — Interactive Reference',
          description: 'Free interactive textbook, schematic builder sandbox, and circuit theory reference covering DC/AC fundamentals, semiconductors, digital logic, and op-amp circuits. Used widely in ECE lab prep.',
          url:         'https://www.allaboutcircuits.com/',
          tag:         'Circuits',
        },
        {
          id:          'falstad-sim',
          title:       'Falstad Circuit Simulator',
          description: 'Browser-based real-time circuit simulator — build, run, and debug circuits with oscilloscope probes instantly. No install required. Great for pre-lab exploration and ECE homework verification.',
          url:         'https://www.falstad.com/circuit/',
          tag:         'Simulation',
        },
        {
          id:          'arduino-ref',
          title:       'Arduino Reference & IDE',
          description: 'Official Arduino language reference, project library, and cloud IDE. The go-to platform for embedded systems labs, robotics prototypes, and IoT capstone projects.',
          url:         'https://www.arduino.cc/reference/en/',
          tag:         'Embedded',
        },
      ],
    },

    /* ── 5. CAD & Simulation Tools ──────────────────────────── */
    {
      id:    'cad-simulation',
      label: 'CAD & Simulation Tools',
      links: [
        {
          id:          'tinkercad',
          title:       'Tinkercad — Browser CAD & Circuits',
          description: 'Free browser-based 3D modeling and circuit simulation tool by Autodesk. Perfect for intro design courses, rapid 3D-print prototyping, and beginner Arduino circuit layouts — no install needed.',
          url:         'https://www.tinkercad.com/',
          tag:         'CAD / Circuits',
        },
        {
          id:          'freecad',
          title:       'FreeCAD — Open-Source Parametric CAD',
          description: 'Fully open-source parametric 3D modeler suitable for mechanical engineering design. Supports FEM analysis, CNC path generation, and Python scripting. A Fusion 360 alternative with no subscription.',
          url:         'https://www.freecad.org/',
          tag:         'CAD',
        },
        {
          id:          'fusion360-edu',
          title:       'Autodesk Fusion 360 (Free for Students)',
          description: 'Industry-grade cloud CAD/CAM/CAE tool. Free education license covers 3D modeling, generative design, FEA simulation, CNC toolpath generation, and PCB layout in one unified workspace.',
          url:         'https://www.autodesk.com/education/edu-software/overview',
          tag:         'CAD/CAM',
        },
        {
          id:          'matlab-online',
          title:       'MATLAB Online',
          description: 'Run MATLAB directly in the browser — no local install. Essential for numerical methods, signal processing, control systems, and data analysis coursework. Check if your university provides a free license.',
          url:         'https://matlab.mathworks.com/',
          tag:         'MATLAB',
        },
        {
          id:          'simulink-overview',
          title:       'Simulink — Model-Based Design',
          description: 'Block-diagram environment for multi-domain simulation and embedded code generation. Core tool for control systems, mechatronics, and automotive engineering coursework built on top of MATLAB.',
          url:         'https://www.mathworks.com/products/simulink.html',
          tag:         'Simulation',
        },
        {
          id:          'ansys-student',
          title:       'Ansys Student (Free FEA/CFD)',
          description: 'Free Ansys Mechanical, Fluent, and Electronics simulation suite for students — up to 32 k nodes for structural FEA and 512 k cells for CFD. Industry-standard finite element analysis software.',
          url:         'https://www.ansys.com/academic/students',
          tag:         'FEA / CFD',
        },
        {
          id:          'onshape-edu',
          title:       'Onshape — Cloud-Native CAD',
          description: 'Fully browser-based parametric CAD with real-time collaboration. Free education accounts include full feature set. No GPU required — works on any device including Chromebooks and tablets.',
          url:         'https://www.onshape.com/en/education/',
          tag:         'Cloud CAD',
        },
      ],
    },

    /* ── 6. Academic Research & Standards ──────────────────── */
    {
      id:    'research-standards',
      label: 'Academic Research & Standards',
      links: [
        {
          id:          'ieee-xplore',
          title:       'IEEE Xplore Digital Library',
          description: 'Primary journal database for electrical, computer, and systems engineering. Peer-reviewed conference papers and IEEE standards — access free through most university library subscriptions.',
          url:         'https://ieeexplore.ieee.org/',
          tag:         'Journals',
        },
        {
          id:          'asme-journals',
          title:       'ASME Digital Collection',
          description: 'American Society of Mechanical Engineers journal archive covering thermodynamics, materials, manufacturing, bioengineering, and robotics research.',
          url:         'https://asmedigitalcollection.asme.org/',
          tag:         'Mechanical',
        },
        {
          id:          'nist',
          title:       'NIST Engineering Data',
          description: 'National Institute of Standards and Technology — authoritative thermophysical data, material constants, dimensional metrology standards, and free measurement tools for engineering calculations.',
          url:         'https://www.nist.gov/engineering-laboratory',
          tag:         'Standards',
        },
      ],
    },

  ],
}
