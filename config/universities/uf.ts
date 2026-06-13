import type { UniversityConfig } from './index'

export const UF: UniversityConfig = {
  id:           'uf',
  name:         'University of Florida',
  shortName:    'UF',
  location:     'Gainesville, FL',
  gpaScale:     '4.0',
  currencyName: 'Gator Dining Dollars',

  categories: [

    // ── ACADEMICS & REGISTRATION ─────────────────────────────
    {
      id:    'academics',
      label: 'Academics & Registration',
      tab:   'academics',
      links: [
        {
          id:          'uf-one',
          title:       'ONE.UF Portal',
          tag:         'Portal',
          description: 'Central student portal for course registration, transcript requests, financial aid, and degree progress at the University of Florida. The single sign-on gateway for all student administrative services.',
          url:         'https://one.uf.edu',
        },
        {
          id:          'uf-canvas',
          title:       'Canvas e-Learning',
          tag:         'LMS',
          description: 'Course materials, assignments, quizzes, discussion boards, and grades for all enrolled UF courses. Integrates with Zoom, Kaltura, and Honorlock remote proctoring.',
          url:         'https://elearning.ufl.edu',
        },
        {
          id:          'uf-registrar',
          title:       'Registrar',
          tag:         'Admin',
          description: 'Manage enrollment verification, official transcript requests, grade forgiveness applications, and add/drop deadline compliance. Also handles FERPA privacy settings and diploma ordering.',
          url:         'https://registrar.ufl.edu',
        },
        {
          id:          'uf-libraries',
          title:       'UF Libraries',
          tag:         'Library',
          description: 'Access the George A. Smathers Libraries system including digital databases, research guides, course reserves, and interlibrary loan services. UF holds one of the largest library collections in the Southeast.',
          url:         'https://library.ufl.edu',
        },
        {
          id:          'uf-degree-audit',
          title:       'Degree Audit',
          tag:         'Planning',
          description: 'Review completed and remaining degree requirements for your major, minor, and general education through the ONE.UF degree audit tool. Updated each semester after final grades are posted.',
          url:         'https://one.uf.edu',
        },
        {
          id:          'uf-academic-calendar',
          title:       'Academic Calendar',
          tag:         'Calendar',
          description: 'Semester key dates including first and last days of classes, drop deadlines, withdrawal periods, finals schedules, and university holidays. UF operates on a semester system with optional summer sessions.',
          url:         'https://registrar.ufl.edu/calendars',
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
          id:          'uf-career',
          title:       'Career Connections Center',
          tag:         'Career',
          description: 'UF\'s primary career services hub offering resume reviews, mock interviews, career advising, and connections to thousands of employers who recruit Gators. Houses the Gator CareerLink job board and hosts major career fairs each semester.',
          url:         'https://career.ufl.edu',
        },
        {
          id:          'uf-handshake',
          title:       'Handshake',
          tag:         'Jobs',
          description: 'National internship and job platform with UF-exclusive postings and direct employer recruiting. Schedule on-campus interviews and register for career fair appointments through your Gator Handshake profile.',
          url:         'https://joinhandshake.com',
        },
        {
          id:          'uf-linkedin-learning',
          title:       'LinkedIn Learning',
          tag:         'Skills',
          description: 'Free access to thousands of professional development video courses through UF\'s institutional LinkedIn Learning license. Skills certificates earned can be displayed directly on your LinkedIn profile.',
          url:         'https://linkedin.com/learning',
        },
        {
          id:          'uf-gator-jobs',
          title:       'Gator Jobs',
          tag:         'Jobs',
          description: 'UF\'s on-campus and Florida-based student job board managed through the Career Connections Center. Lists research assistant positions, graduate assistantships, work-study roles, and local internships.',
          url:         'https://career.ufl.edu',
        },
        {
          id:          'uf-career-fairs',
          title:       'Career Fair Events',
          tag:         'Events',
          description: 'Full schedule of UF career fairs, employer information sessions, and networking events organized by college and industry. Includes the signature Fall and Spring Gator Career Fairs attracting hundreds of employers.',
          url:         'https://career.ufl.edu/events',
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
          id:          'uf-recsports',
          title:       'Florida Rec Sports',
          tag:         'Wellness',
          description: 'Access the Southwest Recreation Center and Student Recreation and Fitness Center for fitness equipment, group exercise classes, pools, and intramural and club sport registration. All registered UF students receive free recreational facility access.',
          url:         'https://recsports.ufl.edu',
        },
        {
          id:          'uf-reitz',
          title:       'Reitz Union',
          tag:         'Union',
          description: 'University of Florida\'s student union featuring dining, the Reitz Cinema, bowling lanes, student organization offices, a hotel, and event venues. One of the largest student unions in the United States.',
          url:         'https://union.ufl.edu',
        },
        {
          id:          'uf-dining',
          title:       'UF Dining',
          tag:         'Dining',
          description: 'Dining hall menus, hours, meal plan balances, and campus food venue locations across UF. Manage your Gator Dining Dollars account and view allergen and nutritional information for all menu items.',
          url:         'https://dining.ufl.edu',
        },
        {
          id:          'uf-student-orgs',
          title:       'Student Organizations',
          tag:         'Orgs',
          description: 'Browse over 1,000 registered UF student organizations including academic clubs, Greek life, cultural associations, service organizations, and recreational sports clubs. Apply to start new organizations through Student Involvement.',
          url:         'https://orgs.studentinvolvement.ufl.edu',
        },
        {
          id:          'uf-events',
          title:       'UF Events Calendar',
          tag:         'Events',
          description: 'Campus-wide events calendar listing lectures, performances, cultural programs, sporting events, and student organization activities at the University of Florida. Filter by date, category, and campus location.',
          url:         'https://events.ufl.edu',
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
          id:          'uf-health',
          title:       'Student Health Care Center',
          tag:         'Health',
          description: 'Schedule medical appointments, access mental health counseling, manage immunization records, and receive pharmacy services at UF\'s on-campus health center. The SHCC serves all enrolled UF students.',
          url:         'https://shcc.ufl.edu',
        },
        {
          id:          'uf-it',
          title:       'UF Computing Help Desk',
          tag:         'IT',
          description: 'Submit IT support tickets, manage your GatorLink account, configure VPN, and access software downloads including Microsoft 365 at no cost to students. The Help Desk offers walk-in, phone, and remote support options.',
          url:         'https://helpdesk.ufl.edu',
        },
        {
          id:          'uf-housing',
          title:       'UF Housing',
          tag:         'Housing',
          description: 'Apply for on-campus residence hall and apartment housing, manage room assignments, submit maintenance requests, and review community standards. UF Housing manages over 9,000 on-campus beds.',
          url:         'https://housing.ufl.edu',
        },
        {
          id:          'uf-financial-aid',
          title:       'Student Financial Aid',
          tag:         'Finance',
          description: 'View and manage your financial aid award package, monitor FAFSA requirements, set up direct deposit for refunds, and access Florida Prepaid and Bright Futures scholarship information.',
          url:         'https://sfa.ufl.edu',
        },
        {
          id:          'uf-transportation',
          title:       'Transportation & Parking Services',
          tag:         'Transit',
          description: 'Purchase and manage campus parking permits, view RTS bus route schedules, and access bicycle registration services. UF\'s Regional Transit System provides free bus service to all enrolled students.',
          url:         'https://taps.ufl.edu',
        },
      ],
    },

  ],
}
