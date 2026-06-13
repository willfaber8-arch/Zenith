import type { UniversityConfig } from './index'

export const UCLA: UniversityConfig = {
  id:           'ucla',
  name:         'University of California, Los Angeles',
  shortName:    'UCLA',
  location:     'Los Angeles, CA',
  gpaScale:     '4.0',
  currencyName: 'BruinCard Dollars',

  categories: [

    // ── ACADEMICS & REGISTRATION ─────────────────────────────
    {
      id:    'academics',
      label: 'Academics & Registration',
      tab:   'academics',
      links: [
        {
          id:          'ucla-myucla',
          title:       'myUCLA Portal',
          tag:         'Portal',
          description: 'Central student portal for registration, grades, financial aid, and degree planning at UCLA. Primary hub for all academic administration and enrollment services.',
          url:         'https://my.ucla.edu',
        },
        {
          id:          'ucla-canvas',
          title:       'Canvas LMS',
          tag:         'LMS',
          description: 'Access course materials, assignments, quizzes, discussion boards, and grades for all enrolled UCLA classes through the university\'s official learning management system.',
          url:         'https://canvas.ucla.edu',
        },
        {
          id:          'ucla-registrar',
          title:       'Office of the Registrar',
          tag:         'Admin',
          description: 'Official transcripts, enrollment verification, add/drop and late enrollment management, grade appeals, and academic record corrections for UCLA students.',
          url:         'https://registrar.ucla.edu',
        },
        {
          id:          'ucla-library',
          title:       'UCLA Library',
          tag:         'Library',
          description: 'Full access to UCLA\'s world-class digital library, journal databases, research guides, special collections, and interlibrary loan services across all subject libraries.',
          url:         'https://library.ucla.edu',
        },
        {
          id:          'ucla-degree-audit',
          title:       'Degree Audit (myUCLA)',
          tag:         'Planning',
          description: 'Review completed and remaining degree requirements, track progress toward your major and general education goals using UCLA\'s integrated degree audit tool in myUCLA.',
          url:         'https://my.ucla.edu',
        },
        {
          id:          'ucla-calendar',
          title:       'Academic Calendar',
          tag:         'Calendar',
          description: 'Official UCLA quarter dates covering first/last day of class, enrollment deadlines, final examination schedules, and university holidays for all academic terms.',
          url:         'https://registrar.ucla.edu/calendars/annual-academic-calendar',
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
          id:          'ucla-career-center',
          title:       'UCLA Career Center',
          tag:         'Career',
          description: 'Resume reviews, mock interviews, career advising, and employer connections through UCLA\'s Career Center. Leverages the Los Angeles economy and Bruin alumni network for student placements.',
          url:         'https://career.ucla.edu',
        },
        {
          id:          'ucla-handshake',
          title:       'Handshake at UCLA',
          tag:         'Jobs',
          description: 'National internship and full-time job board with Bruin-exclusive postings. Schedule on-campus interviews, explore LA employer profiles, and RSVP for career events.',
          url:         'https://ucla.joinhandshake.com',
        },
        {
          id:          'ucla-linkedin-learning',
          title:       'LinkedIn Learning',
          tag:         'Learning',
          description: 'Free access to thousands of professional development courses in technology, business, and creative fields using your UCLA Bruin credentials.',
          url:         'https://linkedin.com/learning',
        },
        {
          id:          'ucla-bruinview',
          title:       'BruinView Job Board',
          tag:         'Jobs',
          description: 'UCLA\'s exclusive student employment portal listing on-campus jobs, internships, and full-time positions sourced specifically for Bruin students across all majors.',
          url:         'https://bruinview.ucla.edu',
        },
        {
          id:          'ucla-job-shadow',
          title:       'Bruin Professionals Job Shadow',
          tag:         'Network',
          description: 'Shadow UCLA alumni working in your field of interest through the Career Center\'s job shadow program connecting students with professionals across Los Angeles industries.',
          url:         'https://career.ucla.edu/programs/job-shadow',
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
          id:          'ucla-recreation',
          title:       'UCLA Recreation',
          tag:         'Wellness',
          description: 'Fitness center access, aquatics, group exercise classes, intramural sports, club sports, and outdoor adventures through UCLA\'s award-winning recreation programs.',
          url:         'https://recreation.ucla.edu',
        },
        {
          id:          'ucla-ackerman',
          title:       'Ackerman Union & ASUCLA',
          tag:         'Union',
          description: 'Student union services including the UCLA Store, food vendors, event spaces, and Associated Students UCLA services at the center of Westwood campus life.',
          url:         'https://www.asucla.ucla.edu',
        },
        {
          id:          'ucla-dining',
          title:       'UCLA Dining',
          tag:         'Dining',
          description: 'Residential restaurant menus, operating hours, meal plan and BruinCard Dollar balances, and all dining venues across UCLA\'s award-winning campus dining program.',
          url:         'https://dining.ucla.edu',
        },
        {
          id:          'ucla-events',
          title:       'UCLA Events Calendar',
          tag:         'Events',
          description: 'Official calendar of UCLA events including lectures, cultural performances, Bruin athletics games, and student organization programming across the Westwood campus.',
          url:         'https://events.ucla.edu',
        },
        {
          id:          'ucla-student-orgs',
          title:       'Bruin Student Organizations',
          tag:         'Orgs',
          description: 'Browse 1000+ registered UCLA student organizations — academic, social, cultural, pre-professional, and service clubs available through the Bruin Community platform.',
          url:         'https://community.ucla.edu',
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
          id:          'ucla-student-health',
          title:       'Arthur Ashe Student Health & Wellness',
          tag:         'Health',
          description: 'Schedule medical, counseling, and psychiatry appointments, view immunization records, and access mental health resources at UCLA\'s flagship student health center.',
          url:         'https://studenthealth.ucla.edu',
        },
        {
          id:          'ucla-it',
          title:       'UCLA IT Services',
          tag:         'IT',
          description: 'Submit IT support requests, manage your UCLA Bruin Online ID, access campus VPN, and download licensed Microsoft 365 and software through UCLA IT Services.',
          url:         'https://it.ucla.edu',
        },
        {
          id:          'ucla-housing',
          title:       'UCLA Housing',
          tag:         'Housing',
          description: 'Apply for on-campus residence halls and apartments, manage room assignments, submit maintenance requests, and explore UCLA\'s extensive on-campus housing options.',
          url:         'https://housing.ucla.edu',
        },
        {
          id:          'ucla-financial-aid',
          title:       'Financial Aid & Scholarships',
          tag:         'Finance',
          description: 'View Regents Scholarship and grant awards, manage your FAFSA, review Cal Grant eligibility, and set up direct deposit for financial aid disbursements at UCLA.',
          url:         'https://financialaid.ucla.edu',
        },
        {
          id:          'ucla-transportation',
          title:       'Bruin Parking & Transportation',
          tag:         'Parking',
          description: 'Purchase and manage parking permits, view campus structure availability, access Big Blue Bus and Metro connections, and learn about Bruin Bike Share options.',
          url:         'https://transportation.ucla.edu',
        },
      ],
    },

  ],
}
