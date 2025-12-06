import { describe, it, expect } from 'vitest';
import {
    getAncestors,
    isConsanguineous,
    getTwins,
    getDzTwins,
} from '../src/renderer/utils.js';
import type { Individual } from '../src/types.js';

describe('utils', () => {
    describe('getAncestors', () => {
        it('should return empty array for individual with no parents', () => {
            const dataset: Individual[] = [
                { name: 'solo', sex: 'M', top_level: true },
            ];
            const individuals = new Map(dataset.map(d => [d.name, d]));

            const ancestors = getAncestors(dataset[0], individuals);

            // Should only include self
            expect(ancestors).toHaveLength(1);
            expect(ancestors[0].name).toBe('solo');
        });

        it('should return parents and self', () => {
            const dataset: Individual[] = [
                { name: 'gf', sex: 'M', top_level: true },
                { name: 'gm', sex: 'F', top_level: true },
                { name: 'child', sex: 'F', mother: 'gm', father: 'gf' },
            ];
            const individuals = new Map(dataset.map(d => [d.name, d]));

            const ancestors = getAncestors(dataset[2], individuals);

            // Should include gf, gm, and child
            expect(ancestors).toHaveLength(3);
            expect(ancestors.map(a => a.name).sort()).toEqual([
                'child',
                'gf',
                'gm',
            ]);
        });

        it('should return all ancestors in multi-generation pedigree', () => {
            const dataset: Individual[] = [
                { name: 'ggf', sex: 'M', top_level: true },
                { name: 'ggm', sex: 'F', top_level: true },
                { name: 'gf', sex: 'M', mother: 'ggm', father: 'ggf' },
                { name: 'gm', sex: 'F', top_level: true },
                { name: 'child', sex: 'F', mother: 'gm', father: 'gf' },
            ];
            const individuals = new Map(dataset.map(d => [d.name, d]));

            const ancestors = getAncestors(dataset[4], individuals);

            // Should include: ggf, ggm, gf, gm, child (5)
            expect(ancestors).toHaveLength(5);
            expect(ancestors.map(a => a.name).sort()).toEqual([
                'child',
                'gf',
                'ggf',
                'ggm',
                'gm',
            ]);
        });

        it('should return empty for adopted individuals (noparents flag)', () => {
            // When an individual has noparents=true, getAncestors returns empty
            // This is correct per pedigreejs - adopted individuals have no biological ancestry to trace
            const dataset: Individual[] = [
                { name: 'bio_gf', sex: 'M', top_level: true },
                { name: 'bio_gm', sex: 'F', top_level: true },
                {
                    name: 'adopted',
                    sex: 'F',
                    mother: 'bio_gm',
                    father: 'bio_gf',
                    noparents: true,
                },
            ];
            const individuals = new Map(dataset.map(d => [d.name, d]));

            const ancestors = getAncestors(dataset[2], individuals);

            // noparents=true means no ancestry - returns early with empty array
            expect(ancestors).toHaveLength(0);
        });
    });

    describe('isConsanguineous', () => {
        it('should return false for unrelated partners', () => {
            const dataset: Individual[] = [
                { name: 'f', sex: 'M', top_level: true },
                { name: 'm', sex: 'F', top_level: true },
            ];
            const individuals = new Map(dataset.map(d => [d.name, d]));

            const result = isConsanguineous(
                dataset[0],
                dataset[1],
                individuals,
            );

            expect(result).toBe(false);
        });

        it('should return true for first cousins', () => {
            // First cousins share grandparents
            const dataset: Individual[] = [
                { name: 'ggf', sex: 'M', top_level: true },
                { name: 'ggm', sex: 'F', top_level: true },
                { name: 'uncle', sex: 'M', mother: 'ggm', father: 'ggf' },
                { name: 'aunt_wife', sex: 'F', top_level: true },
                { name: 'dad', sex: 'M', mother: 'ggm', father: 'ggf' },
                { name: 'mom_wife', sex: 'F', top_level: true },
                {
                    name: 'cousin1',
                    sex: 'M',
                    mother: 'aunt_wife',
                    father: 'uncle',
                }, // Child of uncle
                {
                    name: 'cousin2',
                    sex: 'F',
                    mother: 'mom_wife',
                    father: 'dad',
                }, // Child of dad
            ];
            const individuals = new Map(dataset.map(d => [d.name, d]));

            const cousin1 = individuals.get('cousin1')!;
            const cousin2 = individuals.get('cousin2')!;
            const result = isConsanguineous(cousin1, cousin2, individuals);

            expect(result).toBe(true);
        });

        it('should return true for siblings', () => {
            const dataset: Individual[] = [
                { name: 'f', sex: 'M', top_level: true },
                { name: 'm', sex: 'F', top_level: true },
                { name: 'sib1', sex: 'M', mother: 'm', father: 'f' },
                { name: 'sib2', sex: 'F', mother: 'm', father: 'f' },
            ];
            const individuals = new Map(dataset.map(d => [d.name, d]));

            const sib1 = individuals.get('sib1')!;
            const sib2 = individuals.get('sib2')!;
            const result = isConsanguineous(sib1, sib2, individuals);

            expect(result).toBe(true);
        });

        it('should return false when adoption breaks ancestry chain', () => {
            const dataset: Individual[] = [
                { name: 'ggf', sex: 'M', top_level: true },
                { name: 'ggm', sex: 'F', top_level: true },
                {
                    name: 'adopted',
                    sex: 'M',
                    mother: 'ggm',
                    father: 'ggf',
                    noparents: true,
                },
                { name: 'bio_child', sex: 'F', mother: 'ggm', father: 'ggf' },
            ];
            const individuals = new Map(dataset.map(d => [d.name, d]));

            const adopted = individuals.get('adopted')!;
            const bio_child = individuals.get('bio_child')!;
            const result = isConsanguineous(adopted, bio_child, individuals);

            // Adopted has noparents, so ancestry chain is broken
            expect(result).toBe(false);
        });
    });

    describe('getTwins', () => {
        it('should return empty array for non-twin', () => {
            const dataset: Individual[] = [
                { name: 'f', sex: 'M', top_level: true },
                { name: 'm', sex: 'F', top_level: true },
                { name: 'child', sex: 'F', mother: 'm', father: 'f' },
            ];

            const twins = getTwins(dataset[2], dataset);

            expect(twins).toHaveLength(0);
        });

        it('should return twin sibling', () => {
            const dataset: Individual[] = [
                { name: 'f', sex: 'M', top_level: true },
                { name: 'm', sex: 'F', top_level: true },
                {
                    name: 't1',
                    sex: 'F',
                    mother: 'm',
                    father: 'f',
                    mztwin: 'twins',
                },
                {
                    name: 't2',
                    sex: 'F',
                    mother: 'm',
                    father: 'f',
                    mztwin: 'twins',
                },
            ];

            const twins = getTwins(dataset[2], dataset);

            expect(twins).toHaveLength(1);
            expect(twins[0].name).toBe('t2');
        });

        it('should return multiple twins (triplets)', () => {
            const dataset: Individual[] = [
                { name: 'f', sex: 'M', top_level: true },
                { name: 'm', sex: 'F', top_level: true },
                {
                    name: 't1',
                    sex: 'F',
                    mother: 'm',
                    father: 'f',
                    mztwin: 'triplets',
                },
                {
                    name: 't2',
                    sex: 'F',
                    mother: 'm',
                    father: 'f',
                    mztwin: 'triplets',
                },
                {
                    name: 't3',
                    sex: 'F',
                    mother: 'm',
                    father: 'f',
                    mztwin: 'triplets',
                },
            ];

            const twins = getTwins(dataset[2], dataset);

            expect(twins).toHaveLength(2);
            expect(twins.map(t => t.name).sort()).toEqual(['t2', 't3']);
        });

        it('should not match siblings from different parents with same mztwin value', () => {
            const dataset: Individual[] = [
                { name: 'f1', sex: 'M', top_level: true },
                { name: 'm1', sex: 'F', top_level: true },
                { name: 'f2', sex: 'M', top_level: true },
                { name: 'm2', sex: 'F', top_level: true },
                {
                    name: 't1',
                    sex: 'F',
                    mother: 'm1',
                    father: 'f1',
                    mztwin: 'same_marker',
                },
                {
                    name: 't2',
                    sex: 'F',
                    mother: 'm2',
                    father: 'f2',
                    mztwin: 'same_marker',
                },
            ];

            const twins = getTwins(dataset[4], dataset);

            // t2 has different parents, so not a twin
            expect(twins).toHaveLength(0);
        });
    });

    describe('getDzTwins', () => {
        it('should return empty array for non-twin', () => {
            const dataset: Individual[] = [
                { name: 'f', sex: 'M', top_level: true },
                { name: 'm', sex: 'F', top_level: true },
                { name: 'child', sex: 'F', mother: 'm', father: 'f' },
            ];

            const twins = getDzTwins(dataset[2], dataset);

            expect(twins).toHaveLength(0);
        });

        it('should return DZ twin sibling', () => {
            const dataset: Individual[] = [
                { name: 'f', sex: 'M', top_level: true },
                { name: 'm', sex: 'F', top_level: true },
                {
                    name: 't1',
                    sex: 'F',
                    mother: 'm',
                    father: 'f',
                    dztwin: 'twins',
                },
                {
                    name: 't2',
                    sex: 'M',
                    mother: 'm',
                    father: 'f',
                    dztwin: 'twins',
                },
            ];

            const twins = getDzTwins(dataset[2], dataset);

            expect(twins).toHaveLength(1);
            expect(twins[0].name).toBe('t2');
        });

        it('should return multiple DZ twins (triplets)', () => {
            const dataset: Individual[] = [
                { name: 'f', sex: 'M', top_level: true },
                { name: 'm', sex: 'F', top_level: true },
                {
                    name: 't1',
                    sex: 'F',
                    mother: 'm',
                    father: 'f',
                    dztwin: 'triplets',
                },
                {
                    name: 't2',
                    sex: 'F',
                    mother: 'm',
                    father: 'f',
                    dztwin: 'triplets',
                },
                {
                    name: 't3',
                    sex: 'M',
                    mother: 'm',
                    father: 'f',
                    dztwin: 'triplets',
                },
            ];

            const twins = getDzTwins(dataset[2], dataset);

            expect(twins).toHaveLength(2);
            expect(twins.map(t => t.name).sort()).toEqual(['t2', 't3']);
        });

        it('should not match siblings from different parents with same dztwin value', () => {
            const dataset: Individual[] = [
                { name: 'f1', sex: 'M', top_level: true },
                { name: 'm1', sex: 'F', top_level: true },
                { name: 'f2', sex: 'M', top_level: true },
                { name: 'm2', sex: 'F', top_level: true },
                {
                    name: 't1',
                    sex: 'F',
                    mother: 'm1',
                    father: 'f1',
                    dztwin: 'same_marker',
                },
                {
                    name: 't2',
                    sex: 'F',
                    mother: 'm2',
                    father: 'f2',
                    dztwin: 'same_marker',
                },
            ];

            const twins = getDzTwins(dataset[4], dataset);

            // t2 has different parents, so not a DZ twin
            expect(twins).toHaveLength(0);
        });
    });
});
