import type { UniversityConfig } from './index'

export const GEORGIA_TECH: UniversityConfig = {
  id:           'georgia-tech',
  name:         'Georgia Institute of Technology',
  shortName:    'Georgia Tech',
  location:     'Atlanta, GA',
  gpaScale:     '4.0',
  currencyName: 'BuzzCard Dining Dollars',

  categories: [

    // ── ACADEMICS & REGISTRATION ─────────────────────────────
    {
      id:    'academics',
      label: 'Academics & Registration',
      tab:   'academics',
      links: [
        {
          id:          'gt-oscar',
          title:       'OSCAR Portal',
          tag:         'Portal',
          description: 'Georgia Tech\'s Online Student Computer Assisted Registration system for course registration, grade viewing, and academic record management. The primary portal for all registration transactions and enrollment verification.',
          url:         'https://oscar.gatech.edu',
        },
        {
          id:          'gt-canvas',
          title:       'Canvas LMS',
          tag:         'LMS',
          description: 'Course materials, assignments, quizzes, discussion boards, and grades for all enrolled Georgia Tech courses. Integrates with Zoom, Gradescope, and Piazza for a unified academic workflow.',
          url:         'https://canvas.gatech.edu',
        },
        {
          id:          'gt-registrar',
          title:       'Registrar',
          tag:         'Admin',
          description: 'Request official transcripts, enrollment verification letters, and manage academic records through Georgia Tech\'s Registrar office. Also handles grade appeals, course withdrawals, and diploma ordering.',
          url:         'https://registrar.gatech.edu',
        },
        {
          id:          'gt-library',
          title:       'Georgia Tech Library',
          tag:         'Library',
          description: 'Access Georgia Tech\'s research library collections including digital databases, engineering and science journals, research consultations, and interlibrary loan services through the Price Gilbert and Crosland Tower libraries.',
          url:         'https://library.gatech.edu',
        },
        {
          id:          'gt-degreeworks',
          title:       'DegreeWorks Degree Audit',
          tag:         'Planning',
          description: 'Review completed and remaining degree requirements for your major and minor with Georgia Tech\'s DegreeWorks audit system. Plan future semesters and identify gaps in your academic progress toward graduation.',
          url:         'https://degreeworks.gatech.edu',
        },
        {
          id:          'gt-academic-calendar',
          title:       'Academic Calendar',
          tag:         'Calendar',
          description: 'Semester key dates including first and last days of classes, registration periods, withdrawal deadlines, final exam schedules, and university holidays. Georgia Tech operates on a semester system with optional summer sessions.',
          url:         'https://registrar.gatech.edu/calendar',
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
          id:          'gt-career-center',
          title:       'Career Center',
          tag:         'Career',
          description: 'Georgia Tech\'s Career Center provides resume reviews, mock technical interviews, career coaching, and employer connections for engineering, computing, business, and liberal arts students. Hosts one of the largest college career fairs in the nation each semester.',
          url:         'https://career.gatech.edu',
        },
        {
          id:          'gt-handshake',
          title:       'Handshake at Georgia Tech',
          tag:         'Jobs',
          description: 'Georgia Tech\'s institutional Handshake platform for internship and full-time job postings, on-campus interview scheduling, and career fair registration. Connect directly with tech, engineering, and consulting employers who actively recruit at GT.',
          url:         'https://gatech.joinhandshake.com',
        },
        {
          id:          'gt-linkedin-learning',
          title:       'LinkedIn Learning',
          tag:         'Skills',
          description: 'Free access to thousands of professional development video courses including programming, data science, business, and design disciplines through Georgia Tech\'s institutional LinkedIn Learning license. Certificates can be shared directly on your LinkedIn profile.',
          url:         'https://linkedin.com/learning',
        },
        {
          id:          'gt-techworks',
          title:       'TechWorks Jobs & Internships',
          tag:         'Jobs',
          description: 'Georgia Tech Career Center\'s curated job and internship board featuring postings from technology, engineering, and business employers who specifically recruit Yellow Jackets. Search full-time, co-op, and internship opportunities by industry and location.',
          url:         'https://career.gatech.edu/students/jobs-internships',
        },
        {
          id:          'gt-career-fairs',
          title:       'GT Career Fair Schedule',
          tag:         'Events',
          description: 'Full schedule of Georgia Tech career fairs, technical networking nights, and employer information sessions. Includes the flagship Fall and Spring Career Fairs attracting hundreds of companies across tech, aerospace, finance, and consulting sectors.',
          url:         'https://career.gatech.edu/events',
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
          id:          'gt-recreation',
          title:       'Campus Recreation',
          tag:         'Wellness',
          description: 'Georgia Tech\'s Campus Recreation Center and the Stamps Recreation Center offer fitness equipment, group fitness classes, pools, climbing walls, and intramural and club sport registration. Student activity fees cover access to all recreational facilities.',
          url:         'https://recreation.gatech.edu',
        },
        {
          id:          'gt-student-center',
          title:       'Student Center',
          tag:         'Union',
          description: 'Georgia Tech\'s Student Center features dining options, a movie theater, student organization offices, event spaces, and the GT Bookstore. The hub of non-academic student life and campus social programming.',
          url:         'https://studentcenter.gatech.edu',
        },
        {
          id:          'gt-dining',
          title:       'GT Dining',
          tag:         'Dining',
          description: 'Dining hall menus, hours, meal plan balances, allergen information, and campus food venue locations across Georgia Tech. Manage your BuzzCard Dining Dollars account and review nutritional details for all dining hall menu items.',
          url:         'https://dining.gatech.edu',
        },
        {
          id:          'gt-sac',
          title:       'Student Activities',
          tag:         'Orgs',
          description: 'Browse and join from over 500 registered Georgia Tech student organizations through the Student Activities office, including academic clubs, cultural groups, Greek life, and maker and robotics organizations. Managed through the Student Activities and Involvement Center.',
          url:         'https://sac.gatech.edu',
        },
        {
          id:          'gt-events',
          title:       'GT Events Calendar',
          tag:         'Events',
          description: 'Comprehensive Georgia Tech events calendar listing lectures, cultural performances, athletic events, student organization activities, and Atlanta-area programming throughout the academic year.',
          url:         'https://calendar.gatech.edu',
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
          id:          'gt-health',
          title:       'Stamps Health Services',
          tag:         'Health',
          description: 'Schedule medical, counseling, and wellness appointments at Georgia Tech\'s Robert C. Williams Stamps Health Services center. Offers primary care, mental health counseling, physical therapy, and immunization management for all enrolled students.',
          url:         'https://health.gatech.edu',
        },
        {
          id:          'gt-oit',
          title:       'OIT Help Desk',
          tag:         'IT',
          description: 'Submit IT support tickets, manage your Georgia Tech account, configure VPN, and download licensed Microsoft 365 and Adobe Creative Cloud software at no cost to students. The OIT Help Desk offers phone, chat, and in-person support options.',
          url:         'https://support.cc.gatech.edu',
        },
        {
          id:          'gt-housing',
          title:       'GT Housing',
          tag:         'Housing',
          description: 'Apply for on-campus residence hall and apartment housing, manage room assignments, and submit maintenance requests through Georgia Tech Housing. Freshmen are required to live on campus and are guaranteed on-campus housing.',
          url:         'https://housing.gatech.edu',
        },
        {
          id:          'gt-financial-aid',
          title:       'Office of Scholarships & Financial Aid',
          tag:         'Finance',
          description: 'View and manage your financial aid award package, monitor HOPE and Zell Miller scholarship requirements, set up direct deposit for refunds, and access tuition billing statements through the Georgia Tech financial aid office.',
          url:         'https://finaid.gatech.edu',
        },
        {
          id:          'gt-parking',
          title:       'Parking & Transportation Services',
          tag:         'Transit',
          description: 'Purchase and manage campus parking permits, view Georgia Tech Stinger bus routes, and access Clipper card information for MARTA transit. The GT Stinger bus system provides free on-campus and surrounding area service for all enrolled students.',
          url:         'https://pts.gatech.edu',
        },
      ],
    },

  ],
}
