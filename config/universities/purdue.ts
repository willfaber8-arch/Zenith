import type { UniversityConfig } from './index'

export const PURDUE: UniversityConfig = {
  id:           'purdue',
  name:         'Purdue University',
  shortName:    'Purdue',
  location:     'West Lafayette, IN',
  gpaScale:     '4.0',
  currencyName: 'Boilermaker Bucks',

  categories: [

    // ── ACADEMICS & REGISTRATION ─────────────────────────────
    {
      id:    'academics',
      label: 'Academics & Registration',
      tab:   'academics',
      links: [
        {
          id:          'purdue-mypurdue',
          title:       'myPurdue Portal',
          tag:         'Portal',
          description: 'Central student portal for registration, financial aid, grades, and degree planning at Purdue. All academic administration tasks flow through this single authenticated hub.',
          url:         'https://mypurdue.purdue.edu',
        },
        {
          id:          'purdue-brightspace',
          title:       'Brightspace LMS',
          tag:         'LMS',
          description: 'Access course content, submit assignments, take quizzes, and view instructor feedback for all enrolled Purdue classes. Brightspace replaced Blackboard as Purdue\'s official learning management system.',
          url:         'https://purdue.brightspace.com',
        },
        {
          id:          'purdue-registrar',
          title:       'Registrar',
          tag:         'Admin',
          description: 'Request official transcripts, manage enrollment verification letters, and review add/drop and withdrawal deadlines. The Registrar also handles academic standing appeals and graduation application processing.',
          url:         'https://registrar.purdue.edu',
        },
        {
          id:          'purdue-library',
          title:       'Purdue Libraries',
          tag:         'Library',
          description: 'Search Purdue\'s vast print and digital collections, access research databases, and request interlibrary loans from any campus location. Subject librarians are available by appointment for research consultations.',
          url:         'https://lib.purdue.edu',
        },
        {
          id:          'purdue-degree-navigator',
          title:       'Degree Navigator',
          tag:         'Planning',
          description: 'Track your progress toward graduation by mapping completed coursework against remaining degree requirements in real time. Use the what-if feature to evaluate how a major change would affect your four-year plan.',
          url:         'https://degreemap.purdue.edu',
        },
        {
          id:          'purdue-academic-calendar',
          title:       'Academic Calendar',
          tag:         'Calendar',
          description: 'Official semester key dates including the first day of classes, add/drop deadlines, spring break, finals week, and commencement ceremonies. Check this page at the start of each term to avoid missing critical registration windows.',
          url:         'https://registrar.purdue.edu/calendars',
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
          id:          'purdue-cco',
          title:       'Center for Career Opportunities',
          tag:         'Career',
          description: 'Purdue\'s primary career center offering resume critiques, mock interviews, and one-on-one career coaching for students across all majors. The CCO also hosts employer information sessions and on-campus recruiting coordination.',
          url:         'https://cco.purdue.edu',
        },
        {
          id:          'purdue-handshake',
          title:       'Handshake at Purdue',
          tag:         'Jobs',
          description: 'Browse internship and full-time job postings targeting Purdue Boilermakers, register for career fair sessions, and schedule on-campus interviews with Fortune 500 and engineering recruiters. Sync your profile with LinkedIn for broader visibility.',
          url:         'https://purdue.joinhandshake.com',
        },
        {
          id:          'purdue-linkedin-learning',
          title:       'LinkedIn Learning',
          tag:         'Skills',
          description: 'Access thousands of professionally produced courses in software development, data science, leadership, and design at no cost with your Purdue credentials. Completed courses generate shareable certificates for your LinkedIn profile.',
          url:         'https://linkedin.com/learning',
        },
        {
          id:          'purdue-boilerconnect',
          title:       'BoilerConnect',
          tag:         'Network',
          description: 'Connect with Purdue alumni mentors for informational interviews, career advice, and industry referrals across engineering, business, agriculture, and liberal arts sectors. Mentors can be filtered by major, industry, and geographic region.',
          url:         'https://purdue.joinhandshake.com',
        },
        {
          id:          'purdue-career-fairs',
          title:       'Career Fairs',
          tag:         'Events',
          description: 'View the schedule for Purdue\'s semester career fairs, including the giant Engineering Fair drawing 300+ employers each fall. Pre-register, upload your resume, and research attending companies before fair day.',
          url:         'https://cco.purdue.edu/events',
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
          id:          'purdue-recsports',
          title:       'Purdue RecSports',
          tag:         'Wellness',
          description: 'Reserve court time, sign up for group fitness classes, and join intramural sports leagues at the France A. Córdova Recreational Sports Center. Membership is included in student activity fees for all enrolled students.',
          url:         'https://purdue.edu/recsports',
        },
        {
          id:          'purdue-union',
          title:       'Purdue Memorial Union',
          tag:         'Union',
          description: 'One of the largest student unions in the country, housing bowling lanes, a hotel, dining options, and student organization offices. The PMU is a central gathering space for Purdue student life and campus events.',
          url:         'https://purdueunion.com',
        },
        {
          id:          'purdue-dining',
          title:       'Dining Services',
          tag:         'Dining',
          description: 'Browse daily menus, allergen filters, and hours for all Purdue residential and retail dining locations. Manage your Boilermaker Bucks balance and meal plan allocation directly from the dining portal.',
          url:         'https://dining.purdue.edu',
        },
        {
          id:          'purdue-student-activities',
          title:       'Student Activities',
          tag:         'Life',
          description: 'Discover over 1,000 registered student organizations, leadership development programs, and cultural events coordinated by Purdue\'s Student Activities and Organizations office. Explore clubs ranging from rocketry to ballroom dancing.',
          url:         'https://purdue.edu/studentlife',
        },
        {
          id:          'purdue-events',
          title:       'Purdue Events',
          tag:         'Events',
          description: 'Browse the university-wide events calendar for lectures, performances, athletic events, and cultural celebrations happening across the West Lafayette campus. Many events are free with a valid Purdue student ID.',
          url:         'https://events.purdue.edu',
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
          id:          'purdue-health',
          title:       'Student Health Center',
          tag:         'Health',
          description: 'Schedule medical, counseling, and psychiatric appointments at Purdue\'s Student Health Center on the West Lafayette campus. Telehealth visits and same-day urgent care slots are available for enrolled students.',
          url:         'https://purdue.edu/studenthealth',
        },
        {
          id:          'purdue-it',
          title:       'IT Help Desk',
          tag:         'IT',
          description: 'Submit support tickets, reset your Purdue career account password, access the university VPN, and download Microsoft 365 and other licensed software at no cost. Walk-in support is available at the ITAP Help Desk in the HAAS building.',
          url:         'https://purdue.edu/itap',
        },
        {
          id:          'purdue-housing',
          title:       'University Residences',
          tag:         'Housing',
          description: 'Apply for on-campus residence halls, manage your room assignment and meal plan, and submit maintenance requests through the University Residences portal. Explore living-learning communities that pair housing with academic programs.',
          url:         'https://housing.purdue.edu',
        },
        {
          id:          'purdue-financial-aid',
          title:       'Financial Aid',
          tag:         'Finance',
          description: 'View your financial aid award package, accept or decline offers, and monitor your FAFSA status through the Division of Financial Aid. Set up direct deposit to receive refunds and manage outside scholarship reporting requirements.',
          url:         'https://purdue.edu/dfa',
        },
        {
          id:          'purdue-parking',
          title:       'Parking',
          tag:         'Parking',
          description: 'Purchase and manage Purdue parking permits for lots and garages across West Lafayette, view real-time garage availability, and pay or contest citations online. The Campus Shuttle and CityBus routes offer permit-free travel to key campus destinations.',
          url:         'https://purdue.edu/parking',
        },
      ],
    },

  ],
}
