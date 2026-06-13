import type { UniversityConfig } from './index'

export const TEXAS_AM: UniversityConfig = {
  id:           'texas-am',
  name:         'Texas A&M University',
  shortName:    'Texas A&M',
  location:     'College Station, TX',
  gpaScale:     '4.0',
  currencyName: 'Dining Dollars',

  categories: [

    // ── ACADEMICS & REGISTRATION ─────────────────────────────
    {
      id:    'academics',
      label: 'Academics & Registration',
      tab:   'academics',
      links: [
        {
          id:          'tamu-howdy',
          title:       'Howdy Portal',
          tag:         'Portal',
          description: 'Central student portal for registration, grades, financial aid, and degree planning. Primary hub for all academic administration.',
          url:         'https://howdy.tamu.edu',
        },
        {
          id:          'tamu-canvas',
          title:       'Canvas LMS',
          tag:         'LMS',
          description: 'Course materials, assignments, announcements, and grades for all enrolled classes.',
          url:         'https://canvas.tamu.edu',
        },
        {
          id:          'tamu-degreeplanner',
          title:       'Degree Planner',
          tag:         'Planning',
          description: 'Map your four-year plan, track degree requirements, and check missing credits before registration.',
          url:         'https://degreeplanner.tamu.edu',
        },
        {
          id:          'tamu-library',
          title:       'Evans Library',
          tag:         'Library',
          description: 'Full Texas A&M digital library, journal databases, research guides, and interlibrary loan services.',
          url:         'https://library.tamu.edu',
        },
        {
          id:          'tamu-schedule',
          title:       'Course Schedule Search',
          tag:         'Courses',
          description: 'Browse available course sections by term, department, instructor, and meeting time for upcoming registration.',
          url:         'https://compass-ssb.tamu.edu/pls/PROD/bwckschd.p_disp_dyn_sched',
        },
        {
          id:          'tamu-registrar',
          title:       'Registrar',
          tag:         'Admin',
          description: 'Official transcripts, enrollment verification, add/drop deadline management, and academic record corrections.',
          url:         'https://registrar.tamu.edu',
        },
        {
          id:          'tamu-academic-calendar',
          title:       'Academic Calendar',
          tag:         'Calendar',
          description: 'Semester key dates: first day of class, add/drop deadlines, finals schedule, and university holidays.',
          url:         'https://registrar.tamu.edu/Catalogs,-Policies-Procedures/Academic-Calendar',
        },
        {
          id:          'tamu-gradescope',
          title:       'Gradescope',
          tag:         'Grading',
          description: 'Submit assignments and exams, receive annotated feedback, and view rubric-based grades across all enrolled TAMU courses that adopt the platform.',
          url:         'https://www.gradescope.com',
        },
        {
          id:          'tamu-piazza',
          title:       'Piazza — Class Q&A',
          tag:         'Q&A',
          description: 'Asynchronous class discussion platform used in CSCE, MATH, and ENGR departments. Ask questions anonymously, search prior answers, and get TA-verified responses.',
          url:         'https://piazza.com',
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
          id:          'tamu-aggieland',
          title:       'Aggieland Jobs',
          tag:         'Jobs',
          description: 'Official job and internship board — browse Aggie-exclusive postings and sign up for on-campus interviews.',
          url:         'https://aggielandjobs.tamu.edu',
        },
        {
          id:          'tamu-career-center',
          title:       'Career Center',
          tag:         'Career',
          description: 'Resume reviews, mock interviews, and career counseling with Aggie career advisors.',
          url:         'https://careercenter.tamu.edu',
        },
        {
          id:          'tamu-linkedin',
          title:       'Aggie Network (LinkedIn)',
          tag:         'Network',
          description: 'Connect with the vast Texas A&M alumni network. Leverage the Aggie Ring and Corps connections for networking.',
          url:         'https://www.linkedin.com/school/texas-a&m-university/',
        },
        {
          id:          'tamu-veteran-resources',
          title:       'Veteran Resource & Support Center',
          tag:         'Veterans',
          description: 'Career services, GI Bill advising, and transition resources for Aggie student veterans and military-connected students.',
          url:         'https://veteran.tamu.edu',
        },
        {
          id:          'tamu-mays',
          title:       'Mays Business Recruiting',
          tag:         'Business',
          description: 'Mays Business School career resources, corporate partner events, and placement statistics for business undergrads.',
          url:         'https://mays.tamu.edu/career-management',
        },
        {
          id:          'tamu-handshake',
          title:       'Handshake at A&M',
          tag:         'Jobs',
          description: 'National internship and job board with Aggie-exclusive postings. Schedule on-campus interviews, explore employer profiles, and RSVP for career events.',
          url:         'https://tamu.joinhandshake.com',
        },
        {
          id:          'tamu-glassdoor',
          title:       'Glassdoor',
          tag:         'Research',
          description: 'Research employer culture, interview questions, and salary ranges before applying. Especially useful for comparing O&G, agriculture tech, and aerospace companies that recruit at A&M.',
          url:         'https://www.glassdoor.com',
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
          id:          'tamu-student-affairs',
          title:       'Student Affairs',
          tag:         'Life',
          description: 'Student organizations, wellness resources, Corps of Cadets information, and Spirit programs including the Aggie Band.',
          url:         'https://studentaffairs.tamu.edu',
        },
        {
          id:          'tamu-dining',
          title:       'Dining Services',
          tag:         'Dining',
          description: 'Dining hall menus, hours, meal plan balances, and all food venues across the College Station campus.',
          url:         'https://dining.tamu.edu',
        },
        {
          id:          'tamu-rec',
          title:       'Student Recreation Center',
          tag:         'Wellness',
          description: 'Fitness equipment reservations, group fitness classes, and intramural sports registration at TAMU\'s recreation center.',
          url:         'https://recsports.tamu.edu',
        },
        {
          id:          'tamu-transportation',
          title:       'Transportation Services',
          tag:         'Transit',
          description: 'Aggie Spirit bus routes, parking permits, and on-demand Aggie Safe Ride shuttle service.',
          url:         'https://transportation.tamu.edu',
        },
        {
          id:          'tamu-student-orgs',
          title:       'Student Organizations',
          tag:         'Orgs',
          description: 'Browse 1 000+ registered Aggie student organizations — academic, social, cultural, faith-based, and service clubs.',
          url:         'https://stuorg.tamu.edu',
        },
        {
          id:          'tamu-athletics',
          title:       'Aggie Athletics',
          tag:         'Athletics',
          description: '12th Man spirit hub — purchase student football tickets, view basketball and baseball schedules, and access Kyle Field gameday information.',
          url:         'https://www.aggieeathletics.com',
        },
        {
          id:          'tamu-bonfire',
          title:       'Aggie Traditions',
          tag:         'Traditions',
          description: 'Muster, Silver Taps, Elephant Walk, and Midnight Yell — learn about the unique Aggie traditions that define campus culture and the Aggie Spirit.',
          url:         'https://traditions.tamu.edu',
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
          id:          'tamu-health',
          title:       'Student Health Services',
          tag:         'Health',
          description: 'Schedule appointments at the Beutel Health Center, view immunization records, access counseling and mental health services.',
          url:         'https://shs.tamu.edu',
        },
        {
          id:          'tamu-it',
          title:       'IT Help Desk',
          tag:         'IT',
          description: 'Submit IT support tickets, manage NetID, access the campus VPN, and download licensed Microsoft and Adobe software.',
          url:         'https://it.tamu.edu',
        },
        {
          id:          'tamu-financial-aid',
          title:       'Financial Aid',
          tag:         'Finance',
          description: 'View scholarship and grant awards, manage FAFSA, and set up direct deposit for financial aid refunds.',
          url:         'https://financialaid.tamu.edu',
        },
        {
          id:          'tamu-housing',
          title:       'On-Campus Housing',
          tag:         'Housing',
          description: 'Apply for residence halls, manage room assignments, and submit maintenance requests through Residence Life.',
          url:         'https://reslife.tamu.edu',
        },
        {
          id:          'tamu-emergency',
          title:       'Emergency Preparedness',
          tag:         'Safety',
          description: 'Campus emergency alerts, safety resources, and the Aggie Safe escort service for late-night travel on campus.',
          url:         'https://emergency.tamu.edu',
        },
        {
          id:          'tamu-parking',
          title:       'Parking Services',
          tag:         'Parking',
          description: 'Purchase and manage parking permits, view campus garage availability, report a citation, and learn about Aggie Spirit Bus routes for permit-free campus travel.',
          url:         'https://parking.tamu.edu',
        },
        {
          id:          'tamu-bookstore',
          title:       'Barnes & Noble at TAMU',
          tag:         'Textbooks',
          description: 'Official TAMU bookstore for course material pickup and rentals, Aggie merchandise, and technology purchases with education discounts.',
          url:         'https://www.bkstr.com/texasamstore',
        },
      ],
    },

  ],
}
