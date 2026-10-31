// All guidance text for the home page (CLAUDE.md §8). Keep it short and plain.
export const help = {
  page: {
    title: 'Welcome to RUET Chottor',
    description: 'One place for RUET students to find people, talk, and use campus services.',
  },
  hero: {
    tagline: 'The campus square, online.',
    body: 'Find classmates, chat, follow campus news and clubs. Made by RUET students, for the whole RUET community.',
    signup: 'Join with your RUET roll',
    login: 'I already have an account',
    greeting: { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening' },
    memberBody: 'Here is what is happening around the chottor today.',
    artLabel:
      'Cartoon of RUET campus life: students chatting in front of a red-brick academic building, a rickshaw and a mango tree by the river.',
    // "Let's have an adda!" Adda is the long, easy chat that campus squares are known for.
    bubble: 'চলো আড্ডা দিই!',
  },
  sections: {
    title: 'Explore Chottor',
    description: 'Everything the campus square offers, one tap away.',
    open: 'Open',
  },
  quickActions: {
    title: 'Quick actions',
    chat: 'Start a chat',
    lost: 'Report a lost item',
    sell: 'Sell something',
    bus: 'Check the bus',
  },
  join: {
    title: 'Join in three steps',
    steps: [
      {
        title: 'Sign up with your roll',
        body: 'Your name, RUET roll, registration number, email and phone. Takes a minute.',
      },
      {
        title: 'Enter the 6-digit code',
        body: 'Every login sends a one-time code to your email, so only you can get in.',
      },
      {
        title: 'Make it yours',
        body: 'Your department and series fill in from your roll. Choose who can see your email or phone.',
      },
    ],
  },
  safety: {
    title: 'Safe by default',
    items: [
      {
        title: 'Your details stay private',
        body: 'Email and phone are hidden unless you choose to show them. Your birthday never is.',
      },
      {
        title: 'Anything can be reported',
        body: 'Posts, messages, listings and events all have a Report button.',
      },
      {
        title: 'Real moderators',
        body: 'Moderators review every report and keep the square clean, kind and spam-free.',
      },
    ],
  },
  comingSoon: {
    title: 'Coming to Chottor',
    tip: 'Sections are added one at a time. These are being built and will appear in the menu when ready.',
    tipLabel: 'About upcoming sections',
  },
  status: {
    loading: 'Checking which sections are available',
    offline: 'Could not reach the server. Try again in a moment.',
  },
  intro: [
    {
      title: 'Welcome to RUET Chottor',
      body: '"Chottor" means campus square. This is the online version: one place for the whole RUET community.',
    },
    {
      title: 'Everything is in the menu',
      body: 'Open sections from the bar at the top (or the Menu button on phones). New sections appear there when they are ready.',
    },
    {
      title: 'Look for the (i) icons',
      body: 'Not sure what something does? Hover over or tap the (i) icon next to it for a short explanation.',
    },
  ],
} as const;
