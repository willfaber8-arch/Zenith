/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Communications & Media Studies Major Resource Map
 *
 * Loaded on-demand only when a user declares a Communications major.
 * Never included in the main bundle.
 *
 * Categories:
 *   1. Media & Writing Tools   — AP Stylebook, Grammarly, Canva, Adobe Express, Hemingway
 *   2. Journalism & Reporting  — SPJ, ProPublica, Poynter, Nieman Lab, Reuters Handbook
 *   3. Digital & Social Media  — Hootsuite, Buffer, Sprout Social, Google Analytics, HubSpot
 *   4. Research Resources      — Comm Abstracts, JSTOR, Pew Research, MediaShift, Nielsen
 *   5. Career Resources        — PRSA, Broadcasting & Cable, MediaBistro, LinkedIn, Handshake
 * ════════════════════════════════════════════════════════════════
 */

import type { MajorConfig } from './index'

export const COMMUNICATIONS: MajorConfig = {
  id:         'communications',
  name:       'Communications & Media Studies',
  shortName:  'Comm',
  department: 'College of Communication',
  categories: [

    /* ── 1. Media & Writing Tools ───────────────────────────── */
    {
      id:    'media-writing-tools',
      label: 'Media & Writing Tools',
      links: [
        {
          id:          'ap-stylebook',
          title:       'AP Stylebook — Journalism Style Guide',
          description: 'The authoritative style guide used by newspapers, wire services, and broadcast outlets worldwide. Required reading for every journalism and public relations student — covers grammar, usage, and media law basics.',
          url:         'https://www.apstylebook.com/',
          tag:         'Style Guide',
        },
        {
          id:          'grammarly',
          title:       'Grammarly — AI Writing Assistant',
          description: 'AI-powered writing assistant that checks grammar, tone, clarity, and plagiarism across emails, essays, and long-form pieces. The free browser extension integrates with Google Docs, email, and most web editors.',
          url:         'https://www.grammarly.com/',
          tag:         'Writing',
        },
        {
          id:          'canva',
          title:       'Canva — Visual Content Creation',
          description: 'Browser-based design platform with thousands of templates for social media graphics, presentations, infographics, and print materials. Free education accounts provide access to premium templates and the Brand Kit feature.',
          url:         'https://www.canva.com/',
          tag:         'Design',
        },
        {
          id:          'adobe-express',
          title:       'Adobe Express — Quick Content Creation',
          description: 'Adobe\'s simplified creative tool for producing branded social media posts, short videos, PDFs, and web pages without needing full Creative Suite expertise. Free for students enrolled at participating institutions.',
          url:         'https://www.adobe.com/express/',
          tag:         'Adobe',
        },
        {
          id:          'hemingway-editor',
          title:       'Hemingway Editor — Readability Tool',
          description: 'Browser-based writing clarity tool that highlights complex sentences, passive voice, adverbs, and readability grade level in real time. Widely used in journalism courses to train clear, concise writing habits.',
          url:         'https://hemingwayapp.com/',
          tag:         'Clarity',
        },
      ],
    },

    /* ── 2. Journalism & Reporting ──────────────────────────── */
    {
      id:    'journalism-reporting',
      label: 'Journalism & Reporting',
      links: [
        {
          id:          'spj',
          title:       'SPJ — Society of Professional Journalists',
          description: 'The nation\'s largest and most broad-based journalism organization, providing a code of ethics, press freedom resources, and the Sigma Delta Chi awards for distinguished journalism. Student chapters are active at most journalism schools.',
          url:         'https://www.spj.org/',
          tag:         'Ethics',
        },
        {
          id:          'propublica',
          title:       'ProPublica — Investigative Journalism',
          description: 'Independent nonprofit newsroom producing investigative journalism in the public interest with a commitment to open-source data and methodology transparency. ProPublica\'s data journalism projects are excellent models for student investigative work.',
          url:         'https://www.propublica.org/',
          tag:         'Investigative',
        },
        {
          id:          'poynter',
          title:       'Poynter — Journalism Training & Ethics',
          description: 'Global leader in journalism education offering free and paid online training courses, media ethics analysis, and daily industry news through MediaWire. Poynter\'s fact-checking resources are widely cited in media literacy research.',
          url:         'https://www.poynter.org/',
          tag:         'Training',
        },
        {
          id:          'nieman-lab',
          title:       'Nieman Journalism Lab — Media Innovation',
          description: 'Harvard\'s Nieman Foundation research lab reporting on the future of journalism, digital news business models, and emerging media technologies. An essential read for students interested in the evolving media landscape.',
          url:         'https://www.niemanlab.org/',
          tag:         'Innovation',
        },
        {
          id:          'reuters-handbook',
          title:       'Reuters Handbook of Journalism',
          description: 'Reuters\' publicly available editorial standards handbook covering reporting, sourcing, fairness, and digital-age practices used by one of the world\'s largest news agencies. An excellent free professional reference for student journalists.',
          url:         'https://handbook.reuters.com/',
          tag:         'Standards',
        },
      ],
    },

    /* ── 3. Digital & Social Media ──────────────────────────── */
    {
      id:    'digital-social-media',
      label: 'Digital & Social Media',
      links: [
        {
          id:          'hootsuite',
          title:       'Hootsuite — Social Media Management',
          description: 'Industry-leading platform for scheduling, publishing, and analyzing social media content across multiple networks from a single dashboard. Free student accounts are available and the platform is widely used in PR and marketing internships.',
          url:         'https://www.hootsuite.com/',
          tag:         'Scheduling',
        },
        {
          id:          'buffer',
          title:       'Buffer — Social Publishing & Analytics',
          description: 'Clean, intuitive social media scheduling and analytics tool used by independent creators and small media teams. Buffer\'s free plan supports up to three channels and provides engagement analytics.',
          url:         'https://buffer.com/',
          tag:         'Publishing',
        },
        {
          id:          'sprout-social',
          title:       'Sprout Social — Enterprise Social Analytics',
          description: 'Professional social media management platform with advanced listening, analytics, and team collaboration features. Sprout offers free trials useful for class projects requiring documented social media campaign performance.',
          url:         'https://sproutsocial.com/',
          tag:         'Analytics',
        },
        {
          id:          'google-analytics',
          title:       'Google Analytics — Web Traffic Analysis',
          description: 'The industry-standard platform for tracking website traffic, user behavior, and content performance. Understanding Google Analytics is a core competency for digital communications, SEO, and content strategy roles.',
          url:         'https://analytics.google.com/',
          tag:         'Web Analytics',
        },
        {
          id:          'hubspot-academy',
          title:       'HubSpot Academy — Inbound Marketing Certs',
          description: 'Free certification courses in inbound marketing, content marketing, email marketing, social media, and digital advertising. HubSpot certifications are recognized by employers and add concrete credentials to a communications resume.',
          url:         'https://academy.hubspot.com/',
          tag:         'Certifications',
        },
      ],
    },

    /* ── 4. Research Resources ──────────────────────────────── */
    {
      id:    'research-resources',
      label: 'Research Resources',
      links: [
        {
          id:          'comm-abstracts',
          title:       'Communication Abstracts — Research Index',
          description: 'Specialized index of communication and media studies research literature covering interpersonal communication, mass media, rhetoric, journalism, and PR. Available through most university library subscriptions.',
          url:         'https://www.communicationabstracts.com/',
          tag:         'Bibliography',
        },
        {
          id:          'jstor-comm',
          title:       'JSTOR — Communication Studies Archive',
          description: 'Archival database with full-text access to communication and media journals including Journal of Communication and Communication Research. Free limited access is available without institutional login.',
          url:         'https://www.jstor.org/',
          tag:         'Archive',
        },
        {
          id:          'pew-journalism',
          title:       'Pew Research — Journalism & Media',
          description: 'Nonpartisan research center\'s journalism and media project publishing annual State of the News Media report and surveys on media consumption, trust, and digital habits. A primary quantitative source for media studies papers.',
          url:         'https://journalism.pewresearch.org/',
          tag:         'Media Research',
        },
        {
          id:          'mediashift',
          title:       'MediaShift — Media & Technology Reporting',
          description: 'Publication covering the intersection of media and technology including journalism innovation, digital platforms, and audience engagement strategies. Useful for staying current on industry trends discussed in communications courses.',
          url:         'https://mediashift.org/',
          tag:         'Industry Trends',
        },
        {
          id:          'nielsen',
          title:       'Nielsen — Audience Measurement Data',
          description: 'Global leader in audience measurement publishing free reports on television, streaming, radio, and digital media consumption trends. Nielsen data is the industry currency for understanding media audiences cited in media economics research.',
          url:         'https://www.nielsen.com/',
          tag:         'Audience Data',
        },
      ],
    },

    /* ── 5. Career Resources ────────────────────────────────── */
    {
      id:    'career-resources',
      label: 'Career Resources',
      links: [
        {
          id:          'prsa',
          title:       'PRSA — Public Relations Society of America',
          description: 'The leading professional organization for public relations practitioners, offering the APR accreditation, a job board, mentorship programs, and student chapters (PRSSA) at colleges across the country.',
          url:         'https://www.prsa.org/',
          tag:         'Public Relations',
        },
        {
          id:          'nexttv',
          title:       'Next TV — Broadcasting & Streaming Industry',
          description: 'Industry trade publication covering television, streaming, and video technology news with job listings across broadcasting, production, and digital media. Formerly Broadcasting & Cable, it tracks the evolving linear and streaming TV landscape.',
          url:         'https://www.nexttv.com/',
          tag:         'Broadcasting',
        },
        {
          id:          'mediabistro',
          title:       'Mediabistro — Media Industry Jobs',
          description: 'Specialized job board and career development platform for media professionals in journalism, publishing, social media, PR, and content strategy. Offers courses and freelance marketplaces alongside traditional job listings.',
          url:         'https://www.mediabistro.com/',
          tag:         'Media Jobs',
        },
        {
          id:          'linkedin-comm',
          title:       'LinkedIn Jobs — Professional Network',
          description: 'The largest professional networking site with extensive communications, PR, marketing, and media job listings. Building a strong LinkedIn profile with portfolio samples is essential for communications job seekers.',
          url:         'https://www.linkedin.com/jobs/',
          tag:         'Networking',
        },
        {
          id:          'handshake-comm',
          title:       'Handshake — Campus Recruiting Platform',
          description: 'University-integrated job board where communications students can find internships in newsrooms, PR agencies, marketing departments, and media companies recruited directly through their institution.',
          url:         'https://joinhandshake.com/',
          tag:         'Internships',
        },
      ],
    },

  ],
}
