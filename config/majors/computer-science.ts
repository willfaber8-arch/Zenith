/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Computer Science Major Resource Map
 *
 * Loaded on-demand only when a user declares a Computer Science major.
 * Never included in the main bundle.
 *
 * Categories:
 *   1. Learning & Practice         — LeetCode, HackerRank, freeCodeCamp, The Odin Project, CS50
 *   2. Documentation & Reference   — MDN, DevDocs, Stack Overflow, GeeksforGeeks, W3Schools
 *   3. Version Control & Collab    — GitHub, GitLab, Bitbucket, Git Docs
 *   4. Career & Internships        — Levels.fyi, Blind, AngelList, Glassdoor, LinkedIn
 *   5. Research & Papers           — arXiv CS, ACM DL, IEEE Xplore, Google Scholar
 * ════════════════════════════════════════════════════════════════
 */

import type { MajorConfig } from './index'

export const COMPUTER_SCIENCE: MajorConfig = {
  id:         'computer-science',
  name:       'Computer Science',
  shortName:  'CS',
  department: 'College of Computing',
  categories: [

    /* ── 1. Learning & Practice ─────────────────────────────── */
    {
      id:    'learning-practice',
      label: 'Learning & Practice',
      links: [
        {
          id:          'leetcode',
          title:       'LeetCode — Coding Interview Prep',
          description: 'The go-to platform for practicing data structures and algorithm problems categorized by difficulty and topic. Widely used for technical interview preparation at top tech companies.',
          url:         'https://leetcode.com/',
          tag:         'Algorithms',
        },
        {
          id:          'hackerrank',
          title:       'HackerRank — Skills Certification',
          description: 'Coding challenges and certifications across domains including algorithms, SQL, data science, and REST APIs. Many employers use HackerRank assessments directly in their hiring pipelines.',
          url:         'https://www.hackerrank.com/',
          tag:         'Practice',
        },
        {
          id:          'freecodecamp',
          title:       'freeCodeCamp — Full-Stack Curriculum',
          description: 'Free structured curriculum covering responsive web design, JavaScript algorithms, front-end libraries, APIs, and data science. Earns verified certifications upon project completion.',
          url:         'https://www.freecodecamp.org/',
          tag:         'Curriculum',
        },
        {
          id:          'odin-project',
          title:       'The Odin Project — Web Development Path',
          description: 'Open-source full-stack web development curriculum built around real projects and community support. Covers HTML, CSS, JavaScript, Ruby on Rails, and Node.js from foundations to deployment.',
          url:         'https://www.theodinproject.com/',
          tag:         'Web Dev',
        },
        {
          id:          'cs50',
          title:       'CS50 — Harvard Introduction to CS',
          description: 'Harvard\'s flagship introductory computer science course, free and open to all via edX. Covers C, Python, SQL, web development, and cybersecurity with world-class production quality.',
          url:         'https://cs50.harvard.edu/',
          tag:         'Foundations',
        },
      ],
    },

    /* ── 2. Documentation & Reference ──────────────────────── */
    {
      id:    'documentation-reference',
      label: 'Documentation & Reference',
      links: [
        {
          id:          'mdn-web-docs',
          title:       'MDN Web Docs — Web Platform Reference',
          description: 'The definitive reference for HTML, CSS, JavaScript, and Web APIs maintained by Mozilla. Includes detailed specifications, live code examples, and browser compatibility tables.',
          url:         'https://developer.mozilla.org/',
          tag:         'Web APIs',
        },
        {
          id:          'devdocs',
          title:       'DevDocs — Unified API Documentation',
          description: 'Aggregates documentation for 200+ programming languages, frameworks, and tools in a single fast offline-capable interface. Covers Python, React, Node.js, PostgreSQL, and many more.',
          url:         'https://devdocs.io/',
          tag:         'Reference',
        },
        {
          id:          'stackoverflow-cs',
          title:       'Stack Overflow — Developer Q&A',
          description: 'The largest community-curated Q&A database for programming problems. Answers cover nearly every language, framework, and toolchain a CS student will encounter.',
          url:         'https://stackoverflow.com/',
          tag:         'Q&A',
        },
        {
          id:          'geeksforgeeks',
          title:       'GeeksforGeeks — CS Concepts & Tutorials',
          description: 'In-depth tutorials and explained implementations for data structures, algorithms, operating systems, DBMS, computer networks, and system design topics. Widely used for exam and interview prep.',
          url:         'https://www.geeksforgeeks.org/',
          tag:         'Tutorials',
        },
        {
          id:          'w3schools',
          title:       'W3Schools — Beginner Web Reference',
          description: 'Approachable reference and interactive sandbox for HTML, CSS, JavaScript, Python, SQL, and PHP. An excellent starting point for students new to web technologies.',
          url:         'https://www.w3schools.com/',
          tag:         'Web',
        },
      ],
    },

    /* ── 3. Version Control & Collaboration ─────────────────── */
    {
      id:    'version-control',
      label: 'Version Control & Collaboration',
      links: [
        {
          id:          'github-cs',
          title:       'GitHub — Code Hosting & Portfolio',
          description: 'Host repositories, collaborate on open-source projects, and build a public coding portfolio that employers review during hiring. Essential for CS internship and job applications.',
          url:         'https://github.com/',
          tag:         'Git',
        },
        {
          id:          'gitlab',
          title:       'GitLab — DevOps Platform',
          description: 'Full DevOps lifecycle platform with integrated CI/CD pipelines, issue tracking, and container registry in addition to Git hosting. Free for students with 5 GB storage and unlimited private repos.',
          url:         'https://gitlab.com/',
          tag:         'CI/CD',
        },
        {
          id:          'bitbucket',
          title:       'Bitbucket — Atlassian Git Hosting',
          description: 'Git repository hosting tightly integrated with Jira and Confluence for project management. Offers free private repos and is commonly used in enterprise internship environments.',
          url:         'https://bitbucket.org/',
          tag:         'Repositories',
        },
        {
          id:          'git-docs',
          title:       'Git Official Documentation',
          description: 'The authoritative reference for every Git command, branching workflow, and rebase strategy. Includes the full Pro Git book free online, covering beginner through advanced usage.',
          url:         'https://git-scm.com/doc',
          tag:         'Reference',
        },
      ],
    },

    /* ── 4. Career & Internships ────────────────────────────── */
    {
      id:    'career-internships',
      label: 'Career & Internships',
      links: [
        {
          id:          'levels-fyi',
          title:       'Levels.fyi — Compensation Data',
          description: 'Crowd-sourced salary, equity, and total compensation data for software engineers at hundreds of companies. Invaluable for evaluating and negotiating internship and full-time offers.',
          url:         'https://www.levels.fyi/',
          tag:         'Salaries',
        },
        {
          id:          'blind',
          title:       'Blind — Anonymous Tech Community',
          description: 'Anonymous professional network for verified tech workers to discuss company culture, interview experiences, and compensation. A candid source for insider perspective on employers.',
          url:         'https://www.teamblind.com/',
          tag:         'Community',
        },
        {
          id:          'wellfound',
          title:       'Wellfound (AngelList) — Startup Jobs',
          description: 'The primary job board for startup internships and early-career roles with transparent equity and salary ranges listed upfront. Directly connects candidates with founders at YC-backed companies.',
          url:         'https://wellfound.com/',
          tag:         'Startups',
        },
        {
          id:          'glassdoor-cs',
          title:       'Glassdoor — Company Reviews & Salaries',
          description: 'Employee reviews, interview question reports, and verified salary data for thousands of tech employers. Helpful for researching company culture and preparing for specific interview formats.',
          url:         'https://www.glassdoor.com/',
          tag:         'Reviews',
        },
        {
          id:          'linkedin-jobs',
          title:       'LinkedIn Jobs — Professional Network',
          description: 'The largest professional job board with powerful filtering by role, location, and company size. Recruiters actively source CS interns directly through LinkedIn profiles.',
          url:         'https://www.linkedin.com/jobs/',
          tag:         'Jobs',
        },
      ],
    },

    /* ── 5. Research & Papers ───────────────────────────────── */
    {
      id:    'research-papers',
      label: 'Research & Papers',
      links: [
        {
          id:          'arxiv-cs',
          title:       'arXiv — CS Preprints',
          description: 'Open-access preprint server for cutting-edge computer science research covering AI, systems, theory, programming languages, and cryptography. Most major ML papers appear here before journal publication.',
          url:         'https://arxiv.org/list/cs/recent',
          tag:         'Preprints',
        },
        {
          id:          'acm-dl',
          title:       'ACM Digital Library',
          description: 'The Association for Computing Machinery\'s full-text archive of journals, conference proceedings, and magazines spanning all areas of CS. Free access available through most university libraries.',
          url:         'https://dl.acm.org/',
          tag:         'Journals',
        },
        {
          id:          'ieee-cs',
          title:       'IEEE Xplore — CS & EE Research',
          description: 'Comprehensive peer-reviewed database for computer science and electrical engineering publications from IEEE and partner societies. Covers networking, security, computer architecture, and software engineering.',
          url:         'https://ieeexplore.ieee.org/',
          tag:         'IEEE',
        },
        {
          id:          'google-scholar',
          title:       'Google Scholar — Academic Search',
          description: 'Broad academic search engine indexing journal articles, conference papers, theses, and patents across all CS subfields. Shows citation counts and links to free PDF versions where available.',
          url:         'https://scholar.google.com/',
          tag:         'Search',
        },
      ],
    },

  ],
}
