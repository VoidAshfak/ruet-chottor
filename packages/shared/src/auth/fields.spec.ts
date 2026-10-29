import { describe, expect, it } from 'vitest';
import {
  ageOn,
  dateOfBirthSchema,
  emailSchema,
  passwordSchema,
  phoneSchema,
  rollSchema,
} from './fields.js';
import { signupRequestSchema } from './schemas.js';

describe('rollSchema', () => {
  it('accepts a 7-digit RUET roll', () => {
    expect(rollSchema.parse(' 1703103 ')).toBe('1703103');
  });

  it.each(['170310', '17031034', '17O3103', ''])('rejects %j', (roll) => {
    expect(rollSchema.safeParse(roll).success).toBe(false);
  });
});

describe('phoneSchema', () => {
  it.each(['01700000000', '+8801700000000', '8801700000000', '017-0000 0000'])(
    'normalises %j',
    (phone) => {
      expect(phoneSchema.parse(phone)).toBe('+8801700000000');
    },
  );

  it.each(['01212345678', '0171234567', '+447712345678'])('rejects %j', (phone) => {
    expect(phoneSchema.safeParse(phone).success).toBe(false);
  });
});

describe('emailSchema', () => {
  it('trims and lowercases', () => {
    expect(emailSchema.parse('  Test.User@Example.COM ')).toBe('test.user@example.com');
  });
});

describe('passwordSchema', () => {
  it('rejects short, common and repeated-character passwords', () => {
    expect(passwordSchema.safeParse('short1').success).toBe(false);
    expect(passwordSchema.safeParse('Password123').success).toBe(false);
    expect(passwordSchema.safeParse('aaaaaaaaaa').success).toBe(false);
  });

  it('accepts a reasonable password', () => {
    expect(passwordSchema.safeParse('green-river-42').success).toBe(true);
  });
});

describe('dateOfBirth', () => {
  it('counts whole years', () => {
    const today = new Date(Date.UTC(2026, 9, 29));
    expect(ageOn('2005-10-29', today)).toBe(21);
    expect(ageOn('2005-10-30', today)).toBe(20);
  });

  it('rejects impossible dates and ages', () => {
    expect(dateOfBirthSchema.safeParse('2005-02-30').success).toBe(false);
    expect(dateOfBirthSchema.safeParse('1900-01-01').success).toBe(false);
  });
});

describe('signupRequestSchema', () => {
  const valid = {
    name: 'Test Student',
    roll: '2103001',
    registrationNo: '12345',
    email: 'test.student@example.com',
    phone: '01700000001',
    dateOfBirth: '2003-05-14',
    password: 'green-river-42',
  };

  it('accepts a valid sign-up', () => {
    expect(signupRequestSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a password that contains the roll', () => {
    const result = signupRequestSchema.safeParse({ ...valid, password: 'me2103001!' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['password']);
  });
});
