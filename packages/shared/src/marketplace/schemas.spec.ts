import { describe, expect, it } from 'vitest';
import { heldTermIn, listingBrowseQuerySchema, listingInputSchema } from './schemas.js';

describe('heldTermIn', () => {
  it('finds held words and phrases, ignoring case and punctuation', () => {
    expect(heldTermIn('Selling LEAKED physics paper!!')).toBe('leaked');
    expect(heldTermIn('Fake-ID available')).toBe('fake id');
    expect(heldTermIn('cheap Beer')).toBe('beer');
  });

  it('matches whole words only', () => {
    expect(heldTermIn('The class has begun; selling a gunmetal grey lamp')).toBeNull();
    expect(heldTermIn('Calculus textbook, good condition')).toBeNull();
  });
});

describe('listing schemas', () => {
  const listing = {
    title: 'Casio fx-991EX calculator',
    category: 'electronics',
    condition: 'like_new',
    priceTaka: '1200',
    description: '',
    meetPlace: 'cafeteria',
    meetDetail: '',
  };

  it('reads the price from a form field and allows free items', () => {
    expect(listingInputSchema.parse(listing)).toMatchObject({ priceTaka: 1200, meetDetail: null });
    expect(listingInputSchema.parse({ ...listing, priceTaka: '0' }).priceTaka).toBe(0);
  });

  it('rejects negative, fractional and missing prices', () => {
    expect(listingInputSchema.safeParse({ ...listing, priceTaka: '-5' }).success).toBe(false);
    expect(listingInputSchema.safeParse({ ...listing, priceTaka: '10.5' }).success).toBe(false);
    expect(listingInputSchema.safeParse({ ...listing, priceTaka: 'abc' }).success).toBe(false);
  });

  it('checks the price range of a search', () => {
    expect(listingBrowseQuerySchema.safeParse({ minPrice: '500', maxPrice: '100' }).success).toBe(
      false,
    );
    expect(listingBrowseQuerySchema.parse({}).sort).toBe('newest');
  });
});
