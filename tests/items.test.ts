import { describe, expect, it } from 'vitest';
import { bagEntryInfo, bagEntryName } from '../src/ui/items';

describe('Infotexte der Gegenstände', () => {
  it('nennen die genaue Wirkung', () => {
    expect(bagEntryInfo('heilbeere')).toBe('Heilt 30 KP.');
    // Mit Heilungs-Bonus aus dem Profil heilt die Beere mehr – und der Text sagt das auch
    expect(bagEntryInfo('heilbeere', 0.2)).toBe('Heilt 36 KP.');
    expect(bagEntryInfo('sternbeere')).toBe('Gibt jeder Fähigkeit 5 Energie zurück.');
    expect(bagEntryInfo('wurfstein')).toContain('10 Schaden');
    expect(bagEntryInfo('wurfstein')).toContain('8 Felder');
  });

  it('Fähigkeitssteine nennen ihre Fähigkeit', () => {
    expect(bagEntryName('flutstein:wasserblase')).toBe('Flutstein: Wasserblase');
    expect(bagEntryInfo('flutstein:wasserblase')).toContain('Wasserblase');
  });
});
