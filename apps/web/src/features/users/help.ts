import type { Role } from '@ruet-chottor/shared';

// All guidance text for profiles (CLAUDE.md §8). Keep it short and plain.
export const help = {
  myProfile: {
    title: 'My profile',
    description: 'See what other members see about you, and choose which contact details to share.',
  },
  profile: {
    title: 'Profile',
    description: 'A RUET Chottor member. Contact details appear only if they chose to share them.',
    notFound: 'This member could not be found. The link may be wrong, or the account was closed.',
  },
  fields: {
    roll: 'Roll',
    role: 'Role',
    department: 'Department',
    series: 'Series',
    email: 'Email',
    phone: 'Phone',
    unknownDepartment: 'Unknown',
    hidden: 'Not shared',
  },
  roles: {
    student: 'Student',
    alumni: 'Alumni',
    teacher: 'Teacher',
    club_manager: 'Club manager',
    moderator: 'Moderator',
    admin: 'Admin',
  } satisfies Record<Role, string>,
  privacy: {
    heading: 'Contact privacy',
    showEmail: 'Show my email to other members',
    showPhone: 'Show my phone number to other members',
    saving: 'Saving…',
    saved: 'Saved.',
  },
  guides: {
    heading: 'Tips',
    reset: 'Show tips again',
    resetting: 'Resetting…',
    done: 'Done. Each section will show its short intro again.',
  },
  classRep: {
    heading: 'Class representative',
    description: 'Are you the CR of your class? Get verified so everyone knows they can trust you.',
    badge: (section: string | null) => (section ? `CR · Section ${section}` : 'CR'),
    badgeLabel: (section: string | null) =>
      section
        ? `Verified class representative, section ${section}`
        : 'Verified class representative',
    forClass: (label: string) => `For your class: ${label}`,
    section: 'Section',
    noSections: 'My class has no sections',
    note: 'How can a moderator check this?',
    notePlaceholder: 'e.g. Chosen by the class on 2 January; our class adviser can confirm.',
    ask: 'Ask to be verified',
    asking: 'Sending…',
    pending: (date: string) => `You asked on ${date}. A moderator will check it soon.`,
    approved: (date: string) => `You are a verified CR since ${date}.`,
    rejected: 'Your last request was not approved.',
    revoked: 'Your CR status has ended.',
    reason: (reason: string) => `Moderator's reason: ${reason}`,
    withdraw: 'Withdraw request',
    stepDown: 'Step down as CR',
    cancel: 'Keep it',
    confirmWithdraw: {
      title: 'Withdraw your request?',
      body: 'A moderator will not check it any more. You can ask again later.',
    },
    confirmStepDown: {
      title: 'Step down as CR?',
      body: 'Your CR badge goes away at once. To become CR again, you will need to ask again.',
    },
    unknownClass:
      'We cannot tell your class from your roll, so you cannot ask yet. Tell a moderator.',
    loadError: 'Could not load your CR status.',
  },
  classRepAdmin: {
    title: 'Class representatives',
    description: 'Check students who say they are their class CR, and manage the current CRs.',
    lists: { pending: 'Waiting', approved: 'Current CRs' },
    listsLabel: 'Which requests to show',
    empty: { pending: 'No requests are waiting.', approved: 'No verified CRs yet.' },
    loading: 'Loading requests',
    error: 'Could not load the requests.',
    retry: 'Try again',
    more: 'Show more',
    loadingMore: 'Loading…',
    asked: (date: string) => `Asked ${date}`,
    since: (date: string) => `CR since ${date}`,
    proof: 'Their proof',
    approve: 'Verify as CR',
    reject: 'Turn down',
    revoke: 'Remove CR status',
    cancel: 'Cancel',
    reason: 'Reason (the student sees this)',
    reasonPlaceholder: 'e.g. Your class adviser did not confirm this.',
    rejectTitle: 'Turn down this request?',
    rejectBody: 'The student sees your reason and can ask again.',
    revokeTitle: 'Remove CR status?',
    revokeBody: 'Their CR badge goes away at once. The student sees your reason.',
    verified: 'Verified.',
  },
  states: {
    loading: 'Loading profile…',
    error: 'Could not load the profile.',
    retry: 'Try again',
    loginNeeded: 'Log in to see profiles.',
    login: 'Log in',
  },
  tips: {
    department:
      'Worked out from your roll: the 3rd and 4th digits are the department code. Wrong? Tell a moderator.',
    series: 'The year you were admitted, from the first two digits of your roll (17 means 2017).',
    showEmail:
      'If on, any logged-in RUET Chottor member can see your email. Off by default. Change it any time.',
    showPhone:
      'If on, any logged-in RUET Chottor member can see your phone number. Off by default. Change it any time.',
    reset: 'Brings back the short intro popup in every section, like on your first visit.',
    classRep:
      'Verified CRs get a badge on their profile and in the directory. A moderator checks each request first.',
    classRepSection:
      'Pick the section you represent. Choose "no sections" if your whole series is one class.',
    classRepNote:
      'Only moderators see this. Say who chose you and who can confirm it, like your class adviser.',
    classRepVerify:
      'Check the proof first, e.g. ask the class adviser or a classmate. The student gets a CR badge.',
  },
  intro: [
    {
      title: 'This is your profile',
      body: 'Other members see your name, roll, department and series. Department and series come from your roll.',
    },
    {
      title: 'You choose what to share',
      body: 'Your email and phone are hidden by default. Turn them on only if you want classmates to reach you.',
    },
    {
      title: 'Your birthday stays private',
      body: 'Your date of birth is never shown to anyone.',
    },
  ],
} as const;
