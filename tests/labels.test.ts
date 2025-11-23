import { describe, it, expect } from 'vitest';
import {
  formatDiseaseLabel,
  getDiseaseLabels,
  formatGeneTestResult,
  getGeneTestLabels,
  countLabelLines,
} from '../src/renderer/labels.js';
import type { Individual, DiseaseConfig } from '../src/types.js';

describe('labels', () => {
  describe('formatDiseaseLabel', () => {
    it('should format breast_cancer correctly', () => {
      expect(formatDiseaseLabel('breast_cancer')).toBe('breast ca.');
    });

    it('should format ovarian_cancer correctly', () => {
      expect(formatDiseaseLabel('ovarian_cancer')).toBe('ovarian ca.');
    });

    it('should format breast_cancer2 correctly', () => {
      expect(formatDiseaseLabel('breast_cancer2')).toBe('breast ca.2');
    });

    it('should format pancreatic_cancer correctly', () => {
      expect(formatDiseaseLabel('pancreatic_cancer')).toBe('pancreatic ca.');
    });

    it('should format prostate_cancer correctly', () => {
      expect(formatDiseaseLabel('prostate_cancer')).toBe('prostate ca.');
    });
  });

  describe('getDiseaseLabels', () => {
    const diseases: DiseaseConfig[] = [
      { type: 'breast_cancer', colour: '#F68F35' },
      { type: 'ovarian_cancer', colour: '#4DAA4D' },
    ];

    it('should return empty array for individual without diseases', () => {
      const individual: Individual = { name: 'test', sex: 'F' };
      const labels = getDiseaseLabels(individual, diseases);
      expect(labels).toEqual([]);
    });

    it('should return formatted label for single disease', () => {
      const individual = { name: 'test', sex: 'F', breast_cancer_diagnosis_age: 55 } as Individual;
      const labels = getDiseaseLabels(individual, diseases);
      expect(labels).toEqual(['breast ca.: 55']);
    });

    it('should return multiple labels for multiple diseases', () => {
      const individual = {
        name: 'test',
        sex: 'F',
        breast_cancer_diagnosis_age: 55,
        ovarian_cancer_diagnosis_age: 60,
      } as Individual;
      const labels = getDiseaseLabels(individual, diseases);
      expect(labels).toEqual(['breast ca.: 55', 'ovarian ca.: 60']);
    });

    it('should ignore non-numeric diagnosis ages', () => {
      const individual = {
        name: 'test',
        sex: 'F',
        breast_cancer_diagnosis_age: 'unknown',
      } as any;
      const labels = getDiseaseLabels(individual, diseases);
      expect(labels).toEqual([]);
    });
  });

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

  describe('countLabelLines', () => {
    const diseases: DiseaseConfig[] = [
      { type: 'breast_cancer', colour: '#F68F35' },
      { type: 'ovarian_cancer', colour: '#4DAA4D' },
    ];

    it('should return 1 for individual with only name', () => {
      const individual: Individual = { name: 'test', sex: 'F' };
      expect(countLabelLines(individual, diseases, [])).toBe(1);
    });

    it('should return 2 for individual with age', () => {
      const individual: Individual = { name: 'test', sex: 'F', age: 45 };
      expect(countLabelLines(individual, diseases, ['age'])).toBe(2);
    });

    it('should return 2 for individual with age and yob (combined line)', () => {
      const individual: Individual = { name: 'test', sex: 'F', age: 45, yob: 1980 };
      expect(countLabelLines(individual, diseases, ['age', 'yob'])).toBe(2);
    });

    it('should count disease labels', () => {
      const individual = {
        name: 'test',
        sex: 'F',
        age: 45,
        breast_cancer_diagnosis_age: 55,
        ovarian_cancer_diagnosis_age: 60,
      } as Individual;
      // 1 (name) + 1 (age) + 2 (diseases) = 4
      expect(countLabelLines(individual, diseases, ['age'])).toBe(4);
    });

    it('should count gene test line', () => {
      const individual = {
        name: 'test',
        sex: 'F',
        brca1_gene_test: { type: 'T', result: 'P' },
      } as Individual;
      // 1 (name) + 1 (gene tests) = 2
      expect(countLabelLines(individual, diseases, [])).toBe(2);
    });
  });
});
