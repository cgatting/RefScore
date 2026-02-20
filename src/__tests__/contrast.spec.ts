import { describe, it, expect } from 'vitest';
import { contrastRatio, meetsAAForText } from '../utils/color';

const PRIMARY_BG = '#0D0D0D';
const SECONDARY_BG = '#1A1A1A';
const ACCENT_TEXT = '#FFFFFF';
const CTA_GOLD = '#FFD700';

describe('Midnight palette WCAG contrast', () => {
  it('white text on primary background meets AA for normal text', () => {
    expect(meetsAAForText(ACCENT_TEXT, PRIMARY_BG, false)).toBe(true);
    expect(contrastRatio(ACCENT_TEXT, PRIMARY_BG)).toBeGreaterThanOrEqual(4.5);
  });

  it('white text on secondary background meets AA for normal text', () => {
    expect(meetsAAForText(ACCENT_TEXT, SECONDARY_BG, false)).toBe(true);
    expect(contrastRatio(ACCENT_TEXT, SECONDARY_BG)).toBeGreaterThanOrEqual(4.5);
  });

  it('gold CTA on primary background meets AA for normal text', () => {
    expect(meetsAAForText(CTA_GOLD, PRIMARY_BG, false)).toBe(true);
    expect(contrastRatio(CTA_GOLD, PRIMARY_BG)).toBeGreaterThanOrEqual(4.5);
  });

  it('gold CTA on secondary background meets AA for normal text', () => {
    expect(meetsAAForText(CTA_GOLD, SECONDARY_BG, false)).toBe(true);
    expect(contrastRatio(CTA_GOLD, SECONDARY_BG)).toBeGreaterThanOrEqual(4.5);
  });
});
