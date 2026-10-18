// Centralized Mock Data Store for JobbyHop
// Used to simulate backend data persistence via localStorage

const STORAGE_KEYS = {
  USERS: 'jobbyhop_mock_users',
  JOBS: 'jobbyhop_mock_jobs',
  APPLICATIONS: 'jobbyhop_mock_applications',
  ASSIGNMENTS: 'jobbyhop_mock_assignments',
  ATTENDANCE: 'jobbyhop_mock_attendance',
  PAYMENTS: 'jobbyhop_mock_payments',
  NOTIFICATIONS: 'jobbyhop_mock_notifications',
  CANCELLATIONS: 'jobbyhop_mock_cancellations',
  AUDIT_LOGS: 'jobbyhop_mock_audit_logs',
};

// Initial Default Mock Data
const DEFAULT_USERS = [
  {
    _id: 'usr_admin_1',
    email: 'supportjobbyhop@gmail.com',
    password: 'admin123',
    role: 'ADMIN',
    profile: {
      fullName: 'Chief Operations Admin',
      phone: '+91 9214535240',
      location: 'jaipur, India',
    },
    status: 'ACTIVE',
    createdAt: '2026-01-01T10:00:00.000Z',
  },
  {
    _id: 'usr_recruiter_1',
    email: 'recruiter1@eventco.com',
    password: 'password123',
    role: 'RECRUITER',
    profile: {
      fullName: 'Aarav Sharma',
      companyName: 'Grand Celebrations Ltd',
      companyDescription: 'Premier luxury wedding and corporate event management firm in Mumbai & Goa.',
      phone: '+91 98200 11223',
      location: 'Mumbai, India',
      logo: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=150',
    },
    status: 'ACTIVE',
    createdAt: '2026-01-10T12:00:00.000Z',
  },
  {
    _id: 'usr_recruiter_2',
    email: 'recruiter2@luxuryevents.com',
    password: 'password123',
    role: 'RECRUITER',
    profile: {
      fullName: 'Priya Verma',
      companyName: 'Apex Concert Productions',
      companyDescription: 'Large scale music festival and stadium concert coordinators.',
      phone: '+91 98333 44556',
      location: 'Delhi NCR, India',
      logo: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=150',
    },
    status: 'ACTIVE',
    createdAt: '2026-01-15T09:30:00.000Z',
  },
  {
    _id: 'usr_worker_1',
    email: 'worker1@jobbyhop.com',
    password: 'password123',
    role: 'WORKER',
    profile: {
      fullName: 'Rohan Mehta',
      profilePhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      location: 'Mumbai, India',
      dateOfBirth: '2000-05-14',
      phone: '+91 97111 22334',
      email: 'worker1@jobbyhop.com',
      skills: ['VIP Hospitality', 'Ushering', 'Ticket Scanning', 'Guest Concierge'],
      experience: '3 years in high-profile luxury corporate galas & award shows.',
      previousEventExperience: 'Tech Summit 2025, Filmfare Awards Host, Sunburn Goa Usher.',
      preferredEventTypes: ['Corporate Function', 'Concert', 'Wedding'],
      availability: {
        isAvailable: true,
        availableDates: ['2026-09-25', '2026-09-28', '2026-10-02', '2026-10-05'],
        unavailableDates: ['2026-09-30'],
        availableTimeSlots: ['09:00 - 17:00', '16:00 - 00:00'],
      },
      rating: 4.9,
      totalAssignments: 14,
    },
    status: 'ACTIVE',
    createdAt: '2026-01-12T14:20:00.000Z',
  },
  {
    _id: 'usr_worker_2',
    email: 'worker2@jobbyhop.com',
    password: 'password123',
    role: 'WORKER',
    profile: {
      fullName: 'Ananya Kapoor',
      profilePhoto: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
      location: 'Mumbai, India',
      dateOfBirth: '2001-08-22',
      phone: '+91 97222 33445',
      email: 'worker2@jobbyhop.com',
      skills: ['Registration Desk', 'Anchor / Hostess', 'Crowd Management'],
      experience: '2 years managing luxury brand popups & product launches.',
      previousEventExperience: 'Lakme Fashion Week Usher, BMW Launch Hostess.',
      preferredEventTypes: ['Exhibition', 'Wedding', 'Corporate Function'],
      availability: {
        isAvailable: true,
        availableDates: ['2026-09-25', '2026-09-26', '2026-10-01'],
        unavailableDates: [],
        availableTimeSlots: ['10:00 - 18:00'],
      },
      rating: 4.8,
      totalAssignments: 9,
    },
    status: 'ACTIVE',
    createdAt: '2026-01-14T11:00:00.000Z',
  },
  {
    _id: 'usr_worker_3',
    email: 'worker3@jobbyhop.com',
    password: 'password123',
    role: 'WORKER',
    profile: {
      fullName: 'Vikram Singh',
      profilePhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      location: 'Bengaluru, India',
      dateOfBirth: '1999-11-03',
      phone: '+91 98888 77665',
      email: 'worker3@jobbyhop.com',
      skills: ['Security Management', 'Stage Setup Support', 'Logistics'],
      experience: '4 years stage security & artist escort duty.',
      previousEventExperience: 'Lollapalooza India, Royal Wedding Udaipur.',
      preferredEventTypes: ['Concert', 'College Fest', 'Exhibition'],
      availability: {
        isAvailable: true,
        availableDates: ['2026-09-27', '2026-09-28'],
        unavailableDates: [],
        availableTimeSlots: ['14:00 - 23:00'],
      },
      rating: 5.0,
      totalAssignments: 22,
    },
    status: 'ACTIVE',
    createdAt: '2026-01-05T08:00:00.000Z',
  },
];

const DEFAULT_JOBS = [
  {
    _id: 'job_101',
    recruiterId: 'usr_recruiter_1',
    recruiterName: 'Grand Celebrations Ltd',
    title: 'Luxury Royal Wedding Hospitality Hostesses',
    description: 'Looking for 5 professional guest relations hostesses for a high-profile destination wedding reception in Taj Lands End, Bandra.',
    eventType: 'Wedding',
    eventDate: '2026-09-28',
    startTime: '16:00',
    endTime: '00:00',
    location: 'Taj Lands End, Bandra West, Mumbai',
    workersRequired: 5,
    assignedWorkersCount: 2,
    requiredSkills: ['VIP Hospitality', 'Guest Concierge', 'English & Hindi Fluency'],
    workerRequirements: 'Formal dark ethnic/western attire required. Punctuality is paramount.',
    responsibilities: 'Greet VIP guests, escort to reserved seating, coordinate gifts desk.',
    recruiterProposedPayment: 2000,
    adminApprovedPayment: 1800,
    additionalInstructions: 'Report to Admin desk 30 mins prior to start time.',
    status: 'APPROVED',
    createdAt: '2026-09-10T10:00:00.000Z',
    adminNotes: 'Payment verified and standardized from ₹2000 to ₹1800 per shift based on regional standards.',
  },
  {
    _id: 'job_102',
    recruiterId: 'usr_recruiter_2',
    recruiterName: 'Apex Concert Productions',
    title: 'Stadium Concert Access & Ushering Crew',
    description: 'Require 10 energetic concert ushers and ticket scanners for international DJ live tour.',
    eventType: 'Concert',
    eventDate: '2026-10-05',
    startTime: '15:00',
    endTime: '23:00',
    location: 'Jawaharlal Nehru Stadium, New Delhi',
    workersRequired: 10,
    assignedWorkersCount: 1,
    requiredSkills: ['Ticket Scanning', 'Crowd Management'],
    workerRequirements: 'Black t-shirt, jeans, comfortable sneakers.',
    responsibilities: 'Gate ticket scanning, VIP lounge access control, crowd guiding.',
    recruiterProposedPayment: 1500,
    adminApprovedPayment: 1500,
    additionalInstructions: 'Dinner provided on venue.',
    status: 'APPROVED',
    createdAt: '2026-09-12T14:00:00.000Z',
    adminNotes: 'Approved as submitted.',
  },
  {
    _id: 'job_103',
    recruiterId: 'usr_recruiter_1',
    recruiterName: 'Grand Celebrations Ltd',
    title: 'Global Tech Summit Registration Desk Executive',
    description: '4 registration staff members needed for checking in 1500 corporate delegates.',
    eventType: 'Corporate Function',
    eventDate: '2026-09-25',
    startTime: '08:00',
    endTime: '17:00',
    location: 'Jio World Convention Centre, BKC, Mumbai',
    workersRequired: 4,
    assignedWorkersCount: 0,
    requiredSkills: ['Registration Desk', 'Laptop/iPad Handling', 'Communication'],
    workerRequirements: 'Formal business wear.',
    responsibilities: 'Issue QR badges, hand out delegate kits, answer schedule queries.',
    recruiterProposedPayment: 1600,
    adminApprovedPayment: 1400,
    additionalInstructions: 'Report at 07:30 AM sharp.',
    status: 'PENDING_REVIEW',
    createdAt: '2026-09-16T11:20:00.000Z',
    adminNotes: '',
  },
  {
    _id: 'job_104',
    recruiterId: 'usr_recruiter_2',
    recruiterName: 'Apex Concert Productions',
    title: 'Luxury Car Launch Event Brand Ambassadors',
    description: 'Event staff for interactive product demonstration and VIP lounge host.',
    eventType: 'Exhibition',
    eventDate: '2026-09-15',
    startTime: '11:00',
    endTime: '19:00',
    location: 'St. Regis Hotel, Lower Parel, Mumbai',
    workersRequired: 3,
    assignedWorkersCount: 3,
    requiredSkills: ['Anchor / Hostess', 'VIP Hospitality'],
    workerRequirements: 'Black formal suit.',
    responsibilities: 'Assist guests with car feature demos.',
    recruiterProposedPayment: 2200,
    adminApprovedPayment: 2000,
    additionalInstructions: 'Completed successfully.',
    status: 'COMPLETED',
    createdAt: '2026-09-01T09:00:00.000Z',
    adminNotes: 'Event completed on Sep 15.',
  },
];

const DEFAULT_APPLICATIONS = [
  {
    _id: 'app_201',
    jobId: 'job_101',
    jobTitle: 'Luxury Royal Wedding Hospitality Hostesses',
    workerId: 'usr_worker_1',
    workerProfile: DEFAULT_USERS[3].profile,
    status: 'APPROVED',
    appliedDate: '2026-09-11T12:30:00.000Z',
    adminNotes: 'Approved and assigned by Admin.',
  },
  {
    _id: 'app_202',
    jobId: 'job_101',
    jobTitle: 'Luxury Royal Wedding Hospitality Hostesses',
    workerId: 'usr_worker_2',
    workerProfile: DEFAULT_USERS[4].profile,
    status: 'APPROVED',
    appliedDate: '2026-09-11T14:10:00.000Z',
    adminNotes: 'Approved and assigned by Admin.',
  },
  {
    _id: 'app_203',
    jobId: 'job_102',
    jobTitle: 'Stadium Concert Access & Ushering Crew',
    workerId: 'usr_worker_3',
    workerProfile: DEFAULT_USERS[5].profile,
    status: 'APPROVED',
    appliedDate: '2026-09-13T10:00:00.000Z',
    adminNotes: 'Approved and assigned.',
  },
  {
    _id: 'app_204',
    jobId: 'job_104',
    jobTitle: 'Luxury Car Launch Event Brand Ambassadors',
    workerId: 'usr_worker_1',
    workerProfile: DEFAULT_USERS[3].profile,
    status: 'APPROVED',
    appliedDate: '2026-09-02T15:00:00.000Z',
    adminNotes: 'Completed event.',
  },
];

const DEFAULT_ASSIGNMENTS = [
  {
    _id: 'asg_301',
    jobId: 'job_101',
    jobTitle: 'Luxury Royal Wedding Hospitality Hostesses',
    eventDate: '2026-09-28',
    startTime: '16:00',
    endTime: '00:00',
    location: 'Taj Lands End, Bandra West, Mumbai',
    workerId: 'usr_worker_1',
    workerProfile: DEFAULT_USERS[3].profile,
    finalApprovedPayment: 1800,
    status: 'ASSIGNED',
    assignedAt: '2026-09-12T10:00:00.000Z',
  },
  {
    _id: 'asg_302',
    jobId: 'job_101',
    jobTitle: 'Luxury Royal Wedding Hospitality Hostesses',
    eventDate: '2026-09-28',
    startTime: '16:00',
    endTime: '00:00',
    location: 'Taj Lands End, Bandra West, Mumbai',
    workerId: 'usr_worker_2',
    workerProfile: DEFAULT_USERS[4].profile,
    finalApprovedPayment: 1800,
    status: 'ASSIGNED',
    assignedAt: '2026-09-12T11:00:00.000Z',
  },
  {
    _id: 'asg_303',
    jobId: 'job_104',
    jobTitle: 'Luxury Car Launch Event Brand Ambassadors',
    eventDate: '2026-09-15',
    startTime: '11:00',
    endTime: '19:00',
    location: 'St. Regis Hotel, Lower Parel, Mumbai',
    workerId: 'usr_worker_1',
    workerProfile: DEFAULT_USERS[3].profile,
    finalApprovedPayment: 2000,
    status: 'COMPLETED',
    assignedAt: '2026-09-03T10:00:00.000Z',
  },
];

const DEFAULT_ATTENDANCE = [
  {
    _id: 'att_401',
    jobId: 'job_104',
    jobTitle: 'Luxury Car Launch Event Brand Ambassadors',
    assignmentId: 'asg_303',
    workerId: 'usr_worker_1',
    workerProfile: DEFAULT_USERS[3].profile,
    eventDate: '2026-09-15',
    status: 'PRESENT',
    checkInTime: '10:45 AM',
    checkOutTime: '07:15 PM',
    notes: 'Reported early, immaculate uniform and excellent delegate reviews.',
    createdAt: '2026-09-15T19:30:00.000Z',
  },
];

const DEFAULT_PAYMENTS = [
  {
    _id: 'pay_501',
    jobId: 'job_104',
    jobTitle: 'Luxury Car Launch Event Brand Ambassadors',
    workerId: 'usr_worker_1',
    workerProfile: DEFAULT_USERS[3].profile,
    amount: 2000,
    status: 'PROCESSING', // PENDING -> PROCESSING -> PAID
    eventCompletedDate: '2026-09-15',
    expectedPaymentDate: '2026-09-28', // 10-15 days rule
    transactionRef: 'UPI/20260918/987123',
    adminNotes: 'Attendance verified. Payout initiated under 10–15 day window.',
    createdAt: '2026-09-16T10:00:00.000Z',
  },
  {
    _id: 'pay_502',
    jobId: 'job_099',
    jobTitle: 'Corporate Tech Awards Gala',
    workerId: 'usr_worker_1',
    workerProfile: DEFAULT_USERS[3].profile,
    amount: 1500,
    status: 'PAID',
    eventCompletedDate: '2026-08-25',
    expectedPaymentDate: '2026-09-05',
    paidDate: '2026-09-04',
    transactionRef: 'PAYOUT_BANK_8849102',
    adminNotes: 'Direct bank transfer completed.',
    createdAt: '2026-08-26T10:00:00.000Z',
  },
];

const DEFAULT_NOTIFICATIONS = [
  {
    _id: 'notif_601',
    userId: 'usr_recruiter_1',
    title: 'Job Request Under Admin Review',
    message: 'Your job request "Global Tech Summit Registration Desk Executive" has been submitted to Admin.',
    isRead: false,
    createdAt: new Date().toISOString(),
  },
  {
    _id: 'notif_602',
    userId: 'usr_worker_1',
    title: 'Payment Processing (10–15 Days Timeline)',
    message: 'Your payment of ₹2,000 for "Luxury Car Launch Event Brand Ambassadors" is currently being processed by Admin.',
    isRead: false,
    createdAt: new Date().toISOString(),
  },
  {
    _id: 'notif_603',
    userId: 'usr_admin_1',
    title: 'New Job Request Submitted',
    message: 'Recruiter "Grand Celebrations Ltd" submitted a new job request for review.',
    isRead: false,
    createdAt: new Date().toISOString(),
  },
];

const DEFAULT_CANCELLATIONS = [
  {
    _id: 'canc_701',
    requesterId: 'usr_worker_2',
    requesterRole: 'WORKER',
    requesterName: 'Ananya Kapoor',
    jobId: 'job_101',
    jobTitle: 'Luxury Royal Wedding Hospitality Hostesses',
    reason: 'Medical emergency in the family. Cannot travel to Bandra venue on Sep 28.',
    status: 'REQUESTED',
    createdAt: '2026-09-17T09:00:00.000Z',
  },
];

const DEFAULT_AUDIT_LOGS = [
  {
    _id: 'aud_801',
    performedByUserId: { email: 'supportjobbyhop@gmail.com' },
    performedByRole: 'ADMIN',
    action: 'PAYMENT_ADJUSTMENT',
    entityName: 'Job Request #job_101',
    previousValue: '₹2,000 (Recruiter Proposed)',
    newValue: '₹1,800 (Admin Approved)',
    notes: 'Admin adjusted worker pay to match regional market standards prior to public listing.',
    createdAt: '2026-09-10T10:30:00.000Z',
  },
  {
    _id: 'aud_802',
    performedByUserId: { email: 'supportjobbyhop@gmail.com' },
    performedByRole: 'ADMIN',
    action: 'JOB_APPROVAL',
    entityName: 'Job Request #job_101',
    previousValue: 'PENDING_REVIEW',
    newValue: 'APPROVED',
    notes: 'Job published to Available Jobs for workers.',
    createdAt: '2026-09-10T10:35:00.000Z',
  },
];

// LocalStorage Helper functions
const getStore = (key, defaultData) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(defaultData));
      return defaultData;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse localStorage key:', key, err);
    return defaultData;
  }
};

const setStore = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to set localStorage key:', key, err);
  }
};

export const MockStore = {
  getUsers: () => getStore(STORAGE_KEYS.USERS, DEFAULT_USERS),
  setUsers: (users) => setStore(STORAGE_KEYS.USERS, users),

  getJobs: () => getStore(STORAGE_KEYS.JOBS, DEFAULT_JOBS),
  setJobs: (jobs) => setStore(STORAGE_KEYS.JOBS, jobs),

  getApplications: () => getStore(STORAGE_KEYS.APPLICATIONS, DEFAULT_APPLICATIONS),
  setApplications: (apps) => setStore(STORAGE_KEYS.APPLICATIONS, apps),

  getAssignments: () => getStore(STORAGE_KEYS.ASSIGNMENTS, DEFAULT_ASSIGNMENTS),
  setAssignments: (asgs) => setStore(STORAGE_KEYS.ASSIGNMENTS, asgs),

  getAttendance: () => getStore(STORAGE_KEYS.ATTENDANCE, DEFAULT_ATTENDANCE),
  setAttendance: (att) => setStore(STORAGE_KEYS.ATTENDANCE, att),

  getPayments: () => getStore(STORAGE_KEYS.PAYMENTS, DEFAULT_PAYMENTS),
  setPayments: (pays) => setStore(STORAGE_KEYS.PAYMENTS, pays),

  getNotifications: () => getStore(STORAGE_KEYS.NOTIFICATIONS, DEFAULT_NOTIFICATIONS),
  setNotifications: (notifs) => setStore(STORAGE_KEYS.NOTIFICATIONS, notifs),

  getCancellations: () => getStore(STORAGE_KEYS.CANCELLATIONS, DEFAULT_CANCELLATIONS),
  setCancellations: (canc) => setStore(STORAGE_KEYS.CANCELLATIONS, canc),

  getAuditLogs: () => getStore(STORAGE_KEYS.AUDIT_LOGS, DEFAULT_AUDIT_LOGS),
  setAuditLogs: (logs) => setStore(STORAGE_KEYS.AUDIT_LOGS, logs),

  resetToDefault: () => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(DEFAULT_USERS));
    localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(DEFAULT_JOBS));
    localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(DEFAULT_APPLICATIONS));
    localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(DEFAULT_ASSIGNMENTS));
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(DEFAULT_ATTENDANCE));
    localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(DEFAULT_PAYMENTS));
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(DEFAULT_NOTIFICATIONS));
    localStorage.setItem(STORAGE_KEYS.CANCELLATIONS, JSON.stringify(DEFAULT_CANCELLATIONS));
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(DEFAULT_AUDIT_LOGS));
  },
};

export default MockStore;
