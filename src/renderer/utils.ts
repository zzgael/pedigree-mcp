/**
 * Pedigree utility functions
 * Ported from pedigreejs utils.js
 */

import type { Individual } from '../types.js';

/**
 * Get all ancestors of an individual
 * Used for consanguinity detection
 */
export function getAncestors(
    individual: Individual,
    individuals: Map<string, Individual>,
): Individual[] {
    const ancestors: Individual[] = [];
    const recurse = (ind: Individual) => {
        if (ind.noparents) return; // Adopted individuals have no biological ancestors
        if (ind.mother) {
            const mother = individuals.get(ind.mother);
            if (mother) {
                recurse(mother);
            }
        }
        if (ind.father) {
            const father = individuals.get(ind.father);
            if (father) {
                recurse(father);
            }
        }
        ancestors.push(ind);
    };
    recurse(individual);
    return ancestors;
}

/**
 * Check if two partners share common ancestry (consanguinity)
 * Ported from pedigreejs utils.js consanguity() function
 */
export function isConsanguineous(
    partner1: Individual,
    partner2: Individual,
    individuals: Map<string, Individual>,
): boolean {
    const ancestors1 = getAncestors(partner1, individuals);
    const ancestors2 = getAncestors(partner2, individuals);
    const names1 = new Set(ancestors1.map(a => a.name));

    // Check if any ancestor of partner2 is also an ancestor of partner1
    for (const ancestor of ancestors2) {
        if (names1.has(ancestor.name)) {
            return true;
        }
    }
    return false;
}

/**
 * Get MZ twins of an individual (siblings with same mztwin value)
 * Bennett standard: MZ twins connected by horizontal bar
 * Ported from pedigreejs utils.js getTwins()
 */
export function getTwins(
    individual: Individual,
    dataset: Individual[],
): Individual[] {
    if (!individual.mztwin) return [];

    const twins: Individual[] = [];
    for (const ind of dataset) {
        if (
            ind.name !== individual.name &&
            ind.mztwin === individual.mztwin &&
            ind.mother === individual.mother &&
            ind.father === individual.father
        ) {
            twins.push(ind);
        }
    }
    return twins;
}

/**
 * Get DZ twins of an individual (siblings with same dztwin value)
 * Bennett standard: DZ twins have diagonal lines from same point (NO horizontal bar)
 */
export function getDzTwins(
    individual: Individual,
    dataset: Individual[],
): Individual[] {
    if (!individual.dztwin) return [];

    const twins: Individual[] = [];
    for (const ind of dataset) {
        if (
            ind.name !== individual.name &&
            ind.dztwin === individual.dztwin &&
            ind.mother === individual.mother &&
            ind.father === individual.father
        ) {
            twins.push(ind);
        }
    }
    return twins;
}
