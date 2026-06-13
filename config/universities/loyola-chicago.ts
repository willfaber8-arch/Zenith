import type { UniversityConfig } from './index'

export const LOYOLA_CHICAGO: UniversityConfig = {
  id:           'loyola-chicago',
  name:         'Loyola University Chicago',
  shortName:    'Loyola Chicago',
  location:     'Chicago, IL',
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
          id:          'luc-locus',
          title:       'LOCUS Student Portal',
          tag:         'Portal',
          description: 'Central student information system for registration, grades, financial aid, and degree planning at Loyola University Chicago. Primary hub for all academic administration.',
          url:         'https://locus.luc.edu',
        },
        {
          id:          'luc-sakai',
          title:       'Sakai LMS',
          tag:         'LMS',
          description: 'Access course materials, assignments, announcements, discussion boards, and grades for all enrolled classes through Loyola\'s learning management system.',
          url:         'https://sakai.luc.edu',
        },
        {
          id:          'luc-registrar',
          title:       'Office of the Registrar',
          tag:         'Admin',
          description: 'Official transcripts, enrollment verification, add/drop deadline management, and academic record services for Loyola University Chicago students.',
          url:         'https://www.luc.edu/academics/registrar',
        },
        {
          id:          'luc-library',
          title:       'Cudahy & Lewis Libraries',
          tag:         'Library',
          description: 'Full access to Loyola\'s digital library collections, journal databases, research guides, and interlibrary loan services across all Chicago-area campuses.',
          url:         'https://libraries.luc.edu',
        },
        {
          id:          'luc-dars',
          title:       'Degree Audit (DARS)',
          tag:         'Planning',
          description: 'Track your degree requirements, map remaining coursework, and verify progress toward graduation using Loyola\'s official degree audit and reporting system.',
          url:         'https://www.luc.edu/academics/registrar/dars',
        },
        {
          id:          'luc-calendar',
          title:       'Academic Calendar',
          tag:         'Calendar',
          description: 'Official Loyola semester dates covering first/last day of class, add/drop deadlines, final examination schedules, and university holidays.',
          url:         'https://www.luc.edu/academics/registrar/academiccalendar',
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
          id:          'luc-career',
          title:       'Career Development Center',
          tag:         'Career',
          description: 'Resume reviews, mock interviews, and one-on-one career coaching with Loyola career advisors. Leverages Chicago\'s world-class business and nonprofit ecosystem for student placements.',
          url:         'https://www.luc.edu/career',
        },
        {
          id:          'luc-handshake',
          title:       'Handshake at Loyola',
          tag:         'Jobs',
          description: 'National internship and full-time job board with Loyola-exclusive postings. Schedule on-campus interviews, explore employer profiles, and RSVP for Chicago-area career events.',
          url:         'https://luc.joinhandshake.com',
        },
        {
          id:          'luc-linkedin-learning',
          title:       'LinkedIn Learning',
          tag:         'Learning',
          description: 'Free access to thousands of professional development courses in technology, business, and creative fields using your Loyola student credentials.',
          url:         'https://linkedin.com/learning',
        },
        {
          id:          'luc-rambler-network',
          title:       'Rambler Career Network',
          tag:         'Network',
          description: 'Connect with Loyola\'s extensive employer partner network and alumni community across Chicago\'s finance, healthcare, nonprofit, and technology sectors.',
          url:         'https://www.luc.edu/career/employers',
        },
        {
          id:          'luc-interview-prep',
          title:       'Interview Preparation',
          tag:         'Interview Prep',
          description: 'Access Loyola\'s interview coaching resources, practice guides, and mock interview scheduling through the Career Development Center\'s preparation portal.',
          url:         'https://www.luc.edu/career/students/prepareforinterview',
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
          id:          'luc-campusrec',
          title:       'Campus Recreation',
          tag:         'Wellness',
          description: 'Fitness equipment access, group fitness classes, intramural sports leagues, and outdoor adventure programs across Loyola\'s Lake Shore and Water Tower campuses.',
          url:         'https://www.luc.edu/campusrec',
        },
        {
          id:          'luc-wellness',
          title:       'Wellness Center',
          tag:         'Wellness',
          description: 'Comprehensive wellness programs, stress management workshops, and health promotion resources supporting Rambler student wellbeing throughout the academic year.',
          url:         'https://www.luc.edu/wellness',
        },
        {
          id:          'luc-dining',
          title:       'Loyola Dining',
          tag:         'Dining',
          description: 'Dining hall menus, operating hours, meal plan balances, Dining Dollars management, and all food venues across Loyola\'s Chicago-area campuses.',
          url:         'https://www.luc.edu/auxiliaryservices/dining',
        },
        {
          id:          'luc-osa',
          title:       'Student Activities',
          tag:         'Activities',
          description: 'Browse 200+ registered Rambler student organizations, view upcoming campus events, and explore leadership opportunities through the Office of Student Activities.',
          url:         'https://www.luc.edu/osa',
        },
        {
          id:          'luc-map',
          title:       'Campus Map',
          tag:         'Map',
          description: 'Interactive map of Loyola\'s Lake Shore, Water Tower, Health Sciences, and Rome campuses with building directories and accessible route information.',
          url:         'https://www.luc.edu/map',
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
          id:          'luc-health',
          title:       'Student Health Center',
          tag:         'Health',
          description: 'Schedule medical and counseling appointments, view immunization requirements, and access mental health services at Loyola\'s Student Health Center on the Lake Shore campus.',
          url:         'https://www.luc.edu/studenthealth',
        },
        {
          id:          'luc-its',
          title:       'ITS Service Desk',
          tag:         'IT',
          description: 'Submit IT support requests, manage your Loyola network credentials, access campus VPN, and download licensed Microsoft 365 and software through ITS.',
          url:         'https://www.luc.edu/its',
        },
        {
          id:          'luc-reslife',
          title:       'Residence Life',
          tag:         'Housing',
          description: 'Apply for on-campus housing, manage room assignments, submit maintenance requests, and connect with residential programming through Loyola Residence Life.',
          url:         'https://www.luc.edu/reslife',
        },
        {
          id:          'luc-finaid',
          title:       'Financial Aid',
          tag:         'Finance',
          description: 'View scholarship and grant awards, manage your FAFSA, review aid packages, and set up direct deposit for financial aid refunds at Loyola Chicago.',
          url:         'https://www.luc.edu/finaid',
        },
        {
          id:          'luc-bursar',
          title:       'Bursar\'s Office',
          tag:         'Billing',
          description: 'View and pay tuition bills, manage payment plans, access 1098-T tax forms, and review account activity through the Loyola Bursar\'s Office.',
          url:         'https://www.luc.edu/bursar',
        },
      ],
    },

  ],
}
