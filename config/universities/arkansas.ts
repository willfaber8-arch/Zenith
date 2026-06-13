import type { UniversityConfig } from './index'

export const ARKANSAS: UniversityConfig = {
  id:           'arkansas',
  name:         'University of Arkansas',
  shortName:    'U of A',
  location:     'Fayetteville, AR',
  gpaScale:     '4.0',
  currencyName: 'Razorbuck$',

  categories: [

    // ── ACADEMICS & REGISTRATION ─────────────────────────────
    {
      id:    'academics',
      label: 'Academics & Registration',
      tab:   'academics',
      links: [
        {
          id:          'uark-myark',
          title:       'myARK Student Portal',
          tag:         'Portal',
          description: 'Central student portal for registration, grades, financial aid, and degree planning at the University of Arkansas. Primary hub for all academic administration tasks.',
          url:         'https://myark.uark.edu',
        },
        {
          id:          'uark-canvas',
          title:       'Canvas LMS',
          tag:         'LMS',
          description: 'Access course materials, assignments, announcements, and grades for all enrolled classes through the U of A\'s official learning management system.',
          url:         'https://canvas.uark.edu',
        },
        {
          id:          'uark-registrar',
          title:       'Office of the Registrar',
          tag:         'Admin',
          description: 'Official transcripts, enrollment verification, add/drop deadline management, and academic record corrections for University of Arkansas students.',
          url:         'https://registrar.uark.edu',
        },
        {
          id:          'uark-library',
          title:       'University Libraries',
          tag:         'Library',
          description: 'Full access to the U of A digital library, journal databases, research guides, and interlibrary loan services via the Mullins Library system.',
          url:         'https://library.uark.edu',
        },
        {
          id:          'uark-degreeworks',
          title:       'DegreeWorks',
          tag:         'Planning',
          description: 'Map your degree progress, track remaining requirements, and plan upcoming semesters with your academic advisor using the official audit tool.',
          url:         'https://degreeworks.uark.edu',
        },
        {
          id:          'uark-calendar',
          title:       'Academic Calendar',
          tag:         'Calendar',
          description: 'Official U of A semester dates including first/last day of class, add/drop deadlines, final exam schedule, and university holidays.',
          url:         'https://registrar.uark.edu/calendar/index.php',
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
          id:          'uark-career',
          title:       'Career Development Center',
          tag:         'Career',
          description: 'Resume reviews, mock interviews, and career counseling sessions with professional U of A career advisors. Connects Razorbacks with employers across Arkansas and beyond.',
          url:         'https://career.uark.edu',
        },
        {
          id:          'uark-handshake',
          title:       'Handshake',
          tag:         'Jobs',
          description: 'National internship and full-time job platform with U of A-exclusive postings. Schedule on-campus interviews, explore employer profiles, and RSVP for career fairs.',
          url:         'https://uark.joinhandshake.com',
        },
        {
          id:          'uark-linkedin-learning',
          title:       'LinkedIn Learning',
          tag:         'Learning',
          description: 'Free access to thousands of professional development courses in technology, business, and creative fields using your U of A student credentials.',
          url:         'https://linkedin.com/learning',
        },
        {
          id:          'uark-internships',
          title:       'Internship & Job Board',
          tag:         'Internships',
          description: 'Browse curated internship and co-op opportunities sourced by the U of A Career Development Center across business, engineering, agriculture, and liberal arts.',
          url:         'https://career.uark.edu/students/find-internships-jobs/',
        },
        {
          id:          'uark-biginterview',
          title:       'Big Interview',
          tag:         'Interview Prep',
          description: 'AI-powered mock interview platform available free to U of A students. Practice industry-specific questions and receive instant feedback to sharpen your interview skills.',
          url:         'https://uark.biginterview.com',
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
          id:          'uark-campusrec',
          title:       'Campus Recreation',
          tag:         'Wellness',
          description: 'Fitness equipment reservations, group fitness classes, intramural sports, and outdoor recreation programs at the U of A\'s state-of-the-art recreation facilities.',
          url:         'https://campusrec.uark.edu',
        },
        {
          id:          'uark-union',
          title:       'Arkansas Union',
          tag:         'Union',
          description: 'Home of student services, dining, event spaces, meeting rooms, and student organization offices at the center of the Fayetteville campus.',
          url:         'https://union.uark.edu',
        },
        {
          id:          'uark-dining',
          title:       'Dining Services',
          tag:         'Dining',
          description: 'Dining hall menus, hours, meal plan balances, Razorbuck$ management, and all food venues across the University of Arkansas campus.',
          url:         'https://dining.uark.edu',
        },
        {
          id:          'uark-events',
          title:       'U of A Events',
          tag:         'Events',
          description: 'Official calendar of campus events including lectures, performances, sporting events, and student organization programming at the University of Arkansas.',
          url:         'https://uark.edu/events',
        },
        {
          id:          'uark-orgs',
          title:       'Student Organizations',
          tag:         'Orgs',
          description: 'Browse hundreds of registered Razorback student organizations — academic, social, cultural, faith-based, and service clubs to get involved on campus.',
          url:         'https://arkansas.campuslabs.com/engage',
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
          id:          'uark-health',
          title:       'Pat Walker Health Center',
          tag:         'Health',
          description: 'Schedule appointments, access counseling and mental health services, view immunization records, and manage prescriptions through the U of A\'s student health center.',
          url:         'https://health.uark.edu',
        },
        {
          id:          'uark-it',
          title:       'IT Help Desk',
          tag:         'IT',
          description: 'Submit IT support tickets, manage your UARK account credentials, access campus VPN, and download licensed software through the University of Arkansas IT department.',
          url:         'https://help.uark.edu',
        },
        {
          id:          'uark-housing',
          title:       'University Housing',
          tag:         'Housing',
          description: 'Apply for residence halls, manage room assignments, submit maintenance requests, and explore on-campus housing options through University of Arkansas Housing.',
          url:         'https://housing.uark.edu',
        },
        {
          id:          'uark-financial-aid',
          title:       'Financial Aid',
          tag:         'Finance',
          description: 'View scholarship and grant awards, manage your FAFSA, check award status, and set up direct deposit for financial aid refunds at the U of A.',
          url:         'https://financialaid.uark.edu',
        },
        {
          id:          'uark-parking',
          title:       'Parking & Transit',
          tag:         'Parking',
          description: 'Purchase and manage parking permits, view campus parking availability, pay citations, and access Razorback Transit bus schedules for permit-free campus travel.',
          url:         'https://parking.uark.edu',
        },
      ],
    },

  ],
}
