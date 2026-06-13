/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Economics Major Resource Map
 *
 * Loaded on-demand only when a user declares an Economics major.
 * Never included in the main bundle.
 *
 * Categories:
 *   1. Data & Research       — FRED, World Bank, OECD, BEA, IMF
 *   2. Academic Resources    — JSTOR, NBER, Google Scholar, EconLit, SSRN
 *   3. News & Analysis       — The Economist, Bloomberg, Reuters, FT, WSJ
 *   4. Career & Professional — AEA, Handshake, Glassdoor, LinkedIn, Federal Reserve
 * ════════════════════════════════════════════════════════════════
 */

import type { MajorConfig } from './index'

export const ECONOMICS: MajorConfig = {
  id:         'economics',
  name:       'Economics',
  shortName:  'Econ',
  department: 'College of Arts & Sciences',
  categories: [

    /* ── 1. Data & Research ─────────────────────────────────── */
    {
      id:    'data-research',
      label: 'Data & Research',
      links: [
        {
          id:          'fred',
          title:       'FRED — Federal Reserve Economic Data',
          description: 'The Federal Reserve Bank of St. Louis\'s free database of over 800,000 economic time series from 100+ national and international sources. Indispensable for data-driven coursework in macroeconomics and econometrics.',
          url:         'https://fred.stlouisfed.org/',
          tag:         'Macro Data',
        },
        {
          id:          'world-bank-data',
          title:       'World Bank Open Data',
          description: 'Free access to global development statistics covering GDP, poverty, trade, education, and health across 200+ economies from 1960 to present. Essential for international economics and development economics research.',
          url:         'https://data.worldbank.org/',
          tag:         'Development',
        },
        {
          id:          'oecd-data',
          title:       'OECD Data — Statistics for Policy',
          description: 'Data and economic indicators from the Organisation for Economic Co-operation and Development covering 38 member countries and major non-member economies. Strong coverage of labor markets, trade, and fiscal policy.',
          url:         'https://data.oecd.org/',
          tag:         'OECD',
        },
        {
          id:          'bea',
          title:       'Bureau of Economic Analysis — National Accounts',
          description: 'Official US source for GDP, personal income, corporate profits, and industry-level economic accounts. Provides the raw data underlying most US macroeconomic analysis and forecasting.',
          url:         'https://www.bea.gov/',
          tag:         'National Accounts',
        },
        {
          id:          'imf-data',
          title:       'IMF Data — International Monetary Fund',
          description: 'International Monetary Fund\'s repository of global economic and financial data including balance of payments, exchange rates, government finance, and World Economic Outlook datasets.',
          url:         'https://www.imf.org/en/Data',
          tag:         'International',
        },
      ],
    },

    /* ── 2. Academic Resources ──────────────────────────────── */
    {
      id:    'academic-resources',
      label: 'Academic Resources',
      links: [
        {
          id:          'jstor-econ',
          title:       'JSTOR — Economics Journals Archive',
          description: 'Full-text archival access to leading economics journals including American Economic Review, Econometrica, and Journal of Political Economy. Free limited access available without a library login.',
          url:         'https://www.jstor.org/',
          tag:         'Archive',
        },
        {
          id:          'nber',
          title:       'NBER — Working Papers',
          description: 'The National Bureau of Economic Research distributes working papers by leading academic economists before peer-reviewed publication. Many landmark papers in economics circulate here first.',
          url:         'https://www.nber.org/papers',
          tag:         'Working Papers',
        },
        {
          id:          'google-scholar-econ',
          title:       'Google Scholar — Academic Search',
          description: 'Broad search engine covering economics journals, dissertations, and working papers across all subfields. Useful for tracing citation networks and identifying the most-cited works in a research area.',
          url:         'https://scholar.google.com/',
          tag:         'Search',
        },
        {
          id:          'econlit',
          title:       'EconLit — AEA Bibliographic Database',
          description: 'The American Economic Association\'s comprehensive bibliography of economics literature covering journals, books, dissertations, and working papers. Available through most university library subscriptions.',
          url:         'https://www.aeaweb.org/econlit/',
          tag:         'Bibliography',
        },
        {
          id:          'ssrn-econ',
          title:       'SSRN — Economics Preprints',
          description: 'Social Science Research Network hosts preprints and working papers from economists worldwide, making cutting-edge research freely accessible before formal publication. Search by author, topic, or JEL classification.',
          url:         'https://www.ssrn.com/en/index.cfm/economics',
          tag:         'Preprints',
        },
      ],
    },

    /* ── 3. News & Analysis ─────────────────────────────────── */
    {
      id:    'news-analysis',
      label: 'News & Analysis',
      links: [
        {
          id:          'the-economist',
          title:       'The Economist — Global Economics Coverage',
          description: 'Weekly magazine offering in-depth analysis of international economics, business, finance, and policy from a liberal free-market perspective. The Economist Intelligence Unit also publishes widely cited country data.',
          url:         'https://www.economist.com/',
          tag:         'Magazine',
        },
        {
          id:          'bloomberg-econ',
          title:       'Bloomberg — Economics & Finance News',
          description: 'Real-time financial data, economic analysis, and market commentary from the world\'s leading financial information provider. Bloomberg Economics publishes research on global growth, inflation, and central bank policy.',
          url:         'https://www.bloomberg.com/economics',
          tag:         'Markets',
        },
        {
          id:          'reuters-econ',
          title:       'Reuters — Economic & Financial News',
          description: 'International wire service with rapid, balanced coverage of economic data releases, central bank decisions, trade policy, and financial markets. Frequently cited in academic papers for event dates.',
          url:         'https://www.reuters.com/',
          tag:         'News Wire',
        },
        {
          id:          'financial-times',
          title:       'Financial Times — Global Business & Economy',
          description: 'Premier international business newspaper with rigorous coverage of economics, monetary policy, and capital markets. The FT\'s data journalism team produces some of the best economic data visualizations in journalism.',
          url:         'https://www.ft.com/',
          tag:         'Business',
        },
        {
          id:          'wsj-economy',
          title:       'WSJ — Economy Section',
          description: 'The Wall Street Journal\'s economics coverage includes US data releases, Federal Reserve reporting, and expert commentary from journalists covering domestic and international economic policy.',
          url:         'https://www.wsj.com/economy',
          tag:         'US Economy',
        },
      ],
    },

    /* ── 4. Career & Professional ───────────────────────────── */
    {
      id:    'career-professional',
      label: 'Career & Professional',
      links: [
        {
          id:          'aea-careers',
          title:       'AEA — Student Career Resources',
          description: 'The American Economic Association\'s resources for undergraduate and graduate students including the JOE Network job listings, REU summer research program information, and tips for applying to PhD programs.',
          url:         'https://www.aeaweb.org/resources/students',
          tag:         'AEA',
        },
        {
          id:          'handshake-econ',
          title:       'Handshake — Campus Recruiting Platform',
          description: 'University-connected job board where economics students can find internships in finance, consulting, government, and policy research directly recruited through their institution.',
          url:         'https://joinhandshake.com/',
          tag:         'Internships',
        },
        {
          id:          'glassdoor-econ',
          title:       'Glassdoor — Company Reviews & Salaries',
          description: 'Salary data and interview question reports for economics-adjacent roles in consulting, finance, and policy. Useful for benchmarking compensation and preparing for case interviews.',
          url:         'https://www.glassdoor.com/',
          tag:         'Salaries',
        },
        {
          id:          'linkedin-econ',
          title:       'LinkedIn Jobs — Professional Network',
          description: 'The largest professional networking site and job board with strong coverage of analyst, research, and consulting roles that are common entry points for economics graduates.',
          url:         'https://www.linkedin.com/jobs/',
          tag:         'Networking',
        },
        {
          id:          'fed-internships',
          title:       'Federal Reserve — Student Programs & Internships',
          description: 'The Federal Reserve System offers research assistant and internship positions across its 12 regional banks and the Board of Governors, providing paid government economic research experience.',
          url:         'https://www.federalreserve.gov/careers/',
          tag:         'Government',
        },
      ],
    },

  ],
}
