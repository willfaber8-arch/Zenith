import type { UniversityConfig } from './index'

export const MICHIGAN_STATE: UniversityConfig = {
  id:           'michigan-state',
  name:         'Michigan State University',
  shortName:    'MSU',
  location:     'East Lansing, MI',
  gpaScale:     '4.0',
  currencyName: 'Spartan Cash',

  categories: [

    // ── ACADEMICS & REGISTRATION ─────────────────────────────
    {
      id:    'academics',
      label: 'Academics & Registration',
      tab:   'academics',
      links: [
        {
          id:          'msu-eas',
          title:       'EAS Student Portal',
          tag:         'Portal',
          description: 'Central student portal for registration, grades, financial aid, and academic records at Michigan State University. Primary hub for all enrollment administration.',
          url:         'https://eas.msu.edu',
        },
        {
          id:          'msu-d2l',
          title:       'D2L Brightspace',
          tag:         'LMS',
          description: 'Access course materials, assignments, quizzes, discussion boards, and grades for all enrolled MSU classes through the university\'s official learning management system.',
          url:         'https://d2l.msu.edu',
        },
        {
          id:          'msu-registrar',
          title:       'Office of the Registrar',
          tag:         'Admin',
          description: 'Official transcripts, enrollment verification, add/drop deadline management, grade appeals, and academic record corrections for Michigan State students.',
          url:         'https://reg.msu.edu',
        },
        {
          id:          'msu-library',
          title:       'MSU Libraries',
          tag:         'Library',
          description: 'Full digital library access including journal databases, research guides, Special Collections, and interlibrary loan services through the Michigan State University Libraries.',
          url:         'https://lib.msu.edu',
        },
        {
          id:          'msu-degree-navigator',
          title:       'Degree Navigator',
          tag:         'Planning',
          description: 'Track your degree requirements, audit completed coursework, and plan upcoming semesters toward graduation using MSU\'s official degree audit tool.',
          url:         'https://degreenavigator.msu.edu',
        },
        {
          id:          'msu-calendar',
          title:       'Academic Calendar',
          tag:         'Calendar',
          description: 'Official MSU semester dates covering first/last day of class, add/drop deadlines, final examination schedules, and university holidays for all terms.',
          url:         'https://reg.msu.edu/calendars',
        },
      ],
    },

    // ── CAREER DEVELOPMENT ──────────────────────────────────
    {
      id:    'career',
      label: 'Career Development',
      tab:   'career',
      links: [
        {
          id:          'msu-career-network',
          title:       'Career Services Network',
          tag:         'Career',
          description: 'Resume reviews, mock interviews, career coaching, and employer connections through MSU\'s award-winning Career Services Network across all colleges.',
          url:         'https://careernetwork.msu.edu',
        },
        {
          id:          'msu-handshake',
          title:       'Handshake at MSU',
          tag:         'Jobs',
          description: 'National internship and full-time job board with Spartan-exclusive postings. Schedule on-campus interviews, explore employer profiles, and RSVP for career events.',
          url:         'https://msu.joinhandshake.com',
        },
        {
          id:          'msu-linkedin-learning',
          title:       'LinkedIn Learning',
          tag:         'Learning',
          description: 'Free access to thousands of professional development courses in technology, business, and creative fields using your MSU NetID credentials.',
          url:         'https://linkedin.com/learning',
        },
        {
          id:          'msu-spartan-jobs',
          title:       'Spartan Jobs',
          tag:         'Jobs',
          description: 'MSU\'s official on-campus student employment board listing research assistantships, department positions, and student work opportunities across East Lansing.',
          url:         'https://spartanjobs.msu.edu',
        },
        {
          id:          'msu-career-fairs',
          title:       'Career Fair Schedule',
          tag:         'Events',
          description: 'Browse upcoming MSU career fairs, networking events, employer information sessions, and recruiting timelines organized by the Career Services Network.',
          url:         'https://careernetwork.msu.edu/events',
        },
      ],
    },

    // ── CAMPUS LIFE ─────────────────────────────────────────
    {
      id:    'campus',
      label: 'Campus Life',
      tab:   'campus',
      links: [
        {
          id:          'msu-imsports',
          title:       'IM Sports & Recreation',
          tag:         'Wellness',
          description: 'Fitness equipment reservations, group fitness classes, intramural sport leagues, and outdoor adventure programs at MSU\'s Intramural Sports & Recreation facilities.',
          url:         'https://imsports.msu.edu',
        },
        {
          id:          'msu-union',
          title:       'MSU Union',
          tag:         'Union',
          description: 'Home of student services, dining, event spaces, bowling, the MSU Bookstore, and student organization offices at the heart of Michigan State\'s campus.',
          url:         'https://union.msu.edu',
        },
        {
          id:          'msu-dining',
          title:       'EatAtState Dining',
          tag:         'Dining',
          description: 'Dining hall menus, operating hours, meal plan and Spartan Cash balances, and all food venues across Michigan State\'s 20+ on-campus dining locations.',
          url:         'https://eatatstate.msu.edu',
        },
        {
          id:          'msu-student-life',
          title:       'Student Life',
          tag:         'Life',
          description: 'Leadership development, community engagement, student organization support, and campus programming resources through MSU\'s Division of Student Life.',
          url:         'https://studentlife.msu.edu',
        },
        {
          id:          'msu-events',
          title:       'MSU Events',
          tag:         'Events',
          description: 'Official calendar of Michigan State events including lectures, performances, Spartan athletic games, and student organization programming across campus.',
          url:         'https://events.msu.edu',
        },
      ],
    },

    // ── ESSENTIALS ──────────────────────────────────────────
    {
      id:    'essentials',
      label: 'Essentials',
      tab:   'essentials',
      links: [
        {
          id:          'msu-olin',
          title:       'Olin Health Center',
          tag:         'Health',
          description: 'Schedule medical appointments, access counseling and psychiatric services, view immunization records, and manage prescriptions at MSU\'s primary student health center.',
          url:         'https://olin.msu.edu',
        },
        {
          id:          'msu-it',
          title:       'IT Help Desk',
          tag:         'IT',
          description: 'Submit IT support requests, manage your MSU NetID, access campus VPN, and download licensed Microsoft 365 and other software through MSU IT Services.',
          url:         'https://it.msu.edu',
        },
        {
          id:          'msu-housing',
          title:       'University Housing',
          tag:         'Housing',
          description: 'Apply for on-campus residence halls, manage room assignments, submit maintenance requests, and explore MSU\'s extensive on-campus housing options.',
          url:         'https://housing.msu.edu',
        },
        {
          id:          'msu-financial-aid',
          title:       'Office of Financial Aid',
          tag:         'Finance',
          description: 'View scholarship and grant awards, manage your FAFSA, review aid packages, and set up direct deposit for financial aid disbursements at Michigan State.',
          url:         'https://finaid.msu.edu',
        },
        {
          id:          'msu-parking',
          title:       'Parking Services',
          tag:         'Parking',
          description: 'Purchase and manage parking permits, view campus lot availability, pay citations, and access CATA and SMART bus routes serving East Lansing and MSU.',
          url:         'https://parking.msu.edu',
        },
      ],
    },

  ],
}
