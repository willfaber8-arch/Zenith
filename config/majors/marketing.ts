/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Marketing Major Resource Map
 *
 * Loaded on-demand only when a user declares a Marketing major.
 * Never included in the main bundle.
 *
 * Categories:
 *   1. Digital Marketing Tools   — GA4, Google Ads, Meta, HubSpot, Mailchimp
 *   2. Research & Insights       — Statista, Nielsen, Pew, Think w/ Google
 *   3. Design & Content          — Canva, Adobe Express, Figma, Buffer
 *   4. Learning & Certifications — Google, HubSpot Academy, Meta Blueprint
 *   5. Career Resources          — AMA, LinkedIn, Handshake, Glassdoor
 * ════════════════════════════════════════════════════════════════
 */

import type { MajorConfig } from './index'

export const MARKETING: MajorConfig = {
  id:         'marketing',
  name:       'Marketing',
  shortName:  'Marketing',
  department: 'School of Business',
  categories: [

    /* ── 1. Digital Marketing Tools ─────────────────────────── */
    {
      id:    'digital-marketing-tools',
      label: 'Digital Marketing Tools',
      links: [
        {
          id:          'google-analytics',
          title:       'Google Analytics 4',
          description: 'Industry-standard web analytics platform that tracks user behavior, traffic sources, conversion events, and audience demographics across websites and mobile apps. Creating a free GA4 property on a personal or class project site is one of the most practical skills a marketing student can add to a résumé.',
          url:         'https://analytics.google.com',
          tag:         'Analytics',
        },
        {
          id:          'google-ads',
          title:       'Google Ads',
          description: 'The world\'s largest online advertising platform, enabling paid search, display, shopping, and YouTube campaign creation and management. Google offers a free Skillshop certification and a hands-on demo account for students learning search engine marketing without spending real budget.',
          url:         'https://ads.google.com',
          tag:         'Paid Media',
        },
        {
          id:          'meta-business-suite',
          title:       'Meta Business Suite',
          description: 'Unified dashboard for managing Facebook and Instagram pages, running paid social campaigns, reviewing audience insights, and responding to messages across both platforms. Free to use with any Facebook Business account and essential for social media marketing coursework.',
          url:         'https://business.facebook.com',
          tag:         'Social Media',
        },
        {
          id:          'hubspot',
          title:       'HubSpot CRM & Marketing Hub',
          description: 'All-in-one inbound marketing platform covering CRM, email marketing, landing pages, social publishing, and marketing automation with a permanently free tier. Widely used in internships and agencies, making hands-on familiarity a differentiator in entry-level marketing job applications.',
          url:         'https://www.hubspot.com',
          tag:         'CRM / Inbound',
        },
        {
          id:          'mailchimp',
          title:       'Mailchimp — Email Marketing',
          description: 'Leading email marketing and automation platform offering audience segmentation, A/B testing, campaign analytics, and a drag-and-drop email builder. The free plan supports up to 500 contacts and 1,000 monthly email sends — sufficient for student campaign projects.',
          url:         'https://mailchimp.com',
          tag:         'Email Marketing',
        },
      ],
    },

    /* ── 2. Research & Insights ─────────────────────────────── */
    {
      id:    'research-insights',
      label: 'Research & Insights',
      links: [
        {
          id:          'statista',
          title:       'Statista — Market Data & Statistics',
          description: 'Aggregated statistics and market research reports covering over 170 industries and 150 countries, with charts ready to embed in presentations and papers. Many universities provide free institutional access — check your library portal before purchasing individual reports.',
          url:         'https://www.statista.com',
          tag:         'Market Research',
        },
        {
          id:          'nielsen',
          title:       'Nielsen — Audience Measurement',
          description: 'Global leader in audience measurement and consumer analytics, providing media ratings and brand perception data used by advertisers and media buyers worldwide. Nielsen\'s publicly available reports and whitepapers are useful secondary research sources for marketing case studies.',
          url:         'https://www.nielsen.com',
          tag:         'Audience Data',
        },
        {
          id:          'pew-research',
          title:       'Pew Research Center',
          description: 'Nonpartisan polling organization publishing free, methodologically rigorous reports on media consumption, social media usage, demographics, and consumer attitudes. An excellent source of reliable consumer insight data for marketing research papers and presentations.',
          url:         'https://www.pewresearch.org',
          tag:         'Consumer Insight',
        },
        {
          id:          'think-with-google',
          title:       'Think with Google',
          description: 'Google\'s marketing insights platform publishing trend reports, consumer behavior research, and campaign case studies backed by Google\'s search and behavioral data. Particularly useful for understanding micro-moment marketing and digital consumer journeys.',
          url:         'https://www.thinkwithgoogle.com',
          tag:         'Digital Trends',
        },
        {
          id:          'emarketer',
          title:       'eMarketer — Digital Marketing Intelligence',
          description: 'Forecasting and benchmarking platform for digital advertising spend, e-commerce growth, and social media usage across markets and industries. Free articles and reports preview the full paid research that agencies and brand teams rely on for strategic planning.',
          url:         'https://www.emarketer.com',
          tag:         'Digital Intelligence',
        },
      ],
    },

    /* ── 3. Design & Content ─────────────────────────────────── */
    {
      id:    'design-content',
      label: 'Design & Content',
      links: [
        {
          id:          'canva',
          title:       'Canva — Graphic Design Platform',
          description: 'Drag-and-drop design tool with thousands of templates for social media posts, presentations, infographics, email headers, and brand kits. The free plan is robust, and the Canva for Education program provides full Pro access to verified students.',
          url:         'https://www.canva.com',
          tag:         'Design',
        },
        {
          id:          'adobe-express',
          title:       'Adobe Express — Quick Content Creation',
          description: 'Adobe\'s lightweight browser-based design tool for creating social graphics, short videos, and branded one-pagers without requiring Photoshop or Illustrator experience. Free with a personal Adobe account and integrates with Adobe Creative Cloud assets.',
          url:         'https://www.adobe.com/express',
          tag:         'Content Creation',
        },
        {
          id:          'figma',
          title:       'Figma — UI & Campaign Design',
          description: 'Collaborative vector design tool used by marketing and product teams to prototype landing pages, design ad creatives, and maintain brand component libraries. Free Education accounts are available to students and instructors for team collaboration.',
          url:         'https://www.figma.com',
          tag:         'UI / Prototyping',
        },
        {
          id:          'unsplash',
          title:       'Unsplash — Free Stock Photography',
          description: 'Curated library of over 3 million high-resolution photographs freely licensed for commercial and editorial use without attribution requirements. An essential resource for marketing projects requiring professional imagery without a Getty or Shutterstock subscription.',
          url:         'https://unsplash.com',
          tag:         'Stock Photos',
        },
        {
          id:          'buffer',
          title:       'Buffer — Social Media Scheduling',
          description: 'Social media management tool for scheduling posts across Instagram, Facebook, X, LinkedIn, and Pinterest with built-in analytics and engagement tracking. The free plan supports three social channels and ten queued posts per channel — sufficient for student brand campaigns.',
          url:         'https://buffer.com',
          tag:         'Social Scheduling',
        },
      ],
    },

    /* ── 4. Learning & Certifications ───────────────────────── */
    {
      id:    'learning-certifications',
      label: 'Learning & Certifications',
      links: [
        {
          id:          'google-digital-garage',
          title:       'Google Digital Garage',
          description: 'Free online learning platform from Google offering certification courses in digital marketing fundamentals, data and tech, and career development. The "Fundamentals of Digital Marketing" certificate is globally recognized and takes approximately 40 hours to complete.',
          url:         'https://learndigital.withgoogle.com',
          tag:         'Free Certification',
        },
        {
          id:          'hubspot-academy',
          title:       'HubSpot Academy',
          description: 'Free certification hub offering credentials in inbound marketing, content marketing, email marketing, social media, and CRM administration recognized across the marketing industry. Certificates are shareable to LinkedIn and renew annually to reflect updated best practices.',
          url:         'https://academy.hubspot.com',
          tag:         'Certifications',
        },
        {
          id:          'coursera-marketing',
          title:       'Coursera — Marketing Specializations',
          description: 'University-led marketing courses and specializations from Northwestern, Illinois, and Wharton covering digital marketing, brand management, consumer behavior, and marketing analytics. Many courses are free to audit; financial aid is available for verified certificates.',
          url:         'https://www.coursera.org/browse/business/marketing',
          tag:         'Online Courses',
        },
        {
          id:          'meta-blueprint',
          title:       'Meta Blueprint',
          description: 'Meta\'s official learning platform for Facebook and Instagram advertising, offering free courses and paid professional certifications in media buying, creative strategy, and marketing science. Blueprint certifications are highly valued by agencies and brand teams that run paid social campaigns.',
          url:         'https://www.facebook.com/business/learn',
          tag:         'Meta Certification',
        },
        {
          id:          'linkedin-learning-marketing',
          title:       'LinkedIn Learning — Marketing',
          description: 'Extensive on-demand video library covering SEO, content strategy, brand storytelling, influencer marketing, and marketing analytics taught by industry practitioners. Courses are often available free through public library cards or university LinkedIn Learning subscriptions.',
          url:         'https://www.linkedin.com/learning',
          tag:         'Video Learning',
        },
      ],
    },

    /* ── 5. Career Resources ─────────────────────────────────── */
    {
      id:    'career-resources',
      label: 'Career Resources',
      links: [
        {
          id:          'ama-careers',
          title:       'American Marketing Association — Careers',
          description: 'Career center maintained by the AMA featuring job postings, salary surveys, and a professional development library. Student AMA chapters offer networking events and case competitions that build relationships with local marketing professionals.',
          url:         'https://www.ama.org/careers',
          tag:         'Professional Org',
        },
        {
          id:          'linkedin-jobs-marketing',
          title:       'LinkedIn Jobs — Marketing',
          description: 'The dominant professional network for marketing job discovery, with recruiter inbound, alumni connection features, and job alerts. Optimizing your LinkedIn profile with skills, certifications, and portfolio links dramatically increases recruiter visibility for marketing roles.',
          url:         'https://www.linkedin.com/jobs',
          tag:         'Job Network',
        },
        {
          id:          'handshake-marketing',
          title:       'Handshake',
          description: 'University-connected recruiting platform where top employers post internships and entry-level marketing positions exclusively for students. Career fairs, employer sessions, and a verified student profile make Handshake the highest-intent early-career platform for marketing majors.',
          url:         'https://joinhandshake.com',
          tag:         'Campus Recruiting',
        },
        {
          id:          'marketing-hire',
          title:       'MarketingHire — Specialized Job Board',
          description: 'Niche job board aggregating marketing, advertising, PR, and communications roles from agencies, brands, and startups not always found on general job boards. Useful for discovering boutique agency internships and brand manager training programs.',
          url:         'https://www.marketinghire.com',
          tag:         'Specialized Jobs',
        },
        {
          id:          'glassdoor-marketing',
          title:       'Glassdoor — Salary & Reviews',
          description: 'Company review platform with salary data, interview question archives, and culture ratings submitted anonymously by employees. Use Glassdoor to benchmark internship and entry-level marketing salaries by company, city, and years of experience before salary negotiations.',
          url:         'https://www.glassdoor.com',
          tag:         'Salary Research',
        },
      ],
    },

  ],
}
