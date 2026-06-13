/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Biology Major Resource Map
 *
 * Loaded on-demand only when a user declares a Biology major.
 * Never included in the main bundle.
 *
 * Categories:
 *   1. Research Databases    — PubMed, NCBI, Google Scholar, JSTOR, Web of Science
 *   2. Lab & Reference Tools — BLAST, UniProt, RCSB PDB, ChemSpider, Reaxys
 *   3. Learning Resources    — Khan Academy, Crash Course, BioInteractive, OpenStax, MIT OCW
 *   4. Pre-Med & Grad Prep   — MCAT, GRE, GradCafe, AMCAS, AAAS
 *   5. Career Resources      — BLS, FASEB Jobs, Nature Careers, Science Careers, NIH
 * ════════════════════════════════════════════════════════════════
 */

import type { MajorConfig } from './index'

export const BIOLOGY: MajorConfig = {
  id:         'biology',
  name:       'Biology',
  shortName:  'Bio',
  department: 'College of Natural Sciences',
  categories: [

    /* ── 1. Research Databases ──────────────────────────────── */
    {
      id:    'research-databases',
      label: 'Research Databases',
      links: [
        {
          id:          'pubmed-bio',
          title:       'PubMed — Biomedical Literature',
          description: 'NIH\'s free database of over 35 million biomedical citations spanning molecular biology, genetics, ecology, physiology, and medicine. Links directly to free full-text articles on PubMed Central when available.',
          url:         'https://pubmed.ncbi.nlm.nih.gov/',
          tag:         'Peer-Reviewed',
        },
        {
          id:          'ncbi',
          title:       'NCBI — National Center for Biotechnology Information',
          description: 'The central hub for biological databases and computational biology tools maintained by NIH, including GenBank, PubMed, and reference sequence databases. Essential for any molecular or genomics research.',
          url:         'https://www.ncbi.nlm.nih.gov/',
          tag:         'Genomics',
        },
        {
          id:          'google-scholar-bio',
          title:       'Google Scholar — Academic Search',
          description: 'Broad academic search engine indexing biology journals, conference papers, theses, and review articles from all major publishers. Displays citation counts and links to free PDF versions where available.',
          url:         'https://scholar.google.com/',
          tag:         'Search',
        },
        {
          id:          'jstor-bio',
          title:       'JSTOR — Science & Natural History Archive',
          description: 'Archival database with full-text access to ecology, evolution, and natural history journals including back-issues of American Naturalist and Ecology. Free limited access is available without a library login.',
          url:         'https://www.jstor.org/',
          tag:         'Archive',
        },
        {
          id:          'web-of-science',
          title:       'Web of Science — Citation Index',
          description: 'Comprehensive multidisciplinary citation database used to identify high-impact journals and trace citation networks. Available through most university library subscriptions for biological sciences.',
          url:         'https://webofscience.com/',
          tag:         'Citations',
        },
      ],
    },

    /* ── 2. Lab & Reference Tools ───────────────────────────── */
    {
      id:    'lab-reference-tools',
      label: 'Lab & Reference Tools',
      links: [
        {
          id:          'ncbi-blast',
          title:       'NCBI BLAST — Sequence Alignment Tool',
          description: 'The Basic Local Alignment Search Tool identifies sequence similarities between a query DNA, RNA, or protein sequence and all entries in NCBI databases. Fundamental for molecular biology labs and genomics coursework.',
          url:         'https://blast.ncbi.nlm.nih.gov/',
          tag:         'Bioinformatics',
        },
        {
          id:          'uniprot',
          title:       'UniProt — Protein Sequence & Function Database',
          description: 'Comprehensive curated database of protein sequences, functional annotations, post-translational modifications, and 3D structure links. The standard reference for protein biology coursework and research.',
          url:         'https://www.uniprot.org/',
          tag:         'Proteins',
        },
        {
          id:          'rcsb-pdb',
          title:       'RCSB Protein Data Bank — 3D Structures',
          description: 'The global archive of experimentally determined 3D structures of biological macromolecules including proteins, nucleic acids, and assemblies. Offers interactive 3D visualization directly in the browser.',
          url:         'https://www.rcsb.org/',
          tag:         'Structural Bio',
        },
        {
          id:          'chemspider',
          title:       'ChemSpider — Chemical Structure Database',
          description: 'Free chemical structure database from the Royal Society of Chemistry providing property data, spectra, and vendor sourcing for over 100 million compounds. Useful for biochemistry and organic chemistry coursework.',
          url:         'https://www.chemspider.com/',
          tag:         'Chemistry',
        },
        {
          id:          'reaxys',
          title:       'Reaxys — Reaction & Compound Database',
          description: 'Elsevier\'s database of chemical reactions, compound properties, and synthesis pathways used extensively in biochemistry research. Access is typically available through university library subscriptions.',
          url:         'https://www.reaxys.com/',
          tag:         'Biochemistry',
        },
      ],
    },

    /* ── 3. Learning Resources ──────────────────────────────── */
    {
      id:    'learning-resources',
      label: 'Learning Resources',
      links: [
        {
          id:          'khan-biology',
          title:       'Khan Academy — Biology',
          description: 'Comprehensive free biology curriculum covering cell biology, genetics, evolution, ecology, human physiology, and more with video lectures and practice exercises. Excellent for MCAT review and foundational concept reinforcement.',
          url:         'https://www.khanacademy.org/science/biology',
          tag:         'Fundamentals',
        },
        {
          id:          'crash-course-bio',
          title:       'Crash Course Biology — YouTube Series',
          description: 'Engaging 40-episode YouTube series covering the major topics in introductory biology with clear visuals and memorable explanations. Ideal for quick review before exams or introducing a new topic.',
          url:         'https://www.youtube.com/playlist?list=PL3EED4C1D684D3ADF',
          tag:         'Video',
        },
        {
          id:          'biointeractive',
          title:       'BioInteractive — HHMI Science Resources',
          description: 'Howard Hughes Medical Institute\'s library of free educational animations, data analysis activities, and short films created by research scientists. Resources align directly with AP Biology and introductory college curriculum.',
          url:         'https://www.biointeractive.org/',
          tag:         'Animations',
        },
        {
          id:          'openstax-bio',
          title:       'OpenStax Biology — Free Textbook',
          description: 'Peer-reviewed, openly licensed introductory biology textbook covering cell structure, genetics, ecology, and evolution at no cost. Includes instructor resources, test banks, and a PowerPoint slide deck.',
          url:         'https://openstax.org/subjects/science',
          tag:         'Open Textbook',
        },
        {
          id:          'mit-ocw-biology',
          title:       'MIT OpenCourseWare — Biology',
          description: 'Free lecture notes, problem sets, and exams from MIT\'s actual biology courses including Introductory Biology, Biochemistry, Genetics, and Computational Biology. No registration required.',
          url:         'https://ocw.mit.edu/courses/biology/',
          tag:         'MIT',
        },
      ],
    },

    /* ── 4. Pre-Med & Grad Prep ─────────────────────────────── */
    {
      id:    'premed-grad-prep',
      label: 'Pre-Med & Grad Prep',
      links: [
        {
          id:          'mcat-prep',
          title:       'AAMC — Official MCAT Preparation',
          description: 'The Association of American Medical Colleges\'s official MCAT study resources including sample tests, question packs, and study schedules. The most authoritative and validated prep material available.',
          url:         'https://www.aamc.org/students/applying/mcat',
          tag:         'MCAT',
        },
        {
          id:          'gre-prep',
          title:       'ETS GRE — Graduate Record Examination',
          description: 'Official GRE preparation resources including free PowerPrep practice tests that closely simulate real exam conditions. Required for most biology PhD programs and many master\'s programs.',
          url:         'https://www.ets.org/gre',
          tag:         'GRE',
        },
        {
          id:          'gradcafe-bio',
          title:       'GradCafe — Graduate Admissions Results',
          description: 'Community-sourced database of graduate school admission outcomes for biology PhD programs including reported GPA, GRE, and research experience from real applicants. Helps calibrate application strategy.',
          url:         'https://www.thegradcafe.com/',
          tag:         'Grad School',
        },
        {
          id:          'amcas',
          title:       'AMCAS — Medical School Application',
          description: 'The American Medical College Application Service centralized application used by 140+ MD-granting medical schools. Manages transcripts, activities, personal statements, and letters of recommendation.',
          url:         'https://students-residents.aamc.org/',
          tag:         'Medical School',
        },
        {
          id:          'aaas',
          title:       'AAAS — American Association for the Advancement of Science',
          description: 'Publisher of Science journal and organizer of the largest US scientific society membership. Offers student memberships, fellowships, and career resources across all biological disciplines.',
          url:         'https://www.aaas.org/',
          tag:         'Professional',
        },
      ],
    },

    /* ── 5. Career Resources ────────────────────────────────── */
    {
      id:    'career-resources',
      label: 'Career Resources',
      links: [
        {
          id:          'bls-life-scientists',
          title:       'BLS — Life Scientists Occupational Outlook',
          description: 'Bureau of Labor Statistics data on median salaries, job growth projections, and required education for biochemists, microbiologists, zoologists, conservation scientists, and related life science roles.',
          url:         'https://www.bls.gov/ooh/life-physical-and-social-science/',
          tag:         'Outlook',
        },
        {
          id:          'faseb-jobs',
          title:       'FASEB — Federation of American Societies for Experimental Biology',
          description: 'Professional organization representing 30 life science societies with a career center listing academic, industry, and government biology positions. Also provides policy advocacy resources for emerging researchers.',
          url:         'https://www.faseb.org/professional-development',
          tag:         'Professional',
        },
        {
          id:          'nature-careers',
          title:       'Nature — Naturejobs Career Portal',
          description: 'The Nature publishing group\'s job board for postdoctoral, faculty, research scientist, and industry positions in biology and life sciences. Includes career advice columns from practicing scientists.',
          url:         'https://www.nature.com/naturecareers',
          tag:         'Academic',
        },
        {
          id:          'science-careers',
          title:       'Science — AAAS Career Center',
          description: 'Job board and career development articles maintained by the AAAS and Science magazine covering research, industry, policy, and non-traditional biology career paths.',
          url:         'https://sciencecareers.sciencemag.org/',
          tag:         'Jobs',
        },
        {
          id:          'nih-careers',
          title:       'NIH — Research Careers & Funding',
          description: 'The National Institutes of Health\'s portal for research training programs, fellowship funding (F31, T32, R36), and career development awards. Essential reading for biology students considering research careers.',
          url:         'https://www.nih.gov/',
          tag:         'Funding',
        },
      ],
    },

  ],
}
