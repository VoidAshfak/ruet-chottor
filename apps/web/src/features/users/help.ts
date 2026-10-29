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
