import type { UniversityConfig } from './index'

export const UT_AUSTIN: UniversityConfig = {
  id:           'ut-austin',
  name:         'University of Texas at Austin',
  shortName:    'UT Austin',
  location:     'Austin, TX',
  gpaScale:     '4.0',
  currencyName: 'Dine In Dollars',

  categories: [

    // ── ACADEMICS & REGISTRATION ─────────────────────────────
    {
      id:    'academics',
      label: 'Academics & Registration',
      tab:   'academics',
      links: [
        {
          id:          'ut-my-ut',
          title:       'My UT Student Portal',
          tag:         'Portal',
          description: 'Central hub for registration, academic records, financial aid, and degree audit. Log in with your UT EID.',
          url:         'https://my.utexas.edu',
        },
        {
          id:          'ut-canvas',
          title:       'Canvas LMS',
          tag:         'LMS',
          description: 'Course content, assignment submissions, grades, and instructor communications across all enrolled UT courses.',
          url:         'https://utexas.instructure.com',
        },
        {
          id:          'ut-registrar',
          title:       'Course Registration',
          tag:         'Registration',
          description: 'Search course sections by semester, browse unique numbers, and add courses to your shopping cart before registration opens.',
          url:         'https://registrar.utexas.edu/students/registration',
        },
        {
          id:          'ut-library',
          title:       'UT Libraries',
          tag:         'Library',
          description: 'Perry-Castañeda Library digital collections, research databases, citation tools, and 24/7 research help chat.',
          url:         'https://lib.utexas.edu',
        },
        {
          id:          'ut-degree-audit',
          title:       'Degree Audit (DARS)',
          tag:         'Planning',
          description: 'Run a degree audit to see satisfied requirements, remaining credits, and how transfer credits apply to your plan.',
          url:         'https://utdirect.utexas.edu/apps/degree/audits/nlogon/',
        },
        {
          id:          'ut-professor',
          title:       'UT Rate My Professor',
          tag:         'Reviews',
          description: 'Student course evaluations and professor ratings specific to UT Austin departments before building your schedule.',
          url:         'https://www.ratemyprofessors.com/school/1255',
        },
        {
          id:          'ut-academic-calendar',
          title:       'Academic Calendar',
          tag:         'Calendar',
          description: 'Official UT semester timeline: class start/end dates, registration windows, finals schedule, and university closures.',
          url:         'https://registrar.utexas.edu/calendars/academic',
        },
        {
          id:          'ut-gradescope',
          title:       'Gradescope',
          tag:         'Grading',
          description: 'Submit coursework, view annotated feedback, and track grades across all UT courses that use Gradescope for assignment and exam management.',
          url:         'https://www.gradescope.com',
        },
        {
          id:          'ut-quest',
          title:       'UT Quest Learning Platform',
          tag:         'Homework',
          description: 'UT Austin\'s own online homework and course management platform — used in physics, chemistry, math, and other STEM courses for assignments and exam prep.',
          url:         'https://quest.cns.utexas.edu',
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
          id:          'ut-handshake',
          title:       'Handshake at UT',
          tag:         'Jobs',
          description: 'Official recruiting platform for internships, full-time roles, and on-campus interviews. Thousands of Longhorn-exclusive postings.',
          url:         'https://utexas.joinhandshake.com',
        },
        {
          id:          'ut-career-center',
          title:       'University Career Center',
          tag:         'Career',
          description: 'Career coaching, resume critiques, and Longhorn professional development workshops and networking events.',
          url:         'https://career.utexas.edu',
        },
        {
          id:          'ut-alumni',
          title:       'Texas Exes Alumni Network',
          tag:         'Network',
          description: 'Connect with UT graduates across industries for mentorship and referrals via one of the nation\'s largest alumni networks.',
          url:         'https://www.texasexes.org',
        },
        {
          id:          'ut-ic2',
          title:       'IC² Institute',
          tag:         'Innovation',
          description: 'UT Austin\'s entrepreneurship and innovation research institute — startup resources, commercialization support, and tech transfer programs.',
          url:         'https://ic2.utexas.edu',
        },
        {
          id:          'ut-law-career',
          title:       'Longhorn Career Fairs',
          tag:         'Fairs',
          description: 'Semester career fair schedule for engineering, business, liberal arts, and STEM disciplines. Hosted by UT Career Center.',
          url:         'https://career.utexas.edu/fairs',
        },
        {
          id:          'ut-glassdoor',
          title:       'Glassdoor',
          tag:         'Research',
          description: 'Employer reviews, interview question archives, and salary data across industries. Key research tool for UT students before applying to Austin\'s tech, energy, and government employers.',
          url:         'https://www.glassdoor.com',
        },
        {
          id:          'ut-levels',
          title:       'Levels.fyi — Compensation Data',
          tag:         'Compensation',
          description: 'Crowdsourced total compensation data at major tech companies by level, role, and location. Essential reference for CS and engineering students before their first offer negotiation.',
          url:         'https://www.levels.fyi',
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
          id:          'ut-student-gov',
          title:       'Student Government',
          tag:         'Orgs',
          description: 'Student org listings, Student Government positions, and how your student service fees are allocated.',
          url:         'https://utsg.utexas.edu',
        },
        {
          id:          'ut-dining',
          title:       'UT Dining',
          tag:         'Dining',
          description: 'Dining hall menus, hours, Bevo Bucks balances, and nutritional info at all campus dining locations and food trucks.',
          url:         'https://dineoncampus.com/utexas',
        },
        {
          id:          'ut-rec',
          title:       'Gregory Gym & RecSports',
          tag:         'Wellness',
          description: 'Fitness facility hours, group fitness classes, court reservations, and intramural sports leagues.',
          url:         'https://recsports.utexas.edu',
        },
        {
          id:          'ut-cap-metro',
          title:       'CapMetro U-Pass',
          tag:         'Transit',
          description: 'Use your UT ID as a transit pass on all Capital Metro buses and trains in Austin — unlimited free rides included in tuition.',
          url:         'https://www.capmetro.org/upass',
        },
        {
          id:          'ut-what-is-on',
          title:       'Campus Events',
          tag:         'Events',
          description: 'What\'s On UT — discover lectures, concerts, performances, career fairs, and cultural events across all colleges.',
          url:         'https://austin.utexas.edu/whats-on',
        },
        {
          id:          'ut-athletics',
          title:       'Texas Longhorns Athletics',
          tag:         'Athletics',
          description: 'Student ticket portal for football at DKR, basketball at Moody, and all 20 Longhorn varsity sports. Student section allocation, gameday schedules, and spirit events.',
          url:         'https://texassports.com',
        },
        {
          id:          'ut-pcl',
          title:       'Perry-Castañeda Library (PCL)',
          tag:         'Study',
          description: 'UT\'s main research library — 24/7 study floors, private study room reservations, and access to 10 million+ print and digital volumes.',
          url:         'https://lib.utexas.edu/pcl',
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
          id:          'ut-health',
          title:       'UT Health Services',
          tag:         'Health',
          description: 'Schedule appointments at University Health Services, access mental health counseling, and manage student health insurance.',
          url:         'https://healthyhorns.utexas.edu',
        },
        {
          id:          'ut-it',
          title:       'UT IT Services',
          tag:         'IT',
          description: 'IT help desk, UT VPN, NetID/EID management, licensed Microsoft and Adobe software, and two-factor authentication setup.',
          url:         'https://it.utexas.edu',
        },
        {
          id:          'ut-financial-aid',
          title:       'Office of Financial Aid',
          tag:         'Finance',
          description: 'FAFSA management, scholarship awards, tuition payment plans, and direct deposit setup for aid refunds.',
          url:         'https://finaid.utexas.edu',
        },
        {
          id:          'ut-housing',
          title:       'University Housing',
          tag:         'Housing',
          description: 'Apply for on-campus residence halls, manage room assignments, and access dining and housing contract details.',
          url:         'https://housing.utexas.edu',
        },
        {
          id:          'ut-parking',
          title:       'Parking & Transportation',
          tag:         'Parking',
          description: 'Purchase parking permits, view campus garage locations, report a stolen bike, and access the UT shuttle schedule.',
          url:         'https://parking.utexas.edu',
        },
        {
          id:          'ut-bikes',
          title:       'UT Bike Share & Racks',
          tag:         'Bikes',
          description: 'Bike-friendly campus map, Bike Share Austin docking stations, secure bike storage locations near dorms and classrooms, and bicycle registration.',
          url:         'https://parking.utexas.edu/transportation/bike',
        },
        {
          id:          'ut-bookstore',
          title:       'University Co-op',
          tag:         'Textbooks',
          description: 'Official UT Austin bookstore for textbook purchases and rentals, course reserves, and Longhorn merchandise. Store credit accepted with Bevo Bucks.',
          url:         'https://www.universitycoop.com',
        },
      ],
    },

  ],
}
