import type { UniversityConfig } from './index'

export const UMICH: UniversityConfig = {
  id:           'umich',
  name:         'University of Michigan',
  shortName:    'U-Mich',
  location:     'Ann Arbor, MI',
  gpaScale:     '4.0',
  currencyName: 'MCard Dining Dollars',

  categories: [

    // ── ACADEMICS & REGISTRATION ─────────────────────────────
    {
      id:    'academics',
      label: 'Academics & Registration',
      tab:   'academics',
      links: [
        {
          id:          'umich-wolverine-access',
          title:       'Wolverine Access',
          tag:         'Portal',
          description: 'Central student portal for registration, grades, financial aid, and academic records at the University of Michigan. Primary hub for all enrollment and administration services.',
          url:         'https://wolverineaccess.umich.edu',
        },
        {
          id:          'umich-canvas',
          title:       'Canvas LMS',
          tag:         'LMS',
          description: 'Access course materials, assignments, quizzes, discussion boards, and grades for all enrolled U-M classes through the university\'s official learning management system.',
          url:         'https://canvas.umich.edu',
        },
        {
          id:          'umich-registrar',
          title:       'Office of the Registrar',
          tag:         'Admin',
          description: 'Official transcripts, enrollment verification, add/drop deadline management, grade change requests, and academic record corrections for University of Michigan students.',
          url:         'https://ro.umich.edu',
        },
        {
          id:          'umich-library',
          title:       'U-M Library',
          tag:         'Library',
          description: 'Full access to the University of Michigan\'s world-renowned digital library, HathiTrust Digital Library, journal databases, research guides, and interlibrary loan services.',
          url:         'https://lib.umich.edu',
        },
        {
          id:          'umich-atlas',
          title:       'Atlas Degree Audit',
          tag:         'Planning',
          description: 'Track your degree requirements, audit completed coursework, explore what-if scenarios for major changes, and verify graduation eligibility using U-M\'s Atlas platform.',
          url:         'https://atlas.ai.umich.edu',
        },
        {
          id:          'umich-calendar',
          title:       'Academic Calendar',
          tag:         'Calendar',
          description: 'Official U-M semester dates covering first/last day of class, add/drop deadlines, final examination schedules, and university holidays for all academic terms.',
          url:         'https://ro.umich.edu/calendars',
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
          id:          'umich-career-center',
          title:       'Career Center',
          tag:         'Career',
          description: 'Resume reviews, mock interviews, career coaching, and employer connections through U-M\'s Career Center. Taps into Michigan\'s powerful alumni network across every major industry.',
          url:         'https://careercenter.umich.edu',
        },
        {
          id:          'umich-handshake',
          title:       'Handshake at Michigan',
          tag:         'Jobs',
          description: 'National internship and full-time job board with Wolverine-exclusive postings. Schedule on-campus interviews, explore employer profiles, and RSVP for Michigan career events.',
          url:         'https://umich.joinhandshake.com',
        },
        {
          id:          'umich-linkedin-learning',
          title:       'LinkedIn Learning',
          tag:         'Learning',
          description: 'Free access to thousands of professional development courses in technology, business, and creative fields using your University of Michigan uniqname credentials.',
          url:         'https://linkedin.com/learning',
        },
        {
          id:          'umich-internship-fair',
          title:       'Michigan Internship & Career Fairs',
          tag:         'Events',
          description: 'Browse upcoming U-M career fairs, employer information sessions, and networking events organized by the Career Center and individual schools across Ann Arbor.',
          url:         'https://careercenter.umich.edu/events',
        },
        {
          id:          'umich-resumex',
          title:       'ResumeX Resume Resources',
          tag:         'Resume',
          description: 'Access U-M Career Center resume guides, critiques, sample documents, and professional writing resources to craft a standout application for Michigan graduates.',
          url:         'https://careercenter.umich.edu/resumes-cover-letters',
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
          id:          'umich-recsports',
          title:       'U-M Recreational Sports',
          tag:         'Wellness',
          description: 'Fitness center access, aquatics, group fitness classes, intramural sports leagues, club sports, and outdoor recreation at Michigan\'s premier recreational facilities.',
          url:         'https://recsports.umich.edu',
        },
        {
          id:          'umich-union',
          title:       'Michigan Union',
          tag:         'Union',
          description: 'Historic student union at the center of Ann Arbor campus life with dining, event spaces, student organization offices, and services since 1919.',
          url:         'https://michganunion.umich.edu',
        },
        {
          id:          'umich-dining',
          title:       'Michigan Dining',
          tag:         'Dining',
          description: 'Residential dining hall menus, operating hours, meal plan and MCard Dining Dollar balances, and all food venues across Michigan\'s extensive campus dining program.',
          url:         'https://dining.umich.edu',
        },
        {
          id:          'umich-sao',
          title:       'Student Activities',
          tag:         'Activities',
          description: 'Explore 1000+ registered student organizations, leadership programs, volunteer opportunities, and campus involvement resources through the Student Activities Office.',
          url:         'https://sao.umich.edu',
        },
        {
          id:          'umich-events',
          title:       'Michigan Events',
          tag:         'Events',
          description: 'Official calendar of University of Michigan events including lectures, arts performances, Big Ten athletics, and student organization programming across Ann Arbor.',
          url:         'https://events.umich.edu',
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
          id:          'umich-uhs',
          title:       'University Health Service',
          tag:         'Health',
          description: 'Schedule medical, counseling, and specialty appointments, view immunization records, access pharmacy services, and manage your health through U-M\'s student health system.',
          url:         'https://uhs.umich.edu',
        },
        {
          id:          'umich-its',
          title:       'ITS Help Desk',
          tag:         'IT',
          description: 'Submit IT support requests, manage your Michigan uniqname, access Umich VPN, and download licensed Microsoft 365 and software through U-M Information Technology Services.',
          url:         'https://its.umich.edu',
        },
        {
          id:          'umich-housing',
          title:       'University Housing',
          tag:         'Housing',
          description: 'Apply for residence halls and apartments, manage room assignments, submit maintenance requests, and explore U-M\'s extensive on-campus housing communities in Ann Arbor.',
          url:         'https://housing.umich.edu',
        },
        {
          id:          'umich-financial-aid',
          title:       'Office of Financial Aid',
          tag:         'Finance',
          description: 'View scholarship and grant awards, manage your FAFSA, review aid packages, and set up direct deposit for financial aid disbursements at the University of Michigan.',
          url:         'https://finaid.umich.edu',
        },
        {
          id:          'umich-parking',
          title:       'Parking & Transportation',
          tag:         'Parking',
          description: 'Purchase and manage parking permits, view campus structure availability, access Ann Arbor AAATA bus routes, and learn about Michigan Ride and Ride-Match programs.',
          url:         'https://ltp.umich.edu',
        },
      ],
    },

  ],
}
