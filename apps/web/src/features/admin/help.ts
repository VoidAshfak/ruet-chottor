import {
  ADMIN_LIMITS,
  type AccountStatus,
  type ModerationAction,
  type Role,
} from '@ruet-chottor/shared';

// All guidance text for the admin panel (CLAUDE.md §8). Keep it short and plain.
export const help = {
  nav: 'Admin',
  tabs: { members: 'Members', log: 'Moderation log' },
  members: {
    title: 'Admin · Members',
    description: 'Find any member, including suspended and banned ones, and act on their account.',
  },
  member: {
    title: 'Admin · Member',
    description: 'Account status, moderation history and actions for one member.',
    history: 'Moderation history',
    noHistory: 'No moderation actions yet.',
    actions: 'Actions',
    publicProfile: 'View public profile',
    joined: 'Joined',
    suspendedUntil: 'Suspended until',
    notFound: 'This member could not be found.',
  },
  log: {
    title: 'Admin · Moderation log',
    description:
      'Every action moderators and admins have taken, newest first. Entries can never be edited or deleted.',
    empty: 'No moderation actions yet.',
  },
  fields: {
    search: 'Name or roll',
    searchPlaceholder: 'e.g. Rahman or 1703',
    role: 'Role',
    status: 'Status',
    any: 'Any',
    reason: 'Reason',
    reasonPlaceholder: 'What happened? The member will see this.',
    days: 'Days',
    newRole: 'New role',
  },
  roles: {
    student: 'Student',
    alumni: 'Alumni',
    teacher: 'Teacher',
    club_manager: 'Club manager',
    moderator: 'Moderator',
    admin: 'Admin',
  } satisfies Record<Role, string>,
  statuses: {
    active: 'Active',
    suspended: 'Suspended',
    banned: 'Banned',
  } satisfies Record<AccountStatus, string>,
  actionNames: {
    warn_user: 'Warned',
    suspend_user: 'Suspended',
    ban_user: 'Banned',
    reinstate_user: 'Reinstated',
    change_role: 'Role changed',
  } satisfies Record<ModerationAction, string>,
  logLine: {
    by: (name: string) => `by ${name}`,
    unknownPerson: 'a deleted account',
    days: (days: number) => `for ${days} day${days === 1 ? '' : 's'}`,
    role: (from: string, to: string) => `${from} → ${to}`,
  },
  actions: {
    warn: {
      button: 'Warn',
      title: 'Warn this member',
      body: 'The member gets an email with your reason. Their account keeps working.',
      confirm: 'Send warning',
    },
    suspend: {
      button: 'Suspend',
      title: 'Suspend this member',
      body: 'They are logged out everywhere and cannot log in until the time is up.',
      confirm: 'Suspend',
    },
    ban: {
      button: 'Ban',
      title: 'Ban this member',
      body: 'They are logged out everywhere and cannot log in again until someone reinstates them.',
      confirm: 'Ban member',
    },
    reinstate: {
      button: 'Reinstate',
      title: 'Reinstate this member',
      body: 'Ends the suspension or ban now. The member can log in again.',
      confirm: 'Reinstate',
    },
    role: {
      button: 'Change role',
      title: 'Change role',
      body: 'Roles decide what a member can do, e.g. moderators can open this panel.',
      confirm: 'Change role',
    },
    cancel: 'Cancel',
    working: 'Working…',
    done: 'Done. The action is in the moderation log.',
  },
  states: {
    loading: 'Loading…',
    error: 'Could not load this page.',
    retry: 'Try again',
    empty: 'No members match.',
    loadMore: 'Show more',
    loginNeeded: 'Log in to open the admin panel.',
    login: 'Log in',
    staffOnly: 'This page is for moderators and admins.',
  },
  tips: {
    status:
      'Suspended members cannot log in until the date shown. Banned members cannot log in until reinstated.',
    reason: `Required, ${ADMIN_LIMITS.reasonMinLength}–${ADMIN_LIMITS.reasonMaxLength} characters. Saved in the log for other moderators and emailed to the member.`,
    days: `Between ${ADMIN_LIMITS.suspendMinDays} and ${ADMIN_LIMITS.suspendMaxDays} days. The member can log in again after that.`,
    staffTargets:
      'Only an admin can act on moderators and admins. Nobody can act on their own account.',
    log: 'Every action is recorded with who did it, when and why. Nobody can change or remove entries.',
  },
  intro: [
    {
      title: 'Keep RUET Chottor safe',
      body: 'Find members who break the rules and warn, suspend or ban them. Use the lightest action that works.',
    },
    {
      title: 'Always give a reason',
      body: 'The member receives your reason by email, and other moderators see it in the log.',
    },
    {
      title: 'Everything is logged',
      body: 'The moderation log records every action with your name. Entries can never be edited or deleted.',
    },
  ],
} as const;
