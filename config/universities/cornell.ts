/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Cornell University Resource Configuration
 * Phase 2 · Step 2.3 — Polymorphic University Search & Content Node
 *
 * Loaded on-demand via dynamic import in config/universities/index.ts.
 * This file is NOT included in the main JS bundle — it is fetched
 * only when a user with universityName = "Cornell University" opens
 * the University Hub view.
 *
 * Data coverage:
 *   14 resource links across three functional categories:
 *     · Academics & Registration  (6 links)
 *     · Career Development        (3 links)
 *     · Campus Life & Essentials  (5 links)
 *
 * Link verification note:
 *   All URLs reference publicly documented Cornell web services.
 *   Portal access requires a valid Cornell NetID — links open in
 *   a new tab with rel="noopener noreferrer" for security isolation.
 * ════════════════════════════════════════════════════════════════
 */

import type { UniversityConfig } from './index'

export const CORNELL: UniversityConfig = {
  id:        'cornell',
  name:      'Cornell University',
  shortName: 'Cornell',
  location:  'Ithaca, NY',

  categories: [

    /* ══════════════════════════════════════════════════════════
       CATEGORY 1 — ACADEMICS & REGISTRATION
       Covers: enrollment management, academic record, LMS,
       degree progress, advising pipelines, and key dates.
       ══════════════════════════════════════════════════════════ */
    {
      id:    'academics',
      label: 'Academics & Registration',
      links: [

        {
          id:    'student-center',
          title: 'Student Center',
          tag:   'Portal',
          description:
            'Central hub for enrollment, bursar account management, real-time grade tracking, financial aid, and official degree progress — the single authoritative record of your academic standing at Cornell.',
          url: 'https://studentcenter.cornell.edu',
        },

        {
          id:    'canvas',
          title: 'Canvas LMS',
          tag:   'LMS',
          description:
            'Access all enrolled course pages, assignment submissions, grading rubrics, professor announcements, and semester syllabi in one centralised learning management workspace.',
          url: 'https://canvas.cornell.edu',
        },

        {
          id:    'registrar',
          title: 'Office of the Registrar',
          tag:   'Admin',
          description:
            'Manage course add/drop requests before deadline windows, order official transcripts, download enrollment verification letters, and file academic forms such as late withdrawals.',
          url: 'https://registrar.cornell.edu',
        },

        {
          id:    'dars',
          title: 'Degree Audit (DARS)',
          tag:   'Audit',
          description:
            'Real-time audit of progress toward graduation requirements — tracks major, minor, and distribution credits completed, remaining, and in-progress across every enrolled semester.',
          url: 'https://da.cornell.edu',
        },

        {
          id:    'chatter',
          title: 'Cornell Chatter',
          tag:   'Advising',
          description:
            'Book academic advising appointments with your college counselor, request peer tutoring through the Learning Strategies Center, and manage any active advising cases or academic holds.',
          url: 'https://chatter.cornell.edu',
        },

        {
          id:    'academic-calendar',
          title: 'Academic Calendar',
          tag:   'Calendar',
          description:
            'Official semester timeline: first day of classes, add/drop deadlines, mid-term and final exam schedules, university holidays, and tuition payment due dates by academic year.',
          url: 'https://registrar.cornell.edu/academic-calendar',
        },

      ],
    },

    /* ══════════════════════════════════════════════════════════
       CATEGORY 2 — CAREER DEVELOPMENT
       Covers: on-campus and off-campus employment searches,
       engineering recruiting cycles, co-op pathways, and
       professional development resources.
       ══════════════════════════════════════════════════════════ */
    {
      id:    'career',
      label: 'Career Development',
      links: [

        {
          id:    'handshake',
          title: 'Cornell Handshake',
          tag:   'Jobs',
          description:
            'Primary recruiting platform for on-campus employment, paid internships, corporate engineering career fairs, co-op program listings, and full-time new-grad positions across every industry vertical.',
          url: 'https://cornell.joinhandshake.com',
        },

        {
          id:    'career-services',
          title: 'Cornell Career Services',
          tag:   'Services',
          description:
            'Schedule resume review appointments, book mock technical or behavioural interview sessions, browse employer information events, and access the alumni career directory network.',
          url: 'https://careers.cornell.edu',
        },

        {
          id:    'cornell-tech',
          title: 'Cornell Tech Hub',
          tag:   'Innovation',
          description:
            'Graduate technology programs, startup studio resources, and innovation ecosystem listings from the NYC Roosevelt Island campus — relevant for graduate pathways and entrepreneurship tracks.',
          url: 'https://tech.cornell.edu',
        },

      ],
    },

    /* ══════════════════════════════════════════════════════════
       CATEGORY 3 — CAMPUS LIFE & ESSENTIALS
       Covers: university directories, daily dining services,
       Big Red Bucks balance management, student health,
       and recreational facilities.
       ══════════════════════════════════════════════════════════ */
    {
      id:    'campus',
      label: 'Campus Life & Essentials',
      links: [

        {
          id:    'cuinfo',
          title: 'CUinfo Portal',
          tag:   'Directory',
          description:
            'University-wide reference directory covering campus phone listings, building locations, department contacts, emergency information, and Cornell administrative resource navigation.',
          url: 'https://cuinfo.cornell.edu',
        },

        {
          id:    'dining',
          title: 'Cornell Dining',
          tag:   'Dining',
          description:
            'Browse daily menus across all residential dining halls, view central café hours, check food allergen labels, and plan meals around nutritional targets with seasonal menu schedules.',
          url: 'https://dining.cornell.edu',
        },

        {
          id:    'hfs',
          title: 'Big Red Bucks (BRB)',
          tag:   'Account',
          description:
            'Manage your dining dollar account — add funds to your BRB balance, review transaction history, set up auto-reload thresholds, and monitor remaining meal plan allocations per semester.',
          url: 'https://hfs.cornell.edu',
        },

        {
          id:    'health',
          title: 'Cornell Health',
          tag:   'Health',
          description:
            'Book primary care, mental health counselling, and specialist appointments; view immunisation records and lab results; manage Cornell student health insurance enrollment and claims.',
          url: 'https://health.cornell.edu',
        },

        {
          id:    'recreation',
          title: 'Cornell RecWell',
          tag:   'Fitness',
          description:
            'Register for intramural sports leagues, browse group fitness class schedules, check fitness centre open-swim hours, and explore club sport rosters and outdoor recreation programmes.',
          url: 'https://recreation.cornell.edu',
        },

      ],
    },

  ],
}
