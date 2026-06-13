/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Mathematics Major Resource Map
 *
 * Loaded on-demand only when a user declares a Mathematics major.
 * Never included in the main bundle.
 *
 * Categories:
 *   1. Problem Solving & Practice  — WolframAlpha, AoPS, Brilliant, Euler
 *   2. Reference & Tools           — MathWorld, DLMF, Mathematica, GeoGebra
 *   3. Research & Publications     — arXiv, MathSciNet, AMS, SIAM
 *   4. Learning Resources          — MIT OCW, 3Blue1Brown, Paul's Notes
 *   5. Career Resources            — AMS, SIAM, MAA, Handshake
 * ════════════════════════════════════════════════════════════════
 */

import type { MajorConfig } from './index'

export const MATHEMATICS: MajorConfig = {
  id:         'mathematics',
  name:       'Mathematics',
  shortName:  'Math',
  department: 'College of Natural Sciences',
  categories: [

    /* ── 1. Problem Solving & Practice ──────────────────────── */
    {
      id:    'problem-solving-practice',
      label: 'Problem Solving & Practice',
      links: [
        {
          id:          'wolfram-alpha',
          title:       'Wolfram Alpha — Computational Engine',
          description: 'Symbolic computation engine capable of solving integrals, differential equations, matrix problems, number theory queries, and statistical distributions with step-by-step solutions. An indispensable tool for checking homework and exploring the behavior of mathematical objects across every undergraduate course.',
          url:         'https://www.wolframalpha.com',
          tag:         'Computation',
        },
        {
          id:          'art-of-problem-solving',
          title:       'Art of Problem Solving',
          description: 'Premier community and curriculum platform for competitive mathematics covering AMC, AIME, MATHCOUNTS, and Olympiad-level problem sets with video lessons and a vibrant community forum. The AoPS textbook series (from Prealgebra through Olympiad Combinatorics) is widely used in honors and gifted programs.',
          url:         'https://artofproblemsolving.com',
          tag:         'Competition Math',
        },
        {
          id:          'brilliant',
          title:       'Brilliant — Interactive Problem Solving',
          description: 'Interactive learning platform emphasizing conceptual understanding through guided problem sequences in calculus, linear algebra, probability, logic, and discrete mathematics. The Socratic approach of building intuition before formalism complements standard lecture-and-proof courses.',
          url:         'https://brilliant.org',
          tag:         'Conceptual Learning',
        },
        {
          id:          'project-euler',
          title:       'Project Euler',
          description: 'Collection of over 800 computational mathematics problems at the intersection of number theory, combinatorics, and algorithmic thinking, solved using any programming language. An excellent resource for developing mathematical programming skills and building a portfolio of quantitative problem-solving work.',
          url:         'https://projecteuler.net',
          tag:         'Computational Math',
        },
        {
          id:          'desmos',
          title:       'Desmos — Graphing Calculator',
          description: 'Polished browser-based graphing calculator that renders parametric curves, polar graphs, implicit equations, inequalities, and animated sliders instantly. Free with no account required; widely adopted by professors for in-class visualization of function families, transformations, and geometric concepts.',
          url:         'https://www.desmos.com',
          tag:         'Graphing',
        },
      ],
    },

    /* ── 2. Reference & Tools ───────────────────────────────── */
    {
      id:    'reference-tools',
      label: 'Reference & Tools',
      links: [
        {
          id:          'mathworld',
          title:       'Wolfram MathWorld — Mathematics Encyclopedia',
          description: 'Comprehensive online mathematics encyclopedia authored by Eric Weisstein covering definitions, theorems, formulas, and historical context across all areas of pure and applied mathematics. Entries are cross-referenced and often include interactive Mathematica demonstrations.',
          url:         'https://mathworld.wolfram.com',
          tag:         'Encyclopedia',
        },
        {
          id:          'dlmf',
          title:       'DLMF — Digital Library of Mathematical Functions',
          description: 'NIST\'s authoritative online successor to the Handbook of Mathematical Functions (Abramowitz & Stegun), providing rigorously verified formulas, series expansions, and asymptotic approximations for special functions. The canonical reference for analysis and mathematical physics coursework.',
          url:         'https://dlmf.nist.gov',
          tag:         'Special Functions',
        },
        {
          id:          'mathematica-online',
          title:       'Wolfram Mathematica Online',
          description: 'Symbolic and numeric computation system used across pure mathematics, applied mathematics, and physics research for algebraic manipulation, numerical integration, and visualization. Many universities provide free student licenses; the cloud version runs in the browser without installation.',
          url:         'https://www.wolfram.com/mathematica',
          tag:         'CAS',
        },
        {
          id:          'geogebra',
          title:       'GeoGebra — Dynamic Mathematics',
          description: 'Free cross-platform tool combining geometry, algebra, statistics, and calculus in an interactive canvas with a suite of pre-built classroom activities. Widely used for visualizing linear transformations, conic sections, and real analysis concepts in undergraduate courses.',
          url:         'https://www.geogebra.org',
          tag:         'Dynamic Geometry',
        },
        {
          id:          'matlab',
          title:       'MATLAB — Numerical Computing',
          description: 'Industry-standard numerical computing environment for matrix operations, signal processing, optimization, and data visualization used extensively in applied mathematics and mathematical modeling courses. Check with your university library for a free campus-wide student license.',
          url:         'https://www.mathworks.com/products/matlab.html',
          tag:         'Numerical Analysis',
        },
      ],
    },

    /* ── 3. Research & Publications ─────────────────────────── */
    {
      id:    'research-publications',
      label: 'Research & Publications',
      links: [
        {
          id:          'arxiv-math',
          title:       'arXiv — Mathematics Preprints',
          description: 'Open-access preprint server where mathematicians post new results in all subfields — from algebraic geometry and combinatorics to probability and mathematical physics — before or concurrent with journal peer review. Browsing recent arXiv submissions is the primary way active researchers stay current with the field.',
          url:         'https://arxiv.org/list/math',
          tag:         'Preprints',
        },
        {
          id:          'mathscinet',
          title:       'MathSciNet — AMS Mathematical Reviews',
          description: 'Comprehensive indexed database of mathematical literature maintained by the American Mathematical Society, covering over 3.5 million papers with detailed reviews written by subject-matter experts. Accessible through most university library subscriptions; essential for systematic literature searches in pure math research.',
          url:         'https://mathscinet.ams.org',
          tag:         'Literature Index',
        },
        {
          id:          'zbmath',
          title:       'zbMATH Open — Mathematics Database',
          description: 'European alternative to MathSciNet, indexing over 4 million publications in mathematics and its applications with author disambiguation and citation linking, now freely accessible to all. Useful for finding literature in fields where European journals are particularly strong.',
          url:         'https://zbmath.org',
          tag:         'Open Research',
        },
        {
          id:          'ams',
          title:       'American Mathematical Society',
          description: 'Professional society advancing mathematical research and education, publishing flagship journals including the Transactions, Proceedings, and Journal of the AMS along with the Notices periodical. AMS student membership is free and provides access to career resources, graduate school information, and the Mathematical Reviews database.',
          url:         'https://www.ams.org',
          tag:         'Professional Society',
        },
        {
          id:          'siam',
          title:       'SIAM — Society for Industrial and Applied Math',
          description: 'Leading professional organization for applied and computational mathematicians, publishing 18 peer-reviewed journals and hosting the largest applied mathematics conference in the world. Free SIAM student chapters on many campuses provide networking, speaker events, and travel grant opportunities for conferences.',
          url:         'https://www.siam.org',
          tag:         'Applied Math',
        },
      ],
    },

    /* ── 4. Learning Resources ──────────────────────────────── */
    {
      id:    'learning-resources',
      label: 'Learning Resources',
      links: [
        {
          id:          'mit-ocw-math',
          title:       'MIT OpenCourseWare — Mathematics',
          description: 'Complete course materials from MIT\'s mathematics curriculum freely available online, including lecture notes, problem sets, exams, and solutions for courses from single-variable calculus through graduate real analysis and algebraic topology. The single most valuable free supplementary resource for rigorous undergraduate mathematics.',
          url:         'https://ocw.mit.edu/courses/mathematics',
          tag:         'MIT Courseware',
        },
        {
          id:          '3blue1brown',
          title:       '3Blue1Brown — Visual Mathematics',
          description: 'YouTube channel by Grant Sanderson producing beautifully animated explanations of linear algebra, calculus, complex analysis, topology, and number theory that build deep geometric intuition. The Essence of Linear Algebra and Essence of Calculus series are widely recommended as companion viewing to first courses in those subjects.',
          url:         'https://www.3blue1brown.com',
          tag:         'Visual Intuition',
        },
        {
          id:          'pauls-online-notes',
          title:       'Paul\'s Online Math Notes',
          description: 'Comprehensive free notes and problem sets for Algebra, Calculus I–III, Differential Equations, and Linear Algebra written by a Lamar University professor. Organized by topic with worked examples and practice problems, these notes are among the most frequently referenced free resources by undergraduate math students.',
          url:         'https://tutorial.math.lamar.edu',
          tag:         'Course Notes',
        },
        {
          id:          'khan-academy-math',
          title:       'Khan Academy — Mathematics',
          description: 'Free adaptive learning platform covering arithmetic through multivariable calculus and linear algebra with embedded exercises, video hints, and mastery tracking. Particularly useful for reviewing prerequisites before advanced courses or strengthening specific topics identified as weak areas.',
          url:         'https://www.khanacademy.org/math',
          tag:         'Fundamentals',
        },
        {
          id:          'coursera-math',
          title:       'Coursera — Math & Logic Courses',
          description: 'University-taught courses in discrete mathematics, mathematical thinking, number theory, and combinatorics from providers including Duke, UC San Diego, and McMaster. Many courses are free to audit and provide structured problem sets with peer review that complement self-study.',
          url:         'https://www.coursera.org/browse/math-and-logic',
          tag:         'Online Courses',
        },
      ],
    },

    /* ── 5. Career Resources ─────────────────────────────────── */
    {
      id:    'career-resources',
      label: 'Career Resources',
      links: [
        {
          id:          'ams-careers',
          title:       'AMS — Mathematical Careers',
          description: 'American Mathematical Society career resources covering academia, government, industry, and finance pathways for math graduates including salary surveys and profiles of mathematicians working in non-academic sectors. The Mathematical Sciences Career Information page is an excellent starting point for exploring careers beyond academia.',
          url:         'https://www.ams.org/profession/career-info',
          tag:         'Career Paths',
        },
        {
          id:          'siam-careers',
          title:       'SIAM — Applied Math Career Resources',
          description: 'Society for Industrial and Applied Mathematics career center featuring job postings in industry, government labs, and academia for applied mathematicians, data scientists, and computational scientists. SIAM\'s "Math in Industry" report documents the breadth of sectors where mathematical expertise commands a premium.',
          url:         'https://www.siam.org/careers',
          tag:         'Industry Jobs',
        },
        {
          id:          'maa',
          title:       'Mathematical Association of America',
          description: 'National organization focused on undergraduate mathematics education, publishing the American Mathematical Monthly and hosting the Putnam Competition along with a job board primarily for academic and educational positions. MAA student membership provides access to competition resources, Convergence historical journal, and professional development.',
          url:         'https://www.maa.org',
          tag:         'MAA',
        },
        {
          id:          'handshake-math',
          title:       'Handshake',
          description: 'University-connected recruiting platform where financial firms, tech companies, actuarial consultancies, and government agencies post quantitative internship and entry-level positions targeting math, statistics, and CS graduates. Setting degree and skills filters to mathematics on Handshake surfaces highly relevant roles missed by general job boards.',
          url:         'https://joinhandshake.com',
          tag:         'Campus Recruiting',
        },
        {
          id:          'glassdoor-quant',
          title:       'Glassdoor — Quantitative Roles',
          description: 'Company review and salary platform with compensation data for quantitative analyst, actuary, data scientist, and software engineer roles that math graduates frequently pursue. Use Glassdoor\'s salary comparison tool to benchmark offers in quantitative finance, consulting, and tech against industry medians.',
          url:         'https://www.glassdoor.com',
          tag:         'Salary Research',
        },
      ],
    },

  ],
}
