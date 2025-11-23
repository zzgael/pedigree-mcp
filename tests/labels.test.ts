import { describe, it, expect } from 'vitest';
import { formatGeneTestResult, getGeneTestLabels } from '../src/renderer/labels.js';
import type { Individual } from '../src/types.js';

describe('labels', () => {
  describe('formatGeneTestResult', () => {
    it('should format P as +', () => {
      expect(formatGeneTestResult('P')).toBe('+');
    });

    it('should format N as -', () => {
      expect(formatGeneTestResult('N')).toBe('-');
    });

    it('should return other values unchanged', () => {
      expect(formatGeneTestResult('-')).toBe('-');
      expect(formatGeneTestResult('unknown')).toBe('unknown');
    });
  });

  describe('getGeneTestLabels', () => {
    it('should return empty array for individual without gene tests', () => {
      const individual: Individual = { name: 'test', sex: 'F' };
      const labels = getGeneTestLabels(individual);
      expect(labels).toEqual([]);
    });

    it('should return formatted label for positive BRCA1', () => {
      const individual = {
        name: 'test',
        sex: 'F',
        brca1_gene_test: { type: 'T', result: 'P' },
      } as Individual;
      const labels = getGeneTestLabels(individual);
      expect(labels).toEqual(['BRCA1+']);
    });

    it('should return formatted label for negative BRCA2', () => {
      const individual = {
        name: 'test',
        sex: 'F',
        brca2_gene_test: { type: 'T', result: 'N' },
      } as Individual;
      const labels = getGeneTestLabels(individual);
      expect(labels).toEqual(['BRCA2-']);
    });

    it('should return multiple gene test labels', () => {
      const individual = {
        name: 'test',
        sex: 'F',
        brca1_gene_test: { type: 'T', result: 'P' },
        brca2_gene_test: { type: 'T', result: 'N' },
        palb2_gene_test: { type: 'S', result: 'P' },
      } as Individual;
      const labels = getGeneTestLabels(individual);
      expect(labels).toEqual(['BRCA1+', 'BRCA2-', 'PALB2+']);
    });

    it('should ignore tests with - result', () => {
      const individual = {
        name: 'test',
        sex: 'F',
        brca1_gene_test: { type: 'T', result: '-' },
      } as Individual;
      const labels = getGeneTestLabels(individual);
      expect(labels).toEqual([]);
    });

    it('should handle all 8 supported genes', () => {
      const individual = {
        name: 'test',
        sex: 'F',
        brca1_gene_test: { type: 'T', result: 'P' },
        brca2_gene_test: { type: 'T', result: 'P' },
        palb2_gene_test: { type: 'T', result: 'P' },
        atm_gene_test: { type: 'T', result: 'P' },
        chek2_gene_test: { type: 'T', result: 'P' },
        rad51d_gene_test: { type: 'T', result: 'P' },
        rad51c_gene_test: { type: 'T', result: 'P' },
        brip1_gene_test: { type: 'T', result: 'P' },
      } as Individual;
      const labels = getGeneTestLabels(individual);
      expect(labels).toHaveLength(8);
      expect(labels).toContain('BRCA1+');
      expect(labels).toContain('RAD51D+');
    });
  });
});
