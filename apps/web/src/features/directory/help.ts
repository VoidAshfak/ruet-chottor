import type { Role } from '@ruet-chottor/shared';

// All guidance text for the contact directory (CLAUDE.md §8). Keep it short and plain.
export const help = {
  page: {
    title: 'Directory',
    description:
      'Find RUET students, alumni and teachers, and reach the ones who share their contact details.',
  },
  fields: {
    search: 'Name or roll',
    searchPlaceholder: 'e.g. Rahman or 1703',
    department: 'Department',
    series: 'Series',
    role: 'Role',
    any: 'Any',
    clear: 'Clear filters',
  },
  roles: {
    student: 'Student',
    alumni: 'Alumni',
    teacher: 'Teacher',
    club_manager: 'Club manager',
    moderator: 'Moderator',
    admin: 'Admin',
  } satisfies Record<Role, string>,
  results: {
    count: (n: number, more: boolean) =>
      more ? `${n}+ members` : n === 1 ? '1 member' : `${n} members`,
    loadMore: 'Show more',
    loadingMore: 'Loading…',
    loading: 'Searching…',
    empty: 'No members match. Try a shorter name, or clear a filter.',
    error: 'Could not load the directory.',
    retry: 'Try again',
    contactHidden: 'Contact details not shared',
    contactTipLabel: 'About contact details',
  },
  loginNeeded: 'Log in to search the directory.',
  login: 'Log in',
  tips: {
    search:
      'Type part of a name, or the first digits of a roll. "1703" finds everyone whose roll starts with 1703.',
    department: 'Worked out from each roll: the 3rd and 4th digits are the department code.',
    series:
      'The admission year, from the first two digits of a roll. 2017 means rolls starting with 17.',
    contact:
      'Only members who chose to share their email or phone show them here. Change yours on My profile.',
  },
  intro: [
    {
      title: 'Find people',
      body: 'Search by name or roll, or narrow down by department, series and role.',
    },
    {
      title: 'Contact details are opt-in',
      body: 'You see an email or phone only if that member chose to share it on their profile.',
    },
    {
      title: 'Share yours if you like',
      body: 'Hidden by default. Turn it on in My profile so classmates can reach you.',
    },
  ],
} as const;
