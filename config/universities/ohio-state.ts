import type { UniversityConfig } from './index'

export const OHIO_STATE: UniversityConfig = {
  id:           'ohio-state',
  name:         'Ohio State University',
  shortName:    'Ohio State',
  location:     'Columbus, OH',
  gpaScale:     '4.0',
  currencyName: 'BuckID Dining Dollars',

  categories: [

    // ── ACADEMICS & REGISTRATION ─────────────────────────────
    {
      id:    'academics',
      label: 'Academics & Registration',
      tab:   'academics',
      links: [
        {
          id:          'osu-buckeye-link',
          title:       'Buckeye Link',
          tag:         'Portal',
          description: 'Central student portal for course registration, financial aid, tuition billing, and degree progress at Ohio State. The primary gateway for all student administrative transactions.',
          url:         'https://buckeyelink.osu.edu',
        },
        {
          id:          'osu-carmen',
          title:       'Carmen Canvas',
          tag:         'LMS',
          description: 'Course materials, assignments, quizzes, grades, and announcements for all enrolled Ohio State courses through the Carmen Canvas learning management system. Integrates with Zoom and CarmenBooks digital textbooks.',
          url:         'https://carmen.osu.edu',
        },
        {
          id:          'osu-registrar',
          title:       'Registrar',
          tag:         'Admin',
          description: 'Manage enrollment verification, official transcript requests, grade appeals, and add/drop deadline compliance. The Registrar also oversees graduation applications and academic record corrections.',
          url:         'https://registrar.osu.edu',
        },
        {
          id:          'osu-libraries',
          title:       'University Libraries',
          tag:         'Library',
          description: 'Access Ohio State\'s extensive library system including Thompson Library, digital databases, research consultations, and interlibrary loan services. One of the largest research library collections in North America.',
          url:         'https://library.osu.edu',
        },
        {
          id:          'osu-degreeworks',
          title:       'DegreeWorks Degree Audit',
          tag:         'Planning',
          description: 'Track your academic progress, review completed and remaining requirements, and plan future course selections with Ohio State\'s DegreeWorks degree audit system. Updated each semester after grades are posted.',
          url:         'https://degreeworks.osu.edu',
        },
        {
          id:          'osu-academic-calendar',
          title:       'Academic Calendar',
          tag:         'Calendar',
          description: 'Semester key dates including first and last days of classes, add/drop deadlines, autumn and spring break schedules, finals periods, and university holidays. Ohio State operates on a semester system.',
          url:         'https://registrar.osu.edu/calendars',
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
          id:          'osu-cps',
          title:       'Career and Professional Success',
          tag:         'Career',
          description: 'Ohio State\'s central career services office offering resume reviews, career coaching, interview preparation, and connections to thousands of recruiting employers. Hosts major career fairs each semester across multiple colleges.',
          url:         'https://cps.osu.edu',
        },
        {
          id:          'osu-handshake',
          title:       'Handshake at Ohio State',
          tag:         'Jobs',
          description: 'National internship and job platform with Ohio State-exclusive employer postings and on-campus recruiting opportunities. Schedule interviews, register for career fairs, and explore employer profiles from your Buckeye Handshake account.',
          url:         'https://osu.joinhandshake.com',
        },
        {
          id:          'osu-linkedin-learning',
          title:       'LinkedIn Learning',
          tag:         'Skills',
          description: 'Free access to thousands of professional development and technical skill video courses through Ohio State\'s institutional LinkedIn Learning license. Completed courses and skill certificates can be added to your LinkedIn profile.',
          url:         'https://linkedin.com/learning',
        },
        {
          id:          'osu-handshake-main',
          title:       'Handshake Jobs Board',
          tag:         'Jobs',
          description: 'Browse full-time job and internship listings curated for Ohio State students across engineering, business, health sciences, arts, and more. Receive personalized job recommendations based on your major and interests.',
          url:         'https://joinhandshake.com',
        },
        {
          id:          'osu-career-fairs',
          title:       'Career Fair Schedule',
          tag:         'Events',
          description: 'Full schedule of Ohio State career fairs, employer information sessions, and networking events organized by college and industry. Includes the flagship All-Ohio State Career Fair and college-specific recruiting days.',
          url:         'https://cps.osu.edu/events',
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
          id:          'osu-recsports',
          title:       'Recreational Sports',
          tag:         'Wellness',
          description: 'Ohio State\'s RPAC and Adventure Recreation Center offer fitness equipment, group fitness classes, pools, climbing walls, and intramural and club sport registration for all enrolled students. Membership is included in student fees.',
          url:         'https://recsports.osu.edu',
        },
        {
          id:          'osu-ohio-union',
          title:       'Ohio Union',
          tag:         'Union',
          description: 'Ohio State\'s student union featuring dining, event spaces, a game room, student organization offices, and the Ohio Union Activities Board programming. Central hub for student social and cultural life on campus.',
          url:         'https://ohiounion.osu.edu',
        },
        {
          id:          'osu-dining',
          title:       'OSU Dining',
          tag:         'Dining',
          description: 'Dining hall menus, hours, meal plan balances, allergen information, and campus food venue locations across Ohio State. Manage your BuckID Dining Dollars and view nutritional details for all residential dining locations.',
          url:         'https://dining.osu.edu',
        },
        {
          id:          'osu-student-activities',
          title:       'Student Activities',
          tag:         'Orgs',
          description: 'Browse and join from over 1,000 registered Ohio State student organizations including academic clubs, cultural groups, Greek life, and service organizations. Submit new organization registrations through Student Activities.',
          url:         'https://activities.osu.edu',
        },
        {
          id:          'osu-events',
          title:       'Campus Events Calendar',
          tag:         'Events',
          description: 'Comprehensive Ohio State events calendar listing lectures, performances, cultural programming, athletic events, and student organization activities throughout the academic year.',
          url:         'https://events.osu.edu',
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
          id:          'osu-health',
          title:       'Student Health Services',
          tag:         'Health',
          description: 'Schedule medical, counseling, and wellness appointments at Ohio State\'s on-campus health center. Offers primary care, mental health services, physical therapy, and immunization management for all enrolled students.',
          url:         'https://studenthealth.osu.edu',
        },
        {
          id:          'osu-it',
          title:       'IT Service Desk',
          tag:         'IT',
          description: 'Submit IT support tickets, manage your Ohio State name.# account, configure VPN, and download Microsoft 365 and other licensed software at no cost. Offers walk-in support at the Technology Support Center in 18th Avenue Library.',
          url:         'https://it.osu.edu',
        },
        {
          id:          'osu-housing',
          title:       'University Housing',
          tag:         'Housing',
          description: 'Apply for on-campus residence hall and suite housing, manage room assignments, and submit maintenance requests through Ohio State University Housing. Freshman live-on requirements are managed through the housing application.',
          url:         'https://housing.osu.edu',
        },
        {
          id:          'osu-financial-aid',
          title:       'Student Financial Aid',
          tag:         'Finance',
          description: 'View and manage your financial aid award package, monitor scholarship and grant requirements, set up direct deposit for refunds, and access tuition billing statements. Ohio State offers extensive merit and need-based aid programs.',
          url:         'https://sfa.osu.edu',
        },
        {
          id:          'osu-transportation',
          title:       'Parking & Transportation',
          tag:         'Transit',
          description: 'Purchase and manage campus parking permits, view CABS shuttle schedules, and access COTA bus pass information for student commuters. Ohio State provides free COTA bus service to all enrolled students.',
          url:         'https://transportation.osu.edu',
        },
      ],
    },

  ],
}
