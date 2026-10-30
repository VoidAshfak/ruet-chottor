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
  values: [
    {
      title: 'Find people',
      body: 'Search classmates, seniors and teachers by name, roll or department.',
    },
    {
      title: 'Talk',
      body: 'One-to-one and group chats, without hunting through social media groups.',
    },
    { title: 'Campus life', body: 'News and clubs in one place, checked by moderators.' },
  ],
  comingSoon: {
    title: 'Coming to Chottor',
    tip: 'Sections are added one at a time. These are being built and will appear in the menu when ready.',
    tipLabel: 'About upcoming sections',
  },
  status: {
    loading: 'Checking which sections are available…',
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
