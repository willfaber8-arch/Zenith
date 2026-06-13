/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Political Science Major Resource Map
 *
 * Loaded on-demand only when a user declares a Political Science major.
 * Never included in the main bundle.
 *
 * Categories:
 *   1. Research & Databases — JSTOR, Google Scholar, APSA, Congressional Record, ProQuest
 *   2. News & Policy        — Politico, The Hill, FiveThirtyEight, CFR, Brookings
 *   3. Government Data      — Congress.gov, USA.gov, Supreme Court, UN Data, CIA Factbook
 *   4. Career Paths         — APSA Careers, USAJobs, State Dept, Handshake, GradCafe
 * ════════════════════════════════════════════════════════════════
 */

import type { MajorConfig } from './index'

export const POLITICAL_SCIENCE: MajorConfig = {
  id:         'political-science',
  name:       'Political Science',
  shortName:  'Poli Sci',
  department: 'College of Arts & Sciences',
  categories: [

    /* ── 1. Research & Databases ────────────────────────────── */
    {
      id:    'research-databases',
      label: 'Research & Databases',
      links: [
        {
          id:          'jstor-polisci',
          title:       'JSTOR — Political Science Archive',
          description: 'Archival full-text access to major political science journals including American Political Science Review, Journal of Politics, and World Politics. Free limited access is available without a library login for up to 100 free articles per month.',
          url:         'https://www.jstor.org/',
          tag:         'Archive',
        },
        {
          id:          'google-scholar-poli',
          title:       'Google Scholar — Academic Search',
          description: 'Broad search engine covering political science journals, working papers, dissertations, and book chapters from all major publishers. Particularly useful for tracing the intellectual lineage of foundational theories.',
          url:         'https://scholar.google.com/',
          tag:         'Search',
        },
        {
          id:          'apsa',
          title:       'APSA — American Political Science Association',
          description: 'Professional organization for political scientists publishing the American Political Science Review and Politics & Gender. Student membership provides access to APSR, conference opportunities, and career development resources.',
          url:         'https://www.apsanet.org/',
          tag:         'Professional',
        },
        {
          id:          'congressional-record',
          title:       'Congress.gov — Congressional Record',
          description: 'Official archive of all Congressional proceedings, floor speeches, votes, and committee reports from 1995 to the present. A primary source for legislative research papers and policy analysis assignments.',
          url:         'https://www.congress.gov/congressional-record',
          tag:         'Primary Source',
        },
        {
          id:          'proquest-polisci',
          title:       'ProQuest Political Science Database',
          description: 'Comprehensive index of political science and public administration literature including journals, government documents, and dissertations. Available through most university library subscriptions with full-text links.',
          url:         'https://www.proquest.com/',
          tag:         'Database',
        },
      ],
    },

    /* ── 2. News & Policy ───────────────────────────────────── */
    {
      id:    'news-policy',
      label: 'News & Policy',
      links: [
        {
          id:          'politico',
          title:       'Politico — US Politics & Policy',
          description: 'Leading political journalism outlet covering Congress, the White House, elections, and policy across all major domestic issue areas. Politico Pro offers specialized coverage of regulatory policy for subscribers.',
          url:         'https://www.politico.com/',
          tag:         'Politics',
        },
        {
          id:          'the-hill',
          title:       'The Hill — Capitol Hill Reporting',
          description: 'Congressional newspaper providing balanced coverage of legislation, lobbying, and executive branch activity without partisan editorial slant. A useful daily briefing for students tracking specific bills or agencies.',
          url:         'https://thehill.com/',
          tag:         'Congress',
        },
        {
          id:          'fivethirtyeight',
          title:       'FiveThirtyEight — Data-Driven Politics',
          description: 'Quantitative political journalism using polling aggregation, forecasting models, and statistical analysis to cover elections, public opinion, and policy outcomes. Excellent reference for students learning empirical political science methods.',
          url:         'https://fivethirtyeight.com/',
          tag:         'Data & Polling',
        },
        {
          id:          'cfr',
          title:       'Council on Foreign Relations — Global Affairs',
          description: 'Independent think tank and publisher providing in-depth analysis of US foreign policy, international relations, and global security. CFR\'s Backgrounders and interactive maps are widely cited in IR coursework.',
          url:         'https://www.cfr.org/',
          tag:         'Foreign Policy',
        },
        {
          id:          'brookings',
          title:       'Brookings Institution — Public Policy Research',
          description: 'Centrist think tank publishing rigorous research on domestic policy, governance, international affairs, and economic policy. Brookings papers are commonly assigned in comparative politics and American government courses.',
          url:         'https://www.brookings.edu/',
          tag:         'Think Tank',
        },
      ],
    },

    /* ── 3. Government Data ─────────────────────────────────── */
    {
      id:    'government-data',
      label: 'Government Data',
      links: [
        {
          id:          'congress-gov',
          title:       'Congress.gov — Legislative Database',
          description: 'Official US government database of all legislation introduced in Congress including bill text, amendment history, committee assignments, and voting records. The authoritative primary source for legislative research.',
          url:         'https://www.congress.gov/',
          tag:         'Legislation',
        },
        {
          id:          'usa-gov',
          title:       'USA.gov — Federal Government Portal',
          description: 'Centralized portal for accessing US federal agency websites, government data, and public services across all branches. Useful for navigating the executive branch landscape and identifying regulatory agencies.',
          url:         'https://www.usa.gov/',
          tag:         'Federal',
        },
        {
          id:          'scotus',
          title:       'Supreme Court of the United States',
          description: 'Official SCOTUS website with slip opinions, oral argument audio and transcripts, case schedules, and the full text of every opinion since 1991. Essential for constitutional law coursework and judicial politics research.',
          url:         'https://www.supremecourt.gov/',
          tag:         'Judiciary',
        },
        {
          id:          'un-data',
          title:       'UN Data — International Statistics',
          description: 'United Nations statistical database aggregating data from 30+ UN agencies covering population, trade, development, human rights, and peacekeeping for all member states. Standard source for comparative politics datasets.',
          url:         'https://data.un.org/',
          tag:         'International',
        },
        {
          id:          'cia-factbook',
          title:       'CIA World Factbook — Country Profiles',
          description: 'Freely available reference on every country covering government structure, political parties, economy, geography, and demographics. A standard reference for comparative politics assignments requiring country-level data.',
          url:         'https://www.cia.gov/the-world-factbook/',
          tag:         'Country Data',
        },
      ],
    },

    /* ── 4. Career Paths ────────────────────────────────────── */
    {
      id:    'career-paths',
      label: 'Career Paths',
      links: [
        {
          id:          'apsa-careers',
          title:       'APSA — Careers in Political Science',
          description: 'The American Political Science Association\'s career resources hub listing academic, government, NGO, and private sector opportunities for political science graduates at all experience levels.',
          url:         'https://www.apsanet.org/RESOURCES/Careers',
          tag:         'Career Hub',
        },
        {
          id:          'usajobs',
          title:       'USAJobs — Federal Government Careers',
          description: 'Official portal for all federal government job openings across legislative, executive, and judicial branch agencies. Political science graduates commonly enter government through policy analyst, foreign service, and legislative affairs roles.',
          url:         'https://www.usajobs.gov/',
          tag:         'Federal Jobs',
        },
        {
          id:          'state-dept-careers',
          title:       'State Department — Foreign Service Careers',
          description: 'Official career portal for the US Department of State covering Foreign Service Officer exam information, internship programs (including the Pickering and Rangel Fellowships), and civil service positions.',
          url:         'https://careers.state.gov/',
          tag:         'Diplomacy',
        },
        {
          id:          'handshake-poli',
          title:       'Handshake — Campus Recruiting Platform',
          description: 'University-connected job board where political science students can find internships at government offices, think tanks, campaigns, and advocacy organizations recruited through their institution.',
          url:         'https://joinhandshake.com/',
          tag:         'Internships',
        },
        {
          id:          'gradcafe-poli',
          title:       'GradCafe — Graduate School Admissions',
          description: 'Community-sourced database of admission results for political science PhD and law school programs, including self-reported GRE, GPA, and research experience from real applicants. Helps calibrate application strategy.',
          url:         'https://www.thegradcafe.com/',
          tag:         'Grad School',
        },
      ],
    },

  ],
}
