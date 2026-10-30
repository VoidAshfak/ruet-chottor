// All guidance text for notifications (CLAUDE.md §8). Keep it short and plain.
export const help = {
  page: {
    title: 'Notifications',
    description: 'What happened to your posts, clubs and events while you were away.',
  },
  bell: (count: number) =>
    count === 0 ? 'Notifications' : `Notifications, ${count > 99 ? '99+' : count} unread`,
  list: {
    label: 'Your notifications',
    loading: 'Loading notifications',
    error: 'Could not load your notifications.',
    retry: 'Try again',
    empty:
      'Nothing yet. You will hear here when a moderator reviews your post, a club answers you, or an event you are going to changes.',
    loadMore: 'Show older',
    unread: 'Unread',
    markRead: 'Mark as read',
  },
  markAll: 'Mark all as read',
  markAllTip: 'Clears the unread count. Notifications stay in the list for 90 days.',
  markAllTipLabel: 'About marking all as read',
  loginNeeded: 'Log in to see your notifications.',
  login: 'Log in',
  intro: [
    {
      title: 'News about your things',
      body: 'Moderator decisions on your posts, club join requests and changes to events you are going to appear here.',
    },
    {
      title: 'The bell shows what is new',
      body: 'The number on the bell in the header counts unread notifications. It updates by itself.',
    },
    {
      title: 'Tap to open',
      body: 'Tapping a notification marks it read and takes you to the post, club or event.',
    },
  ],
} as const;
