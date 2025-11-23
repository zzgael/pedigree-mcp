import { describe, it, expect } from 'vitest';
import { generatePedigree } from '../src/tools/generate-pedigree.js';
import type { Individual } from '../src/types.js';

describe('generatePedigree tool', () => {
  describe('input validation', () => {
    it('should return error for empty dataset', async () => {
      const result = await generatePedigree({ dataset: [] });

      expect(result.success).toBe(false);
      expect(result.error).toContain('non-empty array');
    });

    it('should return error for undefined dataset', async () => {
      const result = await generatePedigree({ dataset: undefined as any });

      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should return error for invalid dataset (not array)', async () => {
      const result = await generatePedigree({ dataset: 'not an array' as any });

      expect(result.success).toBe(false);
      expect(result.error).toContain('array');
    });
  });

  describe('successful generation', () => {
    it('should generate pedigree with metadata', async () => {
      const dataset: Individual[] = [
        { name: 'gf', sex: 'M', top_level: true },
        { name: 'gm', sex: 'F', top_level: true },
        { name: 'p', sex: 'F', mother: 'gm', father: 'gf', proband: true },
      ];

      const result = await generatePedigree({ dataset });

      if (!result.success) {
        console.error('Generation failed:', result.error);
      }
      expect(result.success).toBe(true);
      expect(result.image_base64).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.individual_count).toBe(3);
      expect(result.metadata?.generation_count).toBe(2);
    });

    it('should respect custom width and height', async () => {
      const dataset: Individual[] = [
        { name: 'f', sex: 'M', top_level: true },
        { name: 'm', sex: 'F', top_level: true },
      ];

      const result = await generatePedigree({
        dataset,
        width: 1200,
        height: 900,
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.width).toBe(1200);
      expect(result.metadata?.height).toBe(900);
    });

    it('should return valid base64 PNG', async () => {
      const dataset: Individual[] = [
        { name: 'solo', sex: 'M', top_level: true, proband: true },
      ];

      const result = await generatePedigree({ dataset });

      expect(result.success).toBe(true);
      expect(result.image_base64).toBeDefined();

      // Decode base64 and verify PNG magic bytes
      const buffer = Buffer.from(result.image_base64!, 'base64');
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50); // P
      expect(buffer[2]).toBe(0x4e); // N
      expect(buffer[3]).toBe(0x47); // G
    });

    it('should handle complex multi-generation pedigree', async () => {
      const dataset: Individual[] = [
        { name: 'ggf', sex: 'M', top_level: true, status: 1 },
        { name: 'ggm', sex: 'F', top_level: true, status: 1, ovarian_cancer_diagnosis_age: 72 },
        { name: 'gf1', sex: 'M', mother: 'ggm', father: 'ggf', status: 1 },
        { name: 'gm1', sex: 'F', top_level: true, breast_cancer_diagnosis_age: 58 },
        { name: 'f1', sex: 'M', mother: 'gm1', father: 'gf1', age: 52 },
        { name: 'm1', sex: 'F', mother: 'gm1', father: 'gf1', age: 48, breast_cancer_diagnosis_age: 44 },
        { name: 'sp1', sex: 'F', top_level: true, age: 50 },
        { name: 'ch1', display_name: 'Patient', sex: 'F', mother: 'm1', father: 'f1', proband: true, age: 25 },
        { name: 'ch2', sex: 'M', mother: 'm1', father: 'f1', age: 22 },
      ];

      const result = await generatePedigree({ dataset });

      expect(result.success).toBe(true);
      expect(result.metadata?.individual_count).toBe(9);
      expect(result.metadata?.generation_count).toBeGreaterThanOrEqual(3);
    });
  });

  describe('error handling', () => {
    it('should return validation error for invalid parent reference', async () => {
      const dataset: Individual[] = [
        { name: 'child', sex: 'F', mother: 'missing', father: 'dad' },
        { name: 'dad', sex: 'M', top_level: true },
      ];

      const result = await generatePedigree({ dataset });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation');
    });
  });
});
