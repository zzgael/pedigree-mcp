import { describe, it, expect } from 'vitest';
import { getDocumentation } from '../src/tools/get-documentation.js';

describe('getDocumentation tool', () => {
  it('should return documentation string', () => {
    const docs = getDocumentation();

    expect(typeof docs).toBe('string');
    expect(docs.length).toBeGreaterThan(500);
  });

  it('should contain essential sections', () => {
    const docs = getDocumentation();

    expect(docs).toContain('Individual Properties');
    expect(docs).toContain('Required');
    expect(docs).toContain('name');
    expect(docs).toContain('sex');
  });

  it('should document parent references', () => {
    const docs = getDocumentation();

    expect(docs).toContain('mother');
    expect(docs).toContain('father');
  });

  it('should document conditions (Bennett standard free text)', () => {
    const docs = getDocumentation();

    expect(docs).toContain('conditions');
    expect(docs).toContain('Breast cancer');
    expect(docs.toLowerCase()).toContain('free text');
    expect(docs).toContain('Bennett');
  });

  it('should contain working examples', () => {
    const docs = getDocumentation();

    expect(docs).toContain('Example');
    expect(docs).toContain('"sex":"M"');
    expect(docs).toContain('"sex":"F"');
    expect(docs).toContain('proband');
    expect(docs).toContain('top_level');
  });

  it('should document validation rules', () => {
    const docs = getDocumentation();

    expect(docs).toContain('Validation');
    expect(docs).toContain('sex:"F"');
    expect(docs).toContain('sex:"M"');
  });

  it('should document configuration options', () => {
    const docs = getDocumentation();

    expect(docs).toContain('width');
    expect(docs).toContain('height');
    expect(docs).toContain('symbol_size');
  });
});
