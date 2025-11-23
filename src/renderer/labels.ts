/**
 * Label formatting functions
 * Ported from pedigreejs labels.js
 */

import type { Individual } from '../types.js';

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

