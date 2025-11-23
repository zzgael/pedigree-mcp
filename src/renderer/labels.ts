/**
 * Label formatting functions
 * Ported from pedigreejs labels.js
 */

import type { Individual, DiseaseConfig } from '../types.js';

/**
 * Format disease type for display label (pedigreejs style)
 * "breast_cancer" → "breast ca."
 * "ovarian_cancer" → "ovarian ca."
 * "breast_cancer2" → "breast ca.2"
 */
export function formatDiseaseLabel(diseaseType: string): string {
  return diseaseType
    .replace(/_/g, ' ')
    .replace('cancer', 'ca.')
    .replace('ca. ', 'ca.') // Fix "ca. 2" → "ca.2"
    .trim();
}

/**
 * Get disease labels with diagnosis ages for an individual
 * Returns array of formatted strings like "breast ca.: 67"
 */
export function getDiseaseLabels(individual: Individual, diseases: DiseaseConfig[]): string[] {
  const labels: string[] = [];

  for (const disease of diseases) {
    const diagnosisKey = `${disease.type}_diagnosis_age`;
    if (diagnosisKey in individual) {
      const age = (individual as any)[diagnosisKey];
      if (typeof age === 'number') {
        labels.push(`${formatDiseaseLabel(disease.type)}: ${age}`);
      }
    }
  }

  return labels;
}

/**
 * Format gene test result (P→+, N→-)
 * Ported from pedigreejs labels.js
 */
export function formatGeneTestResult(result: string): string {
  if (result === 'P') return '+';
  if (result === 'N') return '-';
  return result;
}

/**
 * Get gene test labels for an individual
 * Returns array of formatted strings like "BRCA1+"
 */
export function getGeneTestLabels(individual: Individual): string[] {
  const labels: string[] = [];
  const geneTests = ['brca1', 'brca2', 'palb2', 'atm', 'chek2', 'rad51d', 'rad51c', 'brip1'];

  for (const gene of geneTests) {
    const testKey = `${gene}_gene_test`;
    if (testKey in individual) {
      const test = (individual as any)[testKey];
      if (test && test.result && test.result !== '-') {
        const symbol = formatGeneTestResult(test.result);
        labels.push(`${gene.toUpperCase()}${symbol}`);
      }
    }
  }

  return labels;
}

/**
 * Count the number of label lines for an individual
 * Used for bounds calculation
 */
export function countLabelLines(
  individual: Individual,
  diseases: DiseaseConfig[],
  showLabels: string[],
): number {
  let lines = 1; // Name always shown
  const showAge = showLabels.includes('age') && individual.age !== undefined;
  const showYob = showLabels.includes('yob') && individual.yob !== undefined;
  if (showAge || showYob) lines++;
  lines += getDiseaseLabels(individual, diseases).length;
  if (getGeneTestLabels(individual).length > 0) lines++;
  return lines;
}
