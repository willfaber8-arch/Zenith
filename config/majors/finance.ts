/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Finance Major Resource Map
 *
 * Loaded on-demand only when a user declares a Finance major.
 * Never included in the main bundle.
 *
 * Categories:
 *   1. Market Data & Research       — Bloomberg, Yahoo Finance, FRED
 *   2. Financial Analysis Tools     — Finviz, Stock Analysis, Macrotrends
 *   3. Certifications & Prep        — CFA Institute, CPA, Wall Street Prep
 *   4. Professional Organizations   — CFA Institute, FPA, GARP
 *   5. Career Resources             — Levels.fyi, eFinancialCareers, WSO
 * ════════════════════════════════════════════════════════════════
 */

import type { MajorConfig } from './index'

export const FINANCE: MajorConfig = {
  id:         'finance',
  name:       'Finance',
  shortName:  'Finance',
  department: 'School of Business',
  categories: [

    /* ── 1. Market Data & Research ──────────────────────────── */
    {
      id:    'market-data-research',
      label: 'Market Data & Research',
      links: [
        {
          id:          'bloomberg',
          title:       'Bloomberg — Financial News & Data',
          description: 'The global benchmark for financial markets news, data, and analysis covering equities, fixed income, commodities, FX, and macroeconomics. Many business schools provide Bloomberg Terminal access in on-campus labs — the Terminal certification itself is a valuable credential for investment banking and asset management recruiting.',
          url:         'https://www.bloomberg.com',
          tag:         'Markets',
        },
        {
          id:          'yahoo-finance',
          title:       'Yahoo Finance',
          description: 'Free and widely accessible source for real-time stock quotes, historical price data, earnings reports, balance sheets, and analyst ratings. The downloadable CSV price history feature is frequently used in Excel and Python financial modeling coursework.',
          url:         'https://finance.yahoo.com',
          tag:         'Stock Data',
        },
        {
          id:          'fred',
          title:       'FRED — Federal Reserve Economic Data',
          description: 'Federal Reserve Bank of St. Louis database with over 800,000 economic time series including interest rates, GDP, inflation, unemployment, and monetary aggregates, all freely downloadable. An essential resource for econometrics coursework, thesis research, and macroeconomic analysis.',
          url:         'https://fred.stlouisfed.org',
          tag:         'Macroeconomic Data',
        },
        {
          id:          'morningstar',
          title:       'Morningstar — Investment Research',
          description: 'Independent investment research firm providing star ratings, analyst reports, and fundamental data on stocks, ETFs, and mutual funds used by professional portfolio managers and advisors. The free Morningstar account provides access to a useful subset of fund and equity research.',
          url:         'https://www.morningstar.com',
          tag:         'Investment Research',
        },
        {
          id:          'seeking-alpha',
          title:       'Seeking Alpha — Equity Analysis',
          description: 'Crowd-sourced financial analysis platform featuring long-form equity research articles, earnings call transcripts, and dividend history tracking from both professional and retail analysts. Useful for building awareness of the range of analytical frameworks applied to stock valuation.',
          url:         'https://seekingalpha.com',
          tag:         'Equity Research',
        },
      ],
    },

    /* ── 2. Financial Analysis Tools ────────────────────────── */
    {
      id:    'financial-analysis-tools',
      label: 'Financial Analysis Tools',
      links: [
        {
          id:          'finviz',
          title:       'Finviz — Stock Screener & Visualization',
          description: 'Free equity screener with over 70 fundamental and technical filters, a heat map of S&P 500 sector performance, and insider transaction tracking. The free version is sufficient for most academic screening projects in security analysis courses.',
          url:         'https://finviz.com',
          tag:         'Stock Screener',
        },
        {
          id:          'stock-analysis',
          title:       'Stock Analysis — Financial Statements',
          description: 'Clean, organized presentation of 10-K income statements, balance sheets, cash flow statements, and key ratios going back 10+ years for thousands of publicly traded companies. Particularly useful for building comparable company analysis (comps) tables in financial modeling assignments.',
          url:         'https://stockanalysis.com',
          tag:         'Fundamentals',
        },
        {
          id:          'macrotrends',
          title:       'Macrotrends — Long-Term Financial Charts',
          description: 'Historical financial data and charting tool covering commodity prices, exchange rates, interest rates, and stock metrics going back decades. Excellent for long-horizon time series analysis in macrofinance and investment management coursework.',
          url:         'https://www.macrotrends.net',
          tag:         'Historical Data',
        },
        {
          id:          'quandl-nasdaq',
          title:       'Nasdaq Data Link (Quandl)',
          description: 'Financial and alternative data marketplace offering free and premium datasets for equities, futures, options, and economic indicators accessible via API in Python and R. Widely used in quantitative finance and data science courses requiring programmatic market data access.',
          url:         'https://data.nasdaq.com',
          tag:         'Data API',
        },
        {
          id:          'simply-wall-st',
          title:       'Simply Wall St — Visual Stock Analysis',
          description: 'Visual equity analysis platform that translates complex financial data into snowflake charts assessing value, future performance, past performance, health, and dividends. Useful for quickly assessing a company\'s financial position before diving into a full DCF model.',
          url:         'https://simplywall.st',
          tag:         'Visualization',
        },
      ],
    },

    /* ── 3. Certifications & Prep ───────────────────────────── */
    {
      id:    'certifications-prep',
      label: 'Certifications & Prep',
      links: [
        {
          id:          'cfa-institute',
          title:       'CFA Institute',
          description: 'Home of the Chartered Financial Analyst designation, the most globally recognized credential in investment management and financial analysis. The CFA Institute publishes the official Level I–III curriculum, practice exams, and candidate resources for exam registration.',
          url:         'https://www.cfainstitute.org',
          tag:         'CFA',
        },
        {
          id:          'cpa-exam',
          title:       'AICPA — CPA Exam',
          description: 'American Institute of CPAs administers the Uniform CPA Examination, the entry credential for public accounting practice across all U.S. states. The AICPA Blueprint and released sample questions are essential planning tools for candidates mapping their exam preparation timeline.',
          url:         'https://www.aicpa-cima.com/cpa-exam',
          tag:         'CPA',
        },
        {
          id:          'kaplan-cfa',
          title:       'Kaplan Schweser — CFA Study Materials',
          description: 'Industry-leading third-party CFA exam prep provider offering SchweserNotes, mock exams, Q-Banks, and on-demand video instruction. Historically one of the most widely used supplementary resources for CFA Level I candidates alongside the official curriculum.',
          url:         'https://www.kaplan.com/cfa',
          tag:         'CFA Prep',
        },
        {
          id:          'investopedia-academy',
          title:       'Investopedia Academy — Finance Courses',
          description: 'Paid online courses covering financial modeling, Excel for finance, options trading, technical analysis, and CFA exam preparation taught by practicing finance professionals. A practical complement to academic coursework with immediately applicable skills.',
          url:         'https://www.investopedia.com/investopedia-academy-4587372',
          tag:         'Finance Courses',
        },
        {
          id:          'wall-street-prep',
          title:       'Wall Street Prep',
          description: 'Leading provider of financial modeling and valuation self-study courses used by investment banks and private equity firms to train analysts. The Premium Package covering DCF, LBO, M&A, and comps modeling is the industry benchmark for technical interview preparation.',
          url:         'https://www.wallstreetprep.com',
          tag:         'Financial Modeling',
        },
      ],
    },

    /* ── 4. Professional Organizations ─────────────────────── */
    {
      id:    'professional-organizations',
      label: 'Professional Organizations',
      links: [
        {
          id:          'cfa-institute-org',
          title:       'CFA Institute — Membership & Society',
          description: 'Global association of investment professionals offering ethical standards, career resources, and a network of over 160 CFA societies worldwide. CFA Institute membership is open to candidates in the CFA Program and provides access to research, webinars, and professional networking.',
          url:         'https://www.cfainstitute.org',
          tag:         'Investment Professionals',
        },
        {
          id:          'fpa',
          title:       'Financial Planning Association',
          description: 'Leading professional organization for CERTIFIED FINANCIAL PLANNER™ professionals and those pursuing the CFP credential, offering continuing education, advocacy, and a robust chapter network. The FPA Career Center connects planners with fee-only and fee-based advisory firms.',
          url:         'https://www.plannersearch.org',
          tag:         'Financial Planning',
        },
        {
          id:          'napfa',
          title:       'NAPFA — Fee-Only Financial Planners',
          description: 'National Association of Personal Financial Advisors representing fee-only financial planners who operate without sales commissions. NAPFA publishes a public planner directory and hosts annual conferences that offer student attendance opportunities.',
          url:         'https://www.napfa.org',
          tag:         'Fee-Only Advice',
        },
        {
          id:          'garp',
          title:       'GARP — Global Association of Risk Professionals',
          description: 'International organization for risk management professionals administering the Financial Risk Manager (FRM) designation, the most recognized global credential in financial risk. GARP student membership provides free access to risk management research and webinars.',
          url:         'https://www.garp.org',
          tag:         'Risk Management',
        },
        {
          id:          'sfa',
          title:       'SFA — Society for Financial Analysis',
          description: 'Professional society promoting investment analysis education and the CFA curriculum at the regional level with networking events, speaker series, and mock exams for candidates. Local SFA chapters are often the best venue for connecting with CFA charterholders in your geographic area.',
          url:         'https://www.sfa.org.uk',
          tag:         'Investment Analysis',
        },
      ],
    },

    /* ── 5. Career Resources ─────────────────────────────────── */
    {
      id:    'career-resources',
      label: 'Career Resources',
      links: [
        {
          id:          'levels-fyi-finance',
          title:       'Levels.fyi — Finance & Banking Compensation',
          description: 'Crowdsourced total compensation data for finance, banking, and fintech roles broken down by base salary, bonus, and benefits at hundreds of firms. Especially useful for comparing front-office investment banking and asset management offers during recruiting season.',
          url:         'https://www.levels.fyi',
          tag:         'Compensation Data',
        },
        {
          id:          'handshake-finance',
          title:       'Handshake',
          description: 'University-connected recruiting platform where banks, asset managers, and fintech firms post internship and full-time positions exclusively targeting students. On-campus finance recruiting timelines for summer analyst programs make Handshake applications a critical first step.',
          url:         'https://joinhandshake.com',
          tag:         'Campus Recruiting',
        },
        {
          id:          'efinancialcareers',
          title:       'eFinancialCareers',
          description: 'Specialized job board for financial services careers including investment banking, asset management, quantitative finance, risk, and compliance roles globally. Career advice articles on technical interview preparation and market trends in financial services are freely accessible.',
          url:         'https://www.efinancialcareers.com',
          tag:         'Finance Jobs',
        },
        {
          id:          'wall-street-oasis',
          title:       'Wall Street Oasis',
          description: 'Community and resource hub for finance students and professionals featuring interview preparation guides, compensation reports, and candid firm-specific forum discussions. The investment banking and private equity interview prep sections are among the most detailed free resources available.',
          url:         'https://www.wallstreetoasis.com',
          tag:         'Finance Community',
        },
        {
          id:          'glassdoor-finance',
          title:       'Glassdoor — Finance Salaries & Reviews',
          description: 'Company review and salary platform with extensive data for investment banks, consulting firms, hedge funds, and asset managers submitted anonymously by employees. Essential for researching interview processes, work culture, and compensation benchmarks before applying to financial services roles.',
          url:         'https://www.glassdoor.com',
          tag:         'Salary Research',
        },
      ],
    },

  ],
}
