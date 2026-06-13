/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Criminal Justice Major Resource Map
 *
 * Loaded on-demand only when a user declares a Criminal Justice major.
 * Never included in the main bundle.
 *
 * Categories:
 *   1. Research & Law Databases — BJS, FBI UCR, Google Scholar, HeinOnline, LexisNexis
 *   2. Policy & Government      — DOJ, NIJ, ACLU, Vera Institute, USSC
 *   3. Career Resources         — USAJobs, Police1, ASIS International, Handshake, AJA
 *   4. Academic Organizations   — ASC, ACJS, CJCJ, NIJ Funding
 * ════════════════════════════════════════════════════════════════
 */

import type { MajorConfig } from './index'

export const CRIMINAL_JUSTICE: MajorConfig = {
  id:         'criminal-justice',
  name:       'Criminal Justice',
  shortName:  'CJ',
  department: 'College of Social Sciences',
  categories: [

    /* ── 1. Research & Law Databases ────────────────────────── */
    {
      id:    'research-law-databases',
      label: 'Research & Law Databases',
      links: [
        {
          id:          'bjs',
          title:       'Bureau of Justice Statistics — Crime Data',
          description: 'The primary US government source for criminal justice statistics covering victimization, prosecution, courts, corrections, and law enforcement employment. BJS publications are essential primary sources for any criminal justice research paper.',
          url:         'https://bjs.gov/',
          tag:         'Official Data',
        },
        {
          id:          'fbi-ucr',
          title:       'FBI — Uniform Crime Reports & NIBRS',
          description: 'The FBI\'s national crime statistics program collecting and publishing data on crimes reported to law enforcement agencies across the United States. The National Incident-Based Reporting System (NIBRS) is replacing the legacy UCR with more granular offense data.',
          url:         'https://www.fbi.gov/services/cjis/ucr',
          tag:         'Crime Statistics',
        },
        {
          id:          'google-scholar-cj',
          title:       'Google Scholar — Academic Search',
          description: 'Broad academic search engine indexing criminology and criminal justice journals, dissertations, and working papers from all major publishers. Useful for identifying landmark studies and tracing their citation impact.',
          url:         'https://scholar.google.com/',
          tag:         'Search',
        },
        {
          id:          'heinonline',
          title:       'HeinOnline — Legal Research Library',
          description: 'Comprehensive legal research database providing PDF access to law review articles, government documents, treaties, and statutes from over 3,000 publications. Available through most university library subscriptions — essential for criminal law research.',
          url:         'https://heinonline.org/',
          tag:         'Legal Research',
        },
        {
          id:          'lexisnexis',
          title:       'LexisNexis — Legal & News Research',
          description: 'Industry-standard legal research platform with access to case law, statutes, regulations, and legal news. Court opinions, legislative history, and secondary legal sources are all searchable in one database.',
          url:         'https://www.lexisnexis.com/',
          tag:         'Case Law',
        },
      ],
    },

    /* ── 2. Policy & Government ─────────────────────────────── */
    {
      id:    'policy-government',
      label: 'Policy & Government',
      links: [
        {
          id:          'doj',
          title:       'Department of Justice — Federal Law Enforcement',
          description: 'Official portal for the US Department of Justice, the Attorney General, and all DOJ components including FBI, DEA, ATF, and US Marshals. Publications, consent decrees, and press releases are all publicly available.',
          url:         'https://www.justice.gov/',
          tag:         'Federal',
        },
        {
          id:          'nij',
          title:       'National Institute of Justice — Research & Policy',
          description: 'The research, development, and evaluation agency of the DOJ funding criminological research and publishing practitioner-focused reports on crime, policing, corrections, and forensic science. NIJ grant announcements are the primary source of federal criminal justice research funding.',
          url:         'https://www.nij.gov/',
          tag:         'Research Funding',
        },
        {
          id:          'aclu',
          title:       'ACLU — Civil Liberties & Criminal Justice Reform',
          description: 'The American Civil Liberties Union publishes legal analysis, policy reports, and data on Fourth Amendment issues, mass incarceration, policing, the death penalty, and prison conditions. An important counterbalancing perspective in criminal justice policy debates.',
          url:         'https://www.aclu.org/',
          tag:         'Civil Liberties',
        },
        {
          id:          'vera-institute',
          title:       'Vera Institute of Justice — Reform Research',
          description: 'Independent research and policy organization generating data-driven reforms in policing, pretrial detention, immigration enforcement, and mass incarceration. Vera reports are widely cited in criminal justice reform literature.',
          url:         'https://www.vera.org/',
          tag:         'Reform',
        },
        {
          id:          'ussc',
          title:       'US Sentencing Commission — Federal Sentencing Data',
          description: 'Independent federal agency publishing detailed statistics on federal sentencing including demographic breakdowns, offense type distributions, and guideline application rates. Data is freely downloadable for empirical research projects.',
          url:         'https://www.ussc.gov/',
          tag:         'Sentencing',
        },
      ],
    },

    /* ── 3. Career Resources ────────────────────────────────── */
    {
      id:    'career-resources',
      label: 'Career Resources',
      links: [
        {
          id:          'usajobs-le',
          title:       'USAJobs — Law Enforcement & Justice Careers',
          description: 'Official portal for all federal government job postings including positions with the FBI, DEA, ATF, US Marshals, Secret Service, Border Patrol, and federal corrections. Filter by law enforcement series codes for targeted searching.',
          url:         'https://www.usajobs.gov/',
          tag:         'Federal Jobs',
        },
        {
          id:          'police1',
          title:       'Police1 — Law Enforcement Career Hub',
          description: 'Resource hub for law enforcement professionals featuring news, training resources, product evaluations, and a job board for police officer and public safety positions at state and local agencies.',
          url:         'https://www.police1.com/',
          tag:         'Law Enforcement',
        },
        {
          id:          'asis-international',
          title:       'ASIS International — Security Management Careers',
          description: 'The world\'s largest membership organization for security professionals offering CPP and PSP certifications, a global career center, and networking for students interested in corporate security, loss prevention, and risk management careers.',
          url:         'https://www.asisonline.org/',
          tag:         'Security',
        },
        {
          id:          'handshake-cj',
          title:       'Handshake — Campus Recruiting Platform',
          description: 'University-connected job board where criminal justice students can find internships with district attorney offices, public defender agencies, probation departments, and law enforcement agencies recruited through their institution.',
          url:         'https://joinhandshake.com/',
          tag:         'Internships',
        },
        {
          id:          'aja',
          title:       'American Jail Association — Corrections Careers',
          description: 'Professional organization for jail professionals publishing Corrections Today and hosting an annual conference. The AJA\'s job board and training resources are oriented toward local corrections, detention management, and jail administration.',
          url:         'https://www.corrections.com/aja',
          tag:         'Corrections',
        },
      ],
    },

    /* ── 4. Academic Organizations ──────────────────────────── */
    {
      id:    'academic-organizations',
      label: 'Academic Organizations',
      links: [
        {
          id:          'asc',
          title:       'ASC — American Society of Criminology',
          description: 'The leading academic criminology organization publishing Criminology, Criminology & Public Policy, and Justice Quarterly. Student memberships provide discounted conference access and the annual meeting is the most important conference for academic criminal justice careers.',
          url:         'https://asc41.com/',
          tag:         'Criminology',
        },
        {
          id:          'acjs',
          title:       'ACJS — Academy of Criminal Justice Sciences',
          description: 'International organization of criminal justice educators and practitioners publishing Justice Quarterly and the Journal of Criminal Justice Education. ACJS hosts an annual conference and student paper competition.',
          url:         'https://www.acjs.net/',
          tag:         'Academic',
        },
        {
          id:          'cjcj',
          title:       'Center on Juvenile & Criminal Justice',
          description: 'Nonprofit research and policy organization focused on reducing incarceration and advancing racial equity in the justice system. CJCJ publishes accessible policy briefs and original data analyses on youth justice and criminal justice reform.',
          url:         'https://www.cjcj.org/',
          tag:         'Juvenile Justice',
        },
        {
          id:          'nij-funding',
          title:       'NIJ — Research Funding & Fellowships',
          description: 'The National Institute of Justice\'s grant and fellowship programs for criminal justice researchers, including the Graduate Research Fellowship for doctoral students and research fellowships for established scholars.',
          url:         'https://www.nij.gov/funding',
          tag:         'Grants',
        },
      ],
    },

  ],
}
