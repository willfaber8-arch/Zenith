/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Psychology Major Resource Map
 *
 * Loaded on-demand only when a user declares a Psychology major.
 * Never included in the main bundle.
 *
 * Categories:
 *   1. Research & Databases   — PsycINFO, PubMed, Google Scholar, JSTOR, ResearchGate
 *   2. Statistics & Analysis  — SPSS, R Project, JASP, Statistics How To, APA Style
 *   3. Clinical Resources     — APA, NIMH, DSM-5, Psychology Today, Verywell Mind
 *   4. Career Paths           — APA Career Center, BLS Outlook, Handshake, GradCafe
 * ════════════════════════════════════════════════════════════════
 */

import type { MajorConfig } from './index'

export const PSYCHOLOGY: MajorConfig = {
  id:         'psychology',
  name:       'Psychology',
  shortName:  'Psych',
  department: 'College of Arts & Sciences',
  categories: [

    /* ── 1. Research & Databases ────────────────────────────── */
    {
      id:    'research-databases',
      label: 'Research & Databases',
      links: [
        {
          id:          'psycnet',
          title:       'PsycINFO — APA Research Database',
          description: 'The American Psychological Association\'s flagship database indexing over 4 million peer-reviewed psychology articles, books, and dissertations. Offers advanced filters by methodology, population, and disorder classification.',
          url:         'https://psycnet.apa.org/',
          tag:         'Peer-Reviewed',
        },
        {
          id:          'pubmed-psych',
          title:       'PubMed — Biomedical & Psych Literature',
          description: 'Free NIH database of over 35 million biomedical citations essential for clinical, neuroscience, and health psychology research. Provides direct links to free full-text articles via PubMed Central.',
          url:         'https://pubmed.ncbi.nlm.nih.gov/',
          tag:         'Neuroscience',
        },
        {
          id:          'google-scholar-psych',
          title:       'Google Scholar — Academic Search',
          description: 'Broad search engine indexing psychology journals, conference proceedings, theses, and book chapters from all major publishers. Shows citation counts and links to freely available PDFs.',
          url:         'https://scholar.google.com/',
          tag:         'Search',
        },
        {
          id:          'jstor-psych',
          title:       'JSTOR — Humanities & Social Sciences Archive',
          description: 'Archival database of major psychology and social science journals with full-text access to older volumes not found elsewhere. Free limited access is available without a library login.',
          url:         'https://www.jstor.org/',
          tag:         'Archive',
        },
        {
          id:          'researchgate',
          title:       'ResearchGate — Researcher Social Network',
          description: 'Academic networking site where researchers share preprints, full-text papers, and respond to questions about their work. A useful source for obtaining papers behind paywalls by contacting authors directly.',
          url:         'https://www.researchgate.net/',
          tag:         'Networking',
        },
      ],
    },

    /* ── 2. Statistics & Analysis ───────────────────────────── */
    {
      id:    'statistics-analysis',
      label: 'Statistics & Analysis',
      links: [
        {
          id:          'spss-tutorials',
          title:       'IBM SPSS — Statistical Analysis Software',
          description: 'Industry-standard statistical software widely used in psychology research for ANOVA, regression, factor analysis, and non-parametric tests. Many universities provide free student licenses through IBM\'s academic portal.',
          url:         'https://www.ibm.com/spss',
          tag:         'SPSS',
        },
        {
          id:          'r-project',
          title:       'R Project — Statistical Computing',
          description: 'Free and open-source language and environment for statistical computing and graphics. Increasingly preferred over SPSS in academic psychology for reproducibility and access to cutting-edge packages like lavaan for SEM.',
          url:         'https://www.r-project.org/',
          tag:         'Statistics',
        },
        {
          id:          'jasp',
          title:       'JASP — Bayesian & Frequentist Analysis',
          description: 'Free open-source statistics program with a clean GUI that supports both Bayesian and classical frequentist analysis side-by-side. Integrates directly with OSF for open-science workflows.',
          url:         'https://jasp-stats.org/',
          tag:         'Bayesian',
        },
        {
          id:          'statistics-howto',
          title:       'Statistics How To — Concept Reference',
          description: 'Approachable explanations of statistical tests, probability distributions, and research design concepts commonly taught in psychology methods courses. Includes worked examples for t-tests, chi-square, and correlation.',
          url:         'https://www.statisticshowto.com/',
          tag:         'Reference',
        },
        {
          id:          'apa-style',
          title:       'APA Style — Official Citation & Format Guide',
          description: 'The official APA Style website with guidelines for the 7th edition, including examples for journal articles, websites, and research reports. Essential for every written assignment in a psychology program.',
          url:         'https://apastyle.apa.org/',
          tag:         'APA 7th',
        },
      ],
    },

    /* ── 3. Clinical Resources ──────────────────────────────── */
    {
      id:    'clinical-resources',
      label: 'Clinical Resources',
      links: [
        {
          id:          'apa-main',
          title:       'APA — American Psychological Association',
          description: 'The professional home of psychology in the United States, offering ethics guidelines, practice resources, policy statements, and student membership with access to Monitor on Psychology magazine.',
          url:         'https://www.apa.org/',
          tag:         'Professional',
        },
        {
          id:          'nimh',
          title:       'NIMH — National Institute of Mental Health',
          description: 'Federal agency providing authoritative statistics, research summaries, and plain-language fact sheets on all major mental health conditions. A reliable primary source for clinical paper citations.',
          url:         'https://www.nimh.nih.gov/',
          tag:         'Mental Health',
        },
        {
          id:          'dsm5-reference',
          title:       'DSM-5 — Diagnostic Reference (APA)',
          description: 'The American Psychiatric Association\'s page on DSM-5-TR, the standard diagnostic classification system used in clinical, research, and educational contexts in psychology and psychiatry.',
          url:         'https://www.psychiatry.org/psychiatrists/practice/dsm',
          tag:         'Diagnostics',
        },
        {
          id:          'psychology-today',
          title:       'Psychology Today — Research & Practitioner Hub',
          description: 'Accessible articles by clinicians and researchers on psychological concepts, therapy approaches, and mental health topics. Also hosts a therapist directory and continuing education resources.',
          url:         'https://www.psychologytoday.com/',
          tag:         'Applied',
        },
        {
          id:          'verywell-mind',
          title:       'Verywell Mind — Evidence-Based Mental Health',
          description: 'Medically reviewed articles explaining psychological disorders, therapeutic modalities, and wellness strategies for a general audience. Useful for quickly summarizing a topic before diving into primary literature.',
          url:         'https://www.verywellmind.com/',
          tag:         'Reference',
        },
      ],
    },

    /* ── 4. Career Paths ────────────────────────────────────── */
    {
      id:    'career-paths',
      label: 'Career Paths',
      links: [
        {
          id:          'apa-careers',
          title:       'APA Career Center — Psychology Jobs',
          description: 'Job board and career development resources maintained by the American Psychological Association, including postings for research, clinical, academic, and government positions.',
          url:         'https://www.apa.org/careers',
          tag:         'Jobs',
        },
        {
          id:          'bls-psychologists',
          title:       'BLS — Psychologists Occupational Outlook',
          description: 'Bureau of Labor Statistics data on median pay, required education, job outlook, and work environment for psychologists across all specializations. Essential for career planning conversations with advisors.',
          url:         'https://www.bls.gov/ooh/life-physical-and-social-science/psychologists.htm',
          tag:         'Outlook',
        },
        {
          id:          'psychology-career-advice',
          title:       'Psychology Career Advice — Specialization Guide',
          description: 'Resource covering the educational requirements, licensure paths, and career trajectories for clinical, counseling, school, forensic, and industrial-organizational psychology specializations.',
          url:         'https://www.psychologycareeradvice.com/',
          tag:         'Specializations',
        },
        {
          id:          'handshake-psych',
          title:       'Handshake — Campus-Connected Job Board',
          description: 'University-integrated internship and job platform where psychology students can find research assistant positions, mental health clinic internships, and entry-level human services roles.',
          url:         'https://joinhandshake.com/',
          tag:         'Internships',
        },
        {
          id:          'gradcafe',
          title:       'GradCafe — Graduate School Admissions',
          description: 'Community-sourced database of graduate school admission results for psychology PhD and PsyD programs including GPA, GRE scores, and acceptance timelines from real applicants.',
          url:         'https://www.thegradcafe.com/',
          tag:         'Grad School',
        },
      ],
    },

  ],
}
