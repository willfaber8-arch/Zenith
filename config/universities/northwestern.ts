import type { UniversityConfig } from './index'

export const NORTHWESTERN: UniversityConfig = {
  id:           'northwestern',
  name:         'Northwestern University',
  shortName:    'Northwestern',
  location:     'Evanston, IL',
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
          id:          'nu-caesar',
          title:       'CAESAR Portal',
          tag:         'Portal',
          description: 'Central student portal for course registration, grades, financial aid, and degree progress tracking. The primary hub for all academic administration at Northwestern.',
          url:         'https://caesar.northwestern.edu',
        },
        {
          id:          'nu-canvas',
          title:       'Canvas LMS',
          tag:         'LMS',
          description: 'Course materials, assignments, announcements, quizzes, and grades for all enrolled Northwestern classes. Integrates with Zoom, Panopto, and Turnitin.',
          url:         'https://canvas.northwestern.edu',
        },
        {
          id:          'nu-registrar',
          title:       'Registrar',
          tag:         'Admin',
          description: 'Official transcripts, enrollment verification, add/drop deadline management, and academic record requests. Also manages grade change petitions and graduation applications.',
          url:         'https://registrar.northwestern.edu',
        },
        {
          id:          'nu-library',
          title:       'Northwestern Libraries',
          tag:         'Library',
          description: 'Full access to Northwestern\'s digital and physical library collections including databases, research guides, and interlibrary loan services. Includes access to the Galter Health Sciences and Pritzker Legal Research libraries.',
          url:         'https://library.northwestern.edu',
        },
        {
          id:          'nu-degree-audit',
          title:       'Degree Audit',
          tag:         'Planning',
          description: 'Track progress toward graduation by reviewing completed and remaining requirements across your major, minor, and distribution areas. Updated each quarter after grades post.',
          url:         'https://registrar.northwestern.edu/graduation/degree-audit',
        },
        {
          id:          'nu-academic-calendar',
          title:       'Academic Calendar',
          tag:         'Calendar',
          description: 'Quarterly key dates including first and last days of class, add/drop deadlines, reading period, finals schedules, and university holidays. Northwestern operates on a quarter system.',
          url:         'https://registrar.northwestern.edu/calendars',
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
          id:          'nu-career-advancement',
          title:       'Career Advancement',
          tag:         'Career',
          description: 'Northwestern\'s primary career services office offering resume reviews, interview coaching, and career counseling by industry-specific advisors. Hosts quarterly career fairs and employer information sessions.',
          url:         'https://northwestern.edu/career',
        },
        {
          id:          'nu-handshake',
          title:       'Handshake',
          tag:         'Jobs',
          description: 'National internship and job board with Northwestern-exclusive postings from thousands of employers. Schedule on-campus interviews and RSVP for recruiter events directly through the platform.',
          url:         'https://joinhandshake.com',
        },
        {
          id:          'nu-linkedin-learning',
          title:       'LinkedIn Learning',
          tag:         'Skills',
          description: 'Free access to thousands of video courses covering technical skills, business, and creative disciplines through Northwestern\'s institutional license. Courses can be added to your LinkedIn profile on completion.',
          url:         'https://linkedin.com/learning',
        },
        {
          id:          'nu-nuworks',
          title:       'NUworks',
          tag:         'Jobs',
          description: 'Northwestern\'s on-campus student employment and work-study job board, listing positions in research labs, administrative offices, and campus facilities. Managed through the Career Advancement office.',
          url:         'https://northwestern.csod.com',
        },
        {
          id:          'nu-career-fairs',
          title:       'Career Fairs & Events',
          tag:         'Events',
          description: 'Full schedule of Northwestern career fairs, employer panels, networking nights, and industry-specific recruiting events. Includes the annual Fall Career Fair and Engineering Career Fair.',
          url:         'https://northwestern.edu/career/events',
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
          id:          'nu-spac',
          title:       'SPAC Recreation',
          tag:         'Wellness',
          description: 'The Henry Crown Sports Pavilion and Aquatics Complex offers fitness equipment, group fitness classes, pools, racquetball courts, and intramural sport registration. Open to all Northwestern students.',
          url:         'https://northwestern.edu/spac',
        },
        {
          id:          'nu-norris',
          title:       'Norris University Center',
          tag:         'Union',
          description: 'Northwestern\'s student union featuring dining options, study lounges, event spaces, student organization offices, and the Wildcat Den game room. Central hub for campus life.',
          url:         'https://northwestern.edu/norris',
        },
        {
          id:          'nu-dining',
          title:       'Dining Services',
          tag:         'Dining',
          description: 'Dining hall menus, hours, meal plan balances, allergen information, and all residential and retail food venue locations across the Evanston campus. Manage your Dining Dollars account online.',
          url:         'https://dining.northwestern.edu',
        },
        {
          id:          'nu-student-events',
          title:       'Student Events',
          tag:         'Events',
          description: 'Campus events calendar maintained by Student Affairs listing concerts, lectures, cultural programming, and Wildcat Weekend activities throughout the academic year.',
          url:         'https://northwestern.edu/student-affairs',
        },
        {
          id:          'nu-student-orgs',
          title:       'Student Organizations',
          tag:         'Orgs',
          description: 'Browse and join from over 500 registered Northwestern student organizations spanning academic, cultural, service, arts, and Greek life. Submit new organization applications through the Student Affairs portal.',
          url:         'https://northwestern.edu/student-affairs/student-organizations',
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
          id:          'nu-health',
          title:       'Northwestern University Health Service',
          tag:         'Health',
          description: 'Schedule medical, counseling, and wellness appointments through NUHS, Northwestern\'s on-campus student health center. Offers primary care, mental health services, and immunization records management.',
          url:         'https://northwestern.edu/health',
        },
        {
          id:          'nu-it',
          title:       'IT Help Desk',
          tag:         'IT',
          description: 'Submit IT support tickets, manage your Northwestern NetID, configure VPN access, and download licensed Microsoft 365 and Adobe Creative Cloud software. Offers in-person support at the Tech Desk in Mudd Library.',
          url:         'https://northwestern.edu/it',
        },
        {
          id:          'nu-residential',
          title:       'Residential Services',
          tag:         'Housing',
          description: 'Apply for on-campus housing, manage room assignments, submit maintenance requests, and access residential community resources. Northwestern guarantees housing for all four undergraduate years.',
          url:         'https://northwestern.edu/residential-services',
        },
        {
          id:          'nu-sfs',
          title:       'Student Financial Services',
          tag:         'Finance',
          description: 'View scholarship, grant, and loan award packages, manage FAFSA updates, and set up direct deposit for financial aid refunds. Access tuition billing statements and payment plans through SFS.',
          url:         'https://northwestern.edu/sfs',
        },
        {
          id:          'nu-parking',
          title:       'Parking & Transportation',
          tag:         'Transit',
          description: 'Purchase and manage campus parking permits, view shuttle schedules between the Evanston and Chicago campuses, and access CTA transit pass information for student commuters.',
          url:         'https://northwestern.edu/transportation',
        },
      ],
    },

  ],
}
