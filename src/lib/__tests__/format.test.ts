import { describe, it, expect } from 'vitest';
import { formatMontant } from '../format';

describe('formatMontant', () => {
  it('formats number with 2 decimals and euro sign', () => {
    const result = formatMontant(1234.5);
    // French locale uses non-breaking space as thousands separator
    expect(result).toContain('€');
    expect(result).toContain('1');
    expect(result).toContain('234');
    expect(result).toContain('50');
  });

  it('formats zero as "0,00 €"', () => {
    const result = formatMontant(0);
    expect(result).toContain('0');
    expect(result).toContain('00');
    expect(result).toContain('€');
  });

  it('returns empty string for null', () => {
    expect(formatMontant(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatMontant(undefined)).toBe('');
  });

  it('handles large numbers', () => {
    const result = formatMontant(5379534.16);
    expect(result).toContain('€');
    expect(result).toContain('5');
    expect(result).toContain('379');
    expect(result).toContain('534');
  });
});
