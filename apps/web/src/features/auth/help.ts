// All guidance text for sign-up and login (CLAUDE.md §8). Keep it short and plain.
export const help = {
  signup: {
    title: 'Create your account',
    description: 'Sign up with your RUET details to use RUET Chottor.',
    submit: 'Create account',
    submitting: 'Creating account…',
    haveAccount: 'Already have an account?',
    loginLink: 'Log in',
    success: 'Account created. Log in to continue.',
  },
  login: {
    title: 'Log in',
    description: 'Log in with your roll and password. We then email you a 6-digit code.',
    submit: 'Continue',
    submitting: 'Checking…',
    noAccount: 'New to RUET Chottor?',
    signupLink: 'Create an account',
  },
  otp: {
    title: 'Enter your code',
    sentTo: (destination: string) => `We sent a 6-digit code to ${destination}.`,
    expiry: 'The code works for 5 minutes.',
    submit: 'Log in',
    submitting: 'Checking code…',
    resend: 'Send a new code',
    resendIn: (seconds: number) => `Send a new code in ${seconds}s`,
    resent: 'A new code is on its way.',
    otherAccount: 'Use a different account',
  },
  fields: {
    name: 'Full name',
    roll: 'Roll',
    registrationNo: 'Registration number',
    email: 'Email',
    phone: 'Phone',
    dateOfBirth: 'Date of birth',
    password: 'Password',
    code: '6-digit code',
  },
  passwordToggle: { show: 'Show password', hide: 'Hide password' },
  placeholders: {
    roll: 'e.g. 2103045',
    phone: '01XXXXXXXXX',
  },
  tips: {
    roll: 'Your 7-digit RUET roll, as on your ID card. It is your username and cannot be changed later.',
    registrationNo:
      'The registration number on your RUET ID card. It helps us confirm that you are a RUET student.',
    email:
      'Your login codes are sent here. It stays hidden from other users unless you choose to show it.',
    phone:
      'A Bangladeshi mobile number. Hidden from other users by default; you decide later if it is shown.',
    dateOfBirth: 'Used only to check your age. It is never shown to anyone.',
    password:
      'At least 8 characters. Very common passwords and passwords containing your roll are not allowed.',
    code: 'Logging in takes two steps so that a stolen password alone is not enough to get into your account.',
  },
  account: {
    login: 'Log in',
    signup: 'Sign up',
    logout: 'Log out',
    signedInAs: (name: string) => `Signed in as ${name}`,
  },
  intro: [
    {
      title: 'Sign up with your RUET details',
      body: 'Your roll and registration number show that you belong to RUET. Your roll becomes your username.',
    },
    {
      title: 'Your contact details stay private',
      body: 'Email and phone are hidden from other users by default. Your date of birth is never shown.',
    },
    {
      title: 'Two-step login',
      body: 'Each time you log in, we email you a 6-digit code. This keeps your account safe even if someone learns your password.',
    },
  ],
} as const;
