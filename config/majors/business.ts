import type { MajorConfig } from './index'

export const BUSINESS: MajorConfig = {
  id:         'business',
  name:       'Business Administration',
  shortName:  'Business',
  department: 'School of Business',
  categories: [
    {
      id:    'finance-accounting',
      label: 'Finance & Accounting',
      links: [
        {
          id:          'investopedia',
          title:       'Investopedia',
          description: 'Comprehensive financial dictionary, tutorials, and market analysis. Essential reference for finance courses and investment concepts.',
          url:         'https://www.investopedia.com',
          tag:         'Finance',
        },
        {
          id:          'macrotrends',
          title:       'Macrotrends',
          description: 'Free financial data, stock charts, economic indicators, and historical datasets. Great for financial modeling and research projects.',
          url:         'https://www.macrotrends.net',
          tag:         'Data',
        },
        {
          id:          'sec-edgar',
          title:       'SEC EDGAR',
          description: 'Access publicly filed company financial statements (10-K, 10-Q, 8-K). Indispensable for financial analysis and accounting coursework.',
          url:         'https://www.sec.gov/cgi-bin/browse-edgar',
          tag:         'Filings',
        },
        {
          id:          'accounting-coach',
          title:       'AccountingCoach',
          description: 'Free accounting tutorials covering financial statements, journal entries, and managerial accounting principles at every skill level.',
          url:         'https://www.accountingcoach.com',
          tag:         'Accounting',
        },
      ],
    },
    {
      id:    'strategy-management',
      label: 'Strategy & Management',
      links: [
        {
          id:          'hbr',
          title:       'Harvard Business Review',
          description: 'Peer-reviewed management insights, case study archives, and leadership frameworks from the world\'s leading business publication.',
          url:         'https://hbr.org',
          tag:         'Strategy',
        },
        {
          id:          'mit-sloan-review',
          title:       'MIT Sloan Management Review',
          description: 'Research-backed articles on strategy, innovation, and organizational leadership from MIT\'s Sloan School faculty and contributors.',
          url:         'https://sloanreview.mit.edu',
          tag:         'Management',
        },
        {
          id:          'bcg-insights',
          title:       'BCG Henderson Institute',
          description: 'Consulting-grade strategic frameworks, industry reports, and business model innovation research from Boston Consulting Group.',
          url:         'https://www.bcg.com/publications',
          tag:         'Consulting',
        },
      ],
    },
    {
      id:    'data-analytics',
      label: 'Business Analytics',
      links: [
        {
          id:          'tableau-public',
          title:       'Tableau Public',
          description: 'Practice data visualization and build business intelligence dashboards. Free tier is fully functional for coursework and portfolio projects.',
          url:         'https://public.tableau.com',
          tag:         'Viz',
        },
        {
          id:          'google-analytics',
          title:       'Google Data Analytics',
          description: 'Free Google certification coursework and sandbox tools for learning marketing analytics, attribution modeling, and data-driven decision making.',
          url:         'https://analytics.google.com/analytics/academy',
          tag:         'Analytics',
        },
        {
          id:          'statista',
          title:       'Statista',
          description: 'Global statistics and market data portal. Cite industry figures, consumer trend data, and global market share metrics for business reports.',
          url:         'https://www.statista.com',
          tag:         'Stats',
        },
      ],
    },
    {
      id:    'entrepreneurship',
      label: 'Entrepreneurship',
      links: [
        {
          id:          'ycombinator-library',
          title:       'Y Combinator Startup School',
          description: 'Free curriculum from YC covering ideation, product-market fit, fundraising, and growth. Essential for entrepreneurship coursework and real ventures.',
          url:         'https://www.startupschool.org',
          tag:         'Startup',
        },
        {
          id:          'crunchbase',
          title:       'Crunchbase',
          description: 'Research startup funding rounds, investor profiles, and industry deal flow. Perfect for venture capital studies and competitive analysis.',
          url:         'https://www.crunchbase.com',
          tag:         'VC Research',
        },
        {
          id:          'first-round-review',
          title:       'First Round Review',
          description: 'Practical long-form essays on building companies — from hiring and culture to product strategy and early-stage fundraising. Written by founders and operators, not journalists.',
          url:         'https://review.firstround.com',
          tag:         'Founder Advice',
        },
        {
          id:          'angellist-talent',
          title:       'Wellfound (AngelList) Jobs',
          description: 'Startup job board with equity-transparent listings. Find internships and early-career roles at seed and Series A companies — ideal for students interested in high-growth environments.',
          url:         'https://wellfound.com',
          tag:         'Startup Jobs',
        },
      ],
    },
    {
      id:    'markets-research',
      label: 'Markets & Research',
      links: [
        {
          id:          'bloomberg-markets',
          title:       'Bloomberg Markets',
          description: 'Real-time financial news, market data, economic indicators, and company profiles. The global standard for financial markets coverage in business courses.',
          url:         'https://www.bloomberg.com/markets',
          tag:         'Markets',
        },
        {
          id:          'yahoo-finance',
          title:       'Yahoo Finance',
          description: 'Free stock screener, financial statements, earnings calendars, and portfolio tracker. A fast research tool for valuation exercises and equity analysis assignments.',
          url:         'https://finance.yahoo.com',
          tag:         'Stocks',
        },
        {
          id:          'mckinsey-insights',
          title:       'McKinsey Insights',
          description: 'Free strategy articles, industry reports, and frameworks from McKinsey Global Institute. Covers digital transformation, ESG, supply chains, and global macro trends.',
          url:         'https://www.mckinsey.com/insights',
          tag:         'Consulting',
        },
        {
          id:          'deloitte-insights',
          title:       'Deloitte Insights',
          description: 'Research reports and thought leadership on technology, human capital, industry disruption, and regulatory trends from Deloitte\'s Global Research team.',
          url:         'https://www2.deloitte.com/us/en/insights.html',
          tag:         'Research',
        },
      ],
    },
  ],
}
