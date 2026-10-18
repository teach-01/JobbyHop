/**
 * JobbyHop Chatbot FAQ Engine
 *
 * Centralized FAQ/rule-based knowledge base.
 * Each entry has:
 *   - id: unique string
 *   - category: top-level category key
 *   - keywords: array of strings used for matching
 *   - question: human-readable question label
 *   - answer: response text (supports \n for newlines)
 *   - roles: array of roles that can see this entry ('ALL', 'WORKER', 'RECRUITER', 'ADMIN')
 *
 * To add/update answers, edit the FAQS array below.
 * The chatbotService.js file processes these entries.
 */

export const FAQ_CATEGORIES = {
  ACCOUNT: 'Account & Profile',
  JOBS: 'Jobs',
  APPLICATIONS: 'Applications',
  ASSIGNMENTS: 'Assignments',
  PAYMENTS: 'Payments',
  RATINGS: 'Ratings',
  LOGIN: 'Login & OTP',
  GENERAL: 'General Help',
  ADMIN: 'Admin & Platform',
};

// Quick-action buttons shown on chatbot open, mapped per role
export const QUICK_ACTIONS = {
  GUEST: [
    { label: 'Account & Profile', category: 'ACCOUNT' },
    { label: 'Jobs', category: 'JOBS' },
    { label: 'Applications', category: 'APPLICATIONS' },
    { label: 'Assignments', category: 'ASSIGNMENTS' },
    { label: 'Payments', category: 'PAYMENTS' },
    { label: 'Ratings', category: 'RATINGS' },
    { label: 'Login & OTP', category: 'LOGIN' },
    { label: 'General Help', category: 'GENERAL' },
  ],
  WORKER: [
    { label: 'Applications', category: 'APPLICATIONS' },
    { label: 'Assignments', category: 'ASSIGNMENTS' },
    { label: 'Payments', category: 'PAYMENTS' },
    { label: 'Ratings', category: 'RATINGS' },
    { label: 'Account & Profile', category: 'ACCOUNT' },
    { label: 'Login & OTP', category: 'LOGIN' },
    { label: 'Jobs', category: 'JOBS' },
    { label: 'General Help', category: 'GENERAL' },
  ],
  RECRUITER: [
    { label: 'Jobs', category: 'JOBS' },
    { label: 'Applications', category: 'APPLICATIONS' },
    { label: 'Assignments', category: 'ASSIGNMENTS' },
    { label: 'Payments', category: 'PAYMENTS' },
    { label: 'Ratings', category: 'RATINGS' },
    { label: 'Account & Profile', category: 'ACCOUNT' },
    { label: 'Login & OTP', category: 'LOGIN' },
    { label: 'General Help', category: 'GENERAL' },
  ],
  ADMIN: [
    { label: 'User Management', category: 'ADMIN' },
    { label: 'Job Approvals', category: 'JOBS' },
    { label: 'Assignments', category: 'ASSIGNMENTS' },
    { label: 'Payments', category: 'PAYMENTS' },
    { label: 'Account & Profile', category: 'ACCOUNT' },
    { label: 'General Help', category: 'GENERAL' },
  ],
  OPERATIONS: [
    { label: 'Assignments', category: 'ASSIGNMENTS' },
    { label: 'Payments', category: 'PAYMENTS' },
    { label: 'Jobs', category: 'JOBS' },
    { label: 'Account & Profile', category: 'ACCOUNT' },
    { label: 'General Help', category: 'GENERAL' },
  ],
};

export const FAQS = [
  // ─────────────────────────────────────────────
  // ACCOUNT & PROFILE
  // ─────────────────────────────────────────────
  {
    id: 'account_create',
    category: 'ACCOUNT',
    keywords: ['create account', 'register', 'sign up', 'new account', 'how to register'],
    question: 'How do I create an account?',
    answer:
      'You can register as a Worker or a Recruiter on JobbyHop.\n\n• To register as a Worker, visit /register/worker and fill in your personal details.\n• To register as a Recruiter (event organiser), visit /register/recruiter.\n\nYou will need to verify your email address before you can log in.',
    roles: ['ALL'],
  },
  {
    id: 'account_update',
    category: 'ACCOUNT',
    keywords: ['update profile', 'edit profile', 'change name', 'change phone', 'profile settings', 'update details'],
    question: 'How do I update my profile?',
    answer:
      'After logging in, navigate to your Profile section from the sidebar or top menu. You can update your name, contact details, profile photo, and other information from there.',
    roles: ['ALL'],
  },
  {
    id: 'account_delete',
    category: 'ACCOUNT',
    keywords: ['delete account', 'remove account', 'close account', 'deactivate'],
    question: 'How do I delete my account?',
    answer:
      'Account deletion is managed by the JobbyHop admin team. Please contact support at supportjobbyhop@gmail.com or call +91 9214535240 to request account deletion.',
    roles: ['ALL'],
  },
  {
    id: 'account_cant_login',
    category: 'ACCOUNT',
    keywords: ["can't login", 'cannot login', 'login problem', 'login issue', 'account blocked', 'account suspended', 'account inactive'],
    question: "Why can't I login?",
    answer:
      'There are a few reasons why you may not be able to log in:\n\n1. Your account may be pending admin approval (especially new recruiter accounts).\n2. Your account may have been deactivated or suspended.\n3. You may be using the wrong email or password.\n4. Your email may not be verified yet.\n\nPlease try resetting your password or contact support if the issue persists.',
    roles: ['ALL'],
  },

  // ─────────────────────────────────────────────
  // JOBS
  // ─────────────────────────────────────────────
  {
    id: 'jobs_find',
    category: 'JOBS',
    keywords: ['find jobs', 'search jobs', 'available jobs', 'browse jobs', 'see jobs', 'job listings', 'view jobs'],
    question: 'How can I find jobs?',
    answer:
      'As a Worker, you can browse available jobs by navigating to "Available Jobs" from your dashboard sidebar. You can search and filter by location, job type, and other criteria to find opportunities that match your skills.',
    roles: ['WORKER', 'GUEST'],
  },
  {
    id: 'jobs_recruiter_create',
    category: 'JOBS',
    keywords: ['create job', 'post job', 'submit job', 'new job', 'add job', 'recruiter job', 'job posting'],
    question: 'How can a recruiter create a job?',
    answer:
      'Logged-in Recruiters can create a new job by clicking "Create Job" from their dashboard. Fill in the job details (title, location, date, required workers, pay details, etc.) and submit it for admin approval.\n\nYour job will become visible to workers only after it is approved by the JobbyHop admin.',
    roles: ['RECRUITER', 'GUEST'],
  },
  {
    id: 'jobs_not_visible',
    category: 'JOBS',
    keywords: ["can't see job", 'job not showing', 'job not visible', 'job disappeared', 'job missing'],
    question: "Why can't I see a job?",
    answer:
      'A job may not be visible to workers for the following reasons:\n\n• It is still pending admin approval.\n• The job has been cancelled or closed.\n• The job date has already passed.\n• The required number of workers has been filled.\n\nIf you believe there is an error, please contact support.',
    roles: ['ALL'],
  },
  {
    id: 'jobs_approval',
    category: 'JOBS',
    keywords: ['job approval', 'approve job', 'job status', 'pending job', 'job review'],
    question: 'How does job approval work?',
    answer:
      'When a Recruiter submits a job, it enters a "Pending" state. The JobbyHop admin team reviews the job details and either approves or rejects it.\n\nApproved jobs become visible to workers. Rejected jobs are returned to the recruiter with a reason.',
    roles: ['ALL'],
  },

  // ─────────────────────────────────────────────
  // APPLICATIONS
  // ─────────────────────────────────────────────
  {
    id: 'applications_apply',
    category: 'APPLICATIONS',
    keywords: ['apply for job', 'how to apply', 'submit application', 'apply now', 'send application'],
    question: 'How can I apply for a job?',
    answer:
      'As a Worker, browse to an available job and click the "Apply" button on the job details page. Make sure your profile is complete before applying, as recruiters and admins review your profile information.',
    roles: ['WORKER', 'GUEST'],
  },
  {
    id: 'applications_check',
    category: 'APPLICATIONS',
    keywords: ['check application', 'my applications', 'application status', 'view applications', 'application list'],
    question: 'How can I check my application?',
    answer:
      'Workers can view all their applications by navigating to "My Applications" from the sidebar. Each application shows its current status:\n\n• Pending – Awaiting review\n• Approved – You have been selected\n• Rejected – Not selected for this role',
    roles: ['WORKER', 'GUEST'],
  },
  {
    id: 'applications_after',
    category: 'APPLICATIONS',
    keywords: ['after applying', 'what happens after apply', 'application review', 'application process', 'next steps'],
    question: 'What happens after applying?',
    answer:
      'After you apply:\n\n1. Your application is reviewed by the Admin or Recruiter.\n2. If approved, you will receive a notification and be assigned to the job.\n3. If not selected, your application will be marked as rejected.\n\nYou will receive notifications for status updates on your application.',
    roles: ['WORKER', 'GUEST'],
  },

  // ─────────────────────────────────────────────
  // ASSIGNMENTS
  // ─────────────────────────────────────────────
  {
    id: 'assignments_how',
    category: 'ASSIGNMENTS',
    keywords: ['how are workers assigned', 'assignment process', 'how assignment works', 'how do i get assigned'],
    question: 'How are workers assigned?',
    answer:
      'Workers are assigned to jobs by the JobbyHop admin or recruiter after reviewing applications. When your application is approved, you receive an assignment for that job with all relevant details (date, location, timing, etc.).',
    roles: ['ALL'],
  },
  {
    id: 'assignments_check',
    category: 'ASSIGNMENTS',
    keywords: ['check assignment', 'my assignments', 'view assignment', 'assignment details', 'assignment list'],
    question: 'How do I check my assignment?',
    answer:
      'Workers can view their current and past assignments from the "My Assignments" section in the sidebar. Each assignment shows the job details, date, location, status, and any relevant instructions.',
    roles: ['WORKER', 'GUEST'],
  },
  {
    id: 'assignments_issue',
    category: 'ASSIGNMENTS',
    keywords: ['assignment issue', 'problem with assignment', 'assignment help', 'issue during event', 'emergency assignment'],
    question: 'What should I do if I have an issue during an assignment?',
    answer:
      'If you experience an issue during an active assignment:\n\n1. Contact your recruiter directly if possible.\n2. Reach out to JobbyHop support via email at supportjobbyhop@gmail.com.\n3. Call the helpline at +91 9214535240.\n\nPlease document any issues for accurate reporting.',
    roles: ['ALL'],
  },

  // ─────────────────────────────────────────────
  // PAYMENTS
  // ─────────────────────────────────────────────
  {
    id: 'payments_how',
    category: 'PAYMENTS',
    keywords: ['how does payment work', 'payment process', 'how am i paid', 'payment method', 'salary', 'wage', 'pay'],
    question: 'How does payment work?',
    answer:
      'Payment is processed by the recruiter through the JobbyHop platform after an assignment is completed. The payment amount is specified in the job listing. Workers receive payment via bank transfer or UPI as agreed in the job posting.',
    roles: ['WORKER', 'GUEST'],
  },
  {
    id: 'payments_view',
    category: 'PAYMENTS',
    keywords: ['see payment', 'view payment', 'check payment', 'payment history', 'my payments'],
    question: 'Where can I see my payment?',
    answer:
      'Workers can view their payment history by navigating to "My Payments" from the sidebar. Each entry shows the job, amount, payment status, and payment date.',
    roles: ['WORKER', 'GUEST'],
  },
  {
    id: 'payments_utr',
    category: 'PAYMENTS',
    keywords: ['utr', 'reference number', 'transaction id', 'payment reference', 'what is utr'],
    question: 'What is a UTR/reference?',
    answer:
      'A UTR (Unique Transaction Reference) is a unique ID generated for each bank or UPI transfer. It is used to verify and track payment transactions. If you receive a payment, your UTR or reference number will appear in your payment details on the platform.',
    roles: ['ALL'],
  },
  {
    id: 'payments_pending',
    category: 'PAYMENTS',
    keywords: ['payment pending', 'payment delayed', 'payment not received', 'payment stuck', 'when will i get paid'],
    question: 'What should I do if payment is pending?',
    answer:
      'If your payment is showing as pending:\n\n1. Check the payment status in "My Payments" for any updates.\n2. Confirm the assignment has been marked as completed.\n3. Contact the recruiter for the job.\n4. If unresolved, reach out to JobbyHop support at supportjobbyhop@gmail.com.',
    roles: ['WORKER', 'GUEST'],
  },

  // ─────────────────────────────────────────────
  // RATINGS
  // ─────────────────────────────────────────────
  {
    id: 'ratings_how',
    category: 'RATINGS',
    keywords: ['how ratings work', 'rating system', 'how is rating calculated', 'star rating', 'review'],
    question: 'How do ratings work?',
    answer:
      'After an assignment is completed, recruiters and workers can rate each other. Ratings help build trust on the platform and influence future opportunities.\n\nYour average rating is visible on your profile.',
    roles: ['ALL'],
  },
  {
    id: 'ratings_can_i_rate',
    category: 'RATINGS',
    keywords: ['can i rate', 'give rating', 'rate user', 'rate recruiter', 'rate worker', 'leave review'],
    question: 'Can I rate another user?',
    answer:
      'Yes. After an assignment is completed:\n\n• Workers can rate the recruiter/job experience.\n• Recruiters can rate the workers they worked with.\n\nRatings are typically submitted from the assignment details view after it is marked as complete.',
    roles: ['ALL'],
  },
  {
    id: 'ratings_change',
    category: 'RATINGS',
    keywords: ['change rating', 'submit rating', 'edit rating', 'update rating', 'rating already submitted'],
    question: 'Can I change/submit a rating?',
    answer:
      'Ratings can generally be submitted once per completed assignment. If you have not submitted a rating yet, go to your completed assignments and look for the rate option. If you need to correct an already-submitted rating, please contact support.',
    roles: ['ALL'],
  },

  // ─────────────────────────────────────────────
  // LOGIN & OTP
  // ─────────────────────────────────────────────
  {
    id: 'login_otp',
    category: 'LOGIN',
    keywords: ['otp not received', "didn't get otp", 'otp missing', 'otp not coming', 'resend otp', 'otp expired', 'verification code'],
    question: "I didn't receive my OTP.",
    answer:
      "If you haven't received your OTP:\n\n1. Check your spam/junk folder.\n2. Wait a minute and try resending the OTP.\n3. Make sure the email address you entered is correct.\n4. If the problem persists, contact support at supportjobbyhop@gmail.com.",
    roles: ['ALL'],
  },
  {
    id: 'login_email_verify',
    category: 'LOGIN',
    keywords: ['verify email', 'email verification', 'email not verified', 'account not verified', 'email confirm'],
    question: 'How do I verify my email?',
    answer:
      'After registration, a verification email is sent to the address you provided. Open the email and click the verification link or enter the OTP code. If you did not receive the verification email, check your spam folder or request a new one from the login page.',
    roles: ['ALL'],
  },
  {
    id: 'login_forgot_password',
    category: 'LOGIN',
    keywords: ['forgot password', 'reset password', 'lost password', "can't remember password", 'change password'],
    question: 'I forgot my password.',
    answer:
      'To reset your password:\n\n1. Go to the Login page and click "Forgot Password".\n2. Enter your registered email address.\n3. Check your email for a password reset link.\n4. Click the link and set a new password.\n\nIf you did not receive the email, check your spam folder or contact support.',
    roles: ['ALL'],
  },

  // ─────────────────────────────────────────────
  // GENERAL
  // ─────────────────────────────────────────────
  {
    id: 'general_what_is',
    category: 'GENERAL',
    keywords: ['what is jobbyhop', 'about jobbyhop', 'what does jobbyhop do', 'explain jobbyhop'],
    question: 'What is JobbyHop?',
    answer:
      'JobbyHop is an event staffing platform that connects event organisers (Recruiters) with event staff (Workers). Recruiters post event-based job opportunities, and Workers can browse and apply for assignments that match their skills and availability.',
    roles: ['ALL'],
  },
  {
    id: 'general_how_works',
    category: 'GENERAL',
    keywords: ['how does jobbyhop work', 'platform overview', 'how it works', 'how to use jobbyhop', 'getting started'],
    question: 'How does JobbyHop work?',
    answer:
      "Here's how JobbyHop works:\n\n1. Recruiters post event staffing jobs.\n2. Jobs are reviewed and approved by the admin.\n3. Workers browse available jobs and submit applications.\n4. Admins/Recruiters review applications and assign workers.\n5. Workers attend the event and complete their assignments.\n6. Payments are processed and ratings are exchanged.",
    roles: ['ALL'],
  },
  {
    id: 'general_contact',
    category: 'GENERAL',
    keywords: ['contact support', 'how to contact', 'get help', 'reach support', 'email support', 'helpline', 'support team', 'customer care'],
    question: 'How do I contact support?',
    answer:
      'You can reach the JobbyHop support team via:\n\n• Email: supportjobbyhop@gmail.com\n• Phone/WhatsApp: +91 9214535240\n• Or use the contact form on the Contact page.\n\nOur support team reviews queries during operational hours.',
    roles: ['ALL'],
  },

  // ─────────────────────────────────────────────
  // ADMIN (restricted to ADMIN role only)
  // ─────────────────────────────────────────────
  {
    id: 'admin_user_mgmt',
    category: 'ADMIN',
    keywords: ['user management', 'manage users', 'admin users', 'worker list', 'recruiter list'],
    question: 'How do I manage users?',
    answer:
      'As an Admin, you can manage all users from the Admin Dashboard. Navigate to "Workers" or "Recruiters" from the admin sidebar to view, search, and manage user accounts.',
    roles: ['ADMIN'],
  },
  {
    id: 'admin_job_approvals',
    category: 'ADMIN',
    keywords: ['approve jobs', 'job requests', 'pending jobs', 'review jobs', 'admin approval'],
    question: 'How do I approve jobs?',
    answer:
      'As an Admin, navigate to "Job Requests" in the admin sidebar. You will see all pending job submissions from recruiters. Review the details and approve or reject each job as appropriate.',
    roles: ['ADMIN'],
  },
  {
    id: 'admin_account_status',
    category: 'ADMIN',
    keywords: ['account status', 'suspend account', 'activate account', 'block user', 'unblock user', 'admin account'],
    question: 'How do I manage account status?',
    answer:
      'Admin users can activate or deactivate recruiter and worker accounts from the Users section of the Admin Dashboard. Select a user and use the status controls to change their account status.',
    roles: ['ADMIN'],
  },
  {
    id: 'admin_audit',
    category: 'ADMIN',
    keywords: ['audit log', 'audit history', 'activity log', 'platform history', 'admin log'],
    question: 'How do I view audit history?',
    answer:
      'The Audit Log is available in the Admin sidebar. It shows a record of key actions taken on the platform, helping admins track changes and maintain accountability.',
    roles: ['ADMIN'],
  },
  {
    id: 'admin_platform',
    category: 'ADMIN',
    keywords: ['platform management', 'admin settings', 'system settings', 'admin controls', 'admin panel'],
    question: 'How do I access platform management?',
    answer:
      'Platform management tools are available in the Admin Dashboard. Use the sidebar to navigate to Settings, Audit Logs, Notifications, and other administrative tools.',
    roles: ['ADMIN'],
  },
];

/**
 * Returns the greeting message shown when chatbot is first opened.
 */
export const GREETING_MESSAGE = {
  id: 'greeting',
  role: 'assistant',
  text: "Hi! 👋 I'm the JobbyHop Assistant.\n\nI can help you with accounts, jobs, applications, assignments, payments, ratings, and general questions.\n\nWhat can I help you with?",
  timestamp: null,
};

/**
 * Fallback message when no FAQ match is found.
 */
export const FALLBACK_ANSWER =
  "I'm not able to find the right answer for that yet.\n\nYou can try asking about:\n• Accounts\n• Jobs\n• Applications\n• Assignments\n• Payments\n• Ratings\n• Login & OTP\n\nOr contact our support team for further assistance.";
