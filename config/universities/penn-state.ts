import type { UniversityConfig } from './index'

export const PENN_STATE: UniversityConfig = {
  id:           'penn-state',
  name:         'Pennsylvania State University',
  shortName:    'Penn State',
  location:     'University Park, PA',
  gpaScale:     '4.0',
  currencyName: 'LionCash',

  categories: [

    // ── ACADEMICS & REGISTRATION ─────────────────────────────
    {
      id:    'academics',
      label: 'Academics & Registration',
      tab:   'academics',
      links: [
        {
          id:          'psu-lionpath',
          title:       'LionPATH Portal',
          tag:         'Portal',
          description: 'Penn State\'s central student information system for course registration, financial aid, tuition billing, and academic record management. The primary portal for all student administrative services at University Park and all campus locations.',
          url:         'https://lionpath.psu.edu',
        },
        {
          id:          'psu-canvas',
          title:       'Canvas LMS',
          tag:         'LMS',
          description: 'Course materials, assignments, quizzes, discussion boards, and grades for all enrolled Penn State courses. Integrates with Zoom, Kaltura video, and Turnitin academic integrity tools.',
          url:         'https://canvas.psu.edu',
        },
        {
          id:          'psu-registrar',
          title:       'Registrar',
          tag:         'Admin',
          description: 'Request official transcripts, enrollment verification letters, and academic record corrections through Penn State\'s Office of the University Registrar. Also manages commencement applications and FERPA authorization.',
          url:         'https://registrar.psu.edu',
        },
        {
          id:          'psu-libraries',
          title:       'Penn State Libraries',
          tag:         'Library',
          description: 'Access Penn State\'s extensive library system including Pattee and Paterno Library at University Park, digital databases, research consultations, and interlibrary loan services. Holds one of the largest research collections among US public universities.',
          url:         'https://libraries.psu.edu',
        },
        {
          id:          'psu-degree-audit',
          title:       'Degree Audit',
          tag:         'Planning',
          description: 'Track progress toward graduation by reviewing completed and remaining requirements for your major, minor, and general education through LionPATH. Updated each semester after final grades are officially posted.',
          url:         'https://registrar.psu.edu/graduation/degree-audit',
        },
        {
          id:          'psu-academic-calendar',
          title:       'Academic Calendar',
          tag:         'Calendar',
          description: 'Semester key dates including first and last days of class, late drop deadlines, spring break, finals schedules, commencement dates, and university holidays. Penn State operates on a two-semester system with optional summer sessions.',
          url:         'https://registrar.psu.edu/calendars',
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
          id:          'psu-career-services',
          title:       'Career Services',
          tag:         'Career',
          description: 'Penn State\'s central career office offering resume critiques, career coaching, interview preparation, and connections to a vast employer network. Coordinates the signature Penn State Career Days fairs each semester.',
          url:         'https://careerservices.psu.edu',
        },
        {
          id:          'psu-handshake',
          title:       'Handshake at Penn State',
          tag:         'Jobs',
          description: 'Internship and job platform with Penn State-specific employer postings and on-campus recruiting opportunities. Schedule interviews, RSVP for career fair appointments, and explore employer profiles from your Nittany Lion Handshake account.',
          url:         'https://psu.joinhandshake.com',
        },
        {
          id:          'psu-linkedin-learning',
          title:       'LinkedIn Learning',
          tag:         'Skills',
          description: 'Free access to thousands of professional development and technical skill courses through Penn State\'s institutional LinkedIn Learning license. Skill certificates earned can be displayed directly on your LinkedIn profile.',
          url:         'https://linkedin.com/learning',
        },
        {
          id:          'psu-nittany-careers',
          title:       'Nittany Lion Careers',
          tag:         'Jobs',
          description: 'Penn State\'s student employment and career development resources managed through Student Affairs, listing research positions, campus jobs, and co-op opportunities across all colleges and departments.',
          url:         'https://studentaffairs.psu.edu/career',
        },
        {
          id:          'psu-career-fairs',
          title:       'Career Fair Schedule',
          tag:         'Events',
          description: 'Full schedule of Penn State career fairs, employer information sessions, and networking events organized by college and industry. Includes the flagship Career Days events attracting thousands of students and hundreds of employers.',
          url:         'https://careerservices.psu.edu/events',
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
          id:          'psu-campus-rec',
          title:       'Campus Recreation',
          tag:         'Wellness',
          description: 'Penn State\'s Recreation Building and IM Building offer fitness equipment, group fitness classes, pools, and intramural and club sport registration for all enrolled students. Campus Recreation membership is included in student fees.',
          url:         'https://campusrec.psu.edu',
        },
        {
          id:          'psu-hub',
          title:       'HUB Student Union',
          tag:         'Union',
          description: 'Hetzel Union Building is Penn State\'s student union featuring dining, a food court, student organization offices, event spaces, and the Lion Shrine. Central hub for student life and social programming on campus.',
          url:         'https://studentaffairs.psu.edu/hub',
        },
        {
          id:          'psu-dining',
          title:       'Penn State Dining',
          tag:         'Dining',
          description: 'Dining hall menus, hours, meal plan balances, allergen and nutritional information, and campus food venue locations across University Park. Manage your LionCash account and meal plan through Penn State Dining Services.',
          url:         'https://dining.psu.edu',
        },
        {
          id:          'psu-student-orgs',
          title:       'Student Organizations',
          tag:         'Orgs',
          description: 'Browse and join from over 1,000 registered Penn State student organizations through OrgCentral, including academic clubs, cultural associations, Greek life, and THON fundraising organizations. Register new organizations through Student Affairs.',
          url:         'https://orgcentral.psu.edu',
        },
        {
          id:          'psu-events',
          title:       'Penn State Events',
          tag:         'Events',
          description: 'Campus-wide events calendar listing lectures, cultural performances, sporting events, student organization activities, and community programming throughout the academic year at University Park.',
          url:         'https://events.psu.edu',
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
          id:          'psu-health',
          title:       'University Health Services',
          tag:         'Health',
          description: 'Schedule medical, counseling, and wellness appointments at Penn State\'s on-campus health center. Offers primary care, mental health counseling, immunization services, and the Dental Clinic for enrolled students.',
          url:         'https://studentaffairs.psu.edu/health',
        },
        {
          id:          'psu-it',
          title:       'IT Help Desk',
          tag:         'IT',
          description: 'Submit IT support tickets, manage your Penn State Access Account, configure GlobalProtect VPN, and download Microsoft 365 and other licensed software at no cost to students. Offers walk-in support through multiple campus locations.',
          url:         'https://it.psu.edu',
        },
        {
          id:          'psu-housing',
          title:       'University Housing',
          tag:         'Housing',
          description: 'Apply for on-campus residence hall and apartment housing, manage room assignments, and submit maintenance requests through Penn State University Housing. Manage your housing portal and roommate preferences online.',
          url:         'https://housing.psu.edu',
        },
        {
          id:          'psu-student-aid',
          title:       'Student Aid',
          tag:         'Finance',
          description: 'View and manage your financial aid award package, monitor scholarship eligibility requirements, set up direct deposit for refunds, and access tuition billing statements through Penn State Student Aid.',
          url:         'https://studentaid.psu.edu',
        },
        {
          id:          'psu-transportation',
          title:       'Transportation Services',
          tag:         'Transit',
          description: 'Purchase and manage campus parking permits, view Centre Area Transportation Authority bus schedules, and access bicycle registration for the Penn State campus. CATA Loop bus service is free for all enrolled students.',
          url:         'https://transportation.psu.edu',
        },
      ],
    },

  ],
}
