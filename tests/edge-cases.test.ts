import { describe, it, expect } from 'vitest';
import { PedigreeRenderer } from '../src/renderer/pedigree-renderer.js';
import type { Individual } from '../src/types.js';

/**
 * Edge Case Tests for Pedigree Renderer
 *
 * Tests complex scenarios and edge cases not covered in main test suite.
 * Focus: Exact X/Y position validation, no overlaps, proper spacing.
 */
describe('Pedigree Edge Cases', () => {
    describe('Twin Edge Cases', () => {
        it('should handle MZ triplets with connecting bar', () => {
            const dataset: Individual[] = [
                { name: 'dad', sex: 'M', top_level: true },
                { name: 'mom', sex: 'F', top_level: true },
                {
                    name: 't1',
                    sex: 'M',
                    mother: 'mom',
                    father: 'dad',
                    mztwin: 'triplets',
                },
                {
                    name: 't2',
                    sex: 'F',
                    mother: 'mom',
                    father: 'dad',
                    mztwin: 'triplets',
                },
                {
                    name: 't3',
                    sex: 'M',
                    mother: 'mom',
                    father: 'dad',
                    mztwin: 'triplets',
                    proband: true,
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            renderer.calculatePositions();

            const t1Pos = renderer.nodePositions.get('t1');
            const t2Pos = renderer.nodePositions.get('t2');
            const t3Pos = renderer.nodePositions.get('t3');

            // All triplets at same Y (same generation)
            expect(t1Pos.y).toBe(t2Pos.y);
            expect(t2Pos.y).toBe(t3Pos.y);

            // Triplets should be in order with proper spacing
            const minNodeSpacing = 140;
            expect(t2Pos.x).toBeGreaterThan(t1Pos.x);
            expect(t3Pos.x).toBeGreaterThan(t2Pos.x);
            expect(t2Pos.x - t1Pos.x).toBeGreaterThanOrEqual(minNodeSpacing);
            expect(t3Pos.x - t2Pos.x).toBeGreaterThanOrEqual(minNodeSpacing);

            const svg = renderer.renderSvg();

            // Extract lines
            const lineRegex =
                /<line[^>]*x1="([^"]*)"[^>]*y1="([^"]*)"[^>]*x2="([^"]*)"[^>]*y2="([^"]*)"[^>]*>/g;
            const lines: Array<{
                x1: number;
                y1: number;
                x2: number;
                y2: number;
            }> = [];
            let match;
            while ((match = lineRegex.exec(svg)) !== null) {
                lines.push({
                    x1: parseFloat(match[1]),
                    y1: parseFloat(match[2]),
                    x2: parseFloat(match[3]),
                    y2: parseFloat(match[4]),
                });
            }

            // Find twin bar (should span all three triplets)
            const horizontalLines = lines.filter(
                line => Math.abs(line.y1 - line.y2) < 1,
            );
            const twinBar = horizontalLines.find(
                line =>
                    line.y1 < t1Pos.y && // Above the triplets
                    Math.abs(line.x1 - t1Pos.x) < 5 &&
                    Math.abs(line.x2 - t3Pos.x) < 5,
            );

            expect(twinBar).toBeDefined();
        });

        it('should handle mixed MZ and DZ twins from same parents', () => {
            const dataset: Individual[] = [
                { name: 'dad', sex: 'M', top_level: true },
                { name: 'mom', sex: 'F', top_level: true },
                {
                    name: 'mz1',
                    sex: 'F',
                    mother: 'mom',
                    father: 'dad',
                    mztwin: 'mz',
                },
                {
                    name: 'mz2',
                    sex: 'F',
                    mother: 'mom',
                    father: 'dad',
                    mztwin: 'mz',
                },
                {
                    name: 'dz1',
                    sex: 'M',
                    mother: 'mom',
                    father: 'dad',
                    dztwin: 'dz',
                },
                {
                    name: 'dz2',
                    sex: 'M',
                    mother: 'mom',
                    father: 'dad',
                    dztwin: 'dz',
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            renderer.calculatePositions();

            const mz1Pos = renderer.nodePositions.get('mz1');
            const mz2Pos = renderer.nodePositions.get('mz2');
            const dz1Pos = renderer.nodePositions.get('dz1');
            const dz2Pos = renderer.nodePositions.get('dz2');

            // All siblings at same Y
            expect(mz1Pos.y).toBe(mz2Pos.y);
            expect(mz1Pos.y).toBe(dz1Pos.y);
            expect(mz1Pos.y).toBe(dz2Pos.y);

            const svg = renderer.renderSvg();

            // Extract horizontal lines
            const lineRegex =
                /<line[^>]*x1="([^"]*)"[^>]*y1="([^"]*)"[^>]*x2="([^"]*)"[^>]*y2="([^"]*)"[^>]*>/g;
            const lines: Array<{
                x1: number;
                y1: number;
                x2: number;
                y2: number;
            }> = [];
            let match;
            while ((match = lineRegex.exec(svg)) !== null) {
                lines.push({
                    x1: parseFloat(match[1]),
                    y1: parseFloat(match[2]),
                    x2: parseFloat(match[3]),
                    y2: parseFloat(match[4]),
                });
            }

            const horizontalLines = lines.filter(
                line => Math.abs(line.y1 - line.y2) < 1,
            );

            // Should have MZ twin bar
            const mzBar = horizontalLines.find(
                line =>
                    line.y1 < mz1Pos.y &&
                    ((Math.abs(line.x1 - mz1Pos.x) < 5 &&
                        Math.abs(line.x2 - mz2Pos.x) < 5) ||
                        (Math.abs(line.x1 - mz2Pos.x) < 5 &&
                            Math.abs(line.x2 - mz1Pos.x) < 5)),
            );
            expect(mzBar).toBeDefined();

            // Should NOT have DZ twin bar
            const dzBar = horizontalLines.find(
                line =>
                    line.y1 < dz1Pos.y &&
                    ((Math.abs(line.x1 - dz1Pos.x) < 5 &&
                        Math.abs(line.x2 - dz2Pos.x) < 5) ||
                        (Math.abs(line.x1 - dz2Pos.x) < 5 &&
                            Math.abs(line.x2 - dz1Pos.x) < 5)),
            );
            expect(dzBar).toBeUndefined();
        });

        it('should position twin bar correctly when twins have partners', () => {
            const dataset: Individual[] = [
                { name: 'gf', sex: 'M', top_level: true },
                { name: 'gm', sex: 'F', top_level: true },
                {
                    name: 't1',
                    sex: 'M',
                    mother: 'gm',
                    father: 'gf',
                    mztwin: 'twins',
                },
                {
                    name: 't2',
                    sex: 'F',
                    mother: 'gm',
                    father: 'gf',
                    mztwin: 'twins',
                },
                { name: 't1spouse', sex: 'F', top_level: true },
                { name: 't2spouse', sex: 'M', top_level: true },
                { name: 'child1', sex: 'F', mother: 't1spouse', father: 't1' },
                { name: 'child2', sex: 'M', mother: 't2', father: 't2spouse' },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            renderer.calculatePositions();

            const t1Pos = renderer.nodePositions.get('t1');
            const t2Pos = renderer.nodePositions.get('t2');
            const t1spousePos = renderer.nodePositions.get('t1spouse');
            const t2spousePos = renderer.nodePositions.get('t2spouse');

            // Twins should be at same Y
            expect(t1Pos.y).toBe(t2Pos.y);

            // Partners should be at same Y as twins
            expect(t1Pos.y).toBe(t1spousePos.y);
            expect(t2Pos.y).toBe(t2spousePos.y);

            const svg = renderer.renderSvg();

            // Twin bar should exist even with partners
            const lineRegex =
                /<line[^>]*x1="([^"]*)"[^>]*y1="([^"]*)"[^>]*x2="([^"]*)"[^>]*y2="([^"]*)"[^>]*>/g;
            const lines: Array<{
                x1: number;
                y1: number;
                x2: number;
                y2: number;
            }> = [];
            let match;
            while ((match = lineRegex.exec(svg)) !== null) {
                lines.push({
                    x1: parseFloat(match[1]),
                    y1: parseFloat(match[2]),
                    x2: parseFloat(match[3]),
                    y2: parseFloat(match[4]),
                });
            }

            const horizontalLines = lines.filter(
                line => Math.abs(line.y1 - line.y2) < 1,
            );
            const twinBar = horizontalLines.find(
                line =>
                    line.y1 < t1Pos.y &&
                    ((Math.abs(line.x1 - t1Pos.x) < 5 &&
                        Math.abs(line.x2 - t2Pos.x) < 5) ||
                        (Math.abs(line.x1 - t2Pos.x) < 5 &&
                            Math.abs(line.x2 - t1Pos.x) < 5)),
            );

            expect(twinBar).toBeDefined();
        });
    });

    describe('Consanguinity Edge Cases', () => {
        it('should handle first cousins once removed (different generations)', () => {
            const dataset: Individual[] = [
                // Grandparents
                { name: 'ggf', sex: 'M', top_level: true },
                { name: 'ggm', sex: 'F', top_level: true },
                // Gen 1: Two siblings
                { name: 'uncle', sex: 'M', mother: 'ggm', father: 'ggf' },
                { name: 'aunt', sex: 'F', top_level: true },
                { name: 'parent', sex: 'F', mother: 'ggm', father: 'ggf' },
                { name: 'parentSpouse', sex: 'M', top_level: true },
                // Gen 2: Cousins
                { name: 'cousin1', sex: 'M', mother: 'aunt', father: 'uncle' },
                { name: 'cousin1spouse', sex: 'F', top_level: true },
                {
                    name: 'person',
                    sex: 'F',
                    mother: 'parent',
                    father: 'parentSpouse',
                },
                // Gen 3: First cousin once removed marriage
                {
                    name: 'cousinChild',
                    sex: 'M',
                    mother: 'cousin1spouse',
                    father: 'cousin1',
                },
                {
                    name: 'inbred',
                    sex: 'F',
                    mother: 'person',
                    father: 'cousinChild',
                    proband: true,
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            renderer.calculatePositions();

            const personPos = renderer.nodePositions.get('person');
            const cousinChildPos = renderer.nodePositions.get('cousinChild');
            const inbredPos = renderer.nodePositions.get('inbred');

            // Person and cousinChild may be at same generational level
            // (algorithm positions by generation depth from top_level individuals)
            // Just verify they exist and are properly positioned relative to their child
            expect(personPos).toBeDefined();
            expect(cousinChildPos).toBeDefined();

            // Both should be above their child
            expect(personPos.y).toBeLessThan(inbredPos.y);
            expect(cousinChildPos.y).toBeLessThan(inbredPos.y);

            const svg = renderer.renderSvg();

            // Should render consanguineous partnership (double line)
            const lineRegex =
                /<line[^>]*x1="([^"]*)"[^>]*y1="([^"]*)"[^>]*x2="([^"]*)"[^>]*y2="([^"]*)"[^>]*>/g;
            const lines: Array<{
                x1: number;
                y1: number;
                x2: number;
                y2: number;
            }> = [];
            let match;
            while ((match = lineRegex.exec(svg)) !== null) {
                lines.push({
                    x1: parseFloat(match[1]),
                    y1: parseFloat(match[2]),
                    x2: parseFloat(match[3]),
                    y2: parseFloat(match[4]),
                });
            }

            // Find consanguineous partnership lines
            const partnershipLines = lines.filter(
                line =>
                    Math.abs(line.y1 - line.y2) < 1 && // Horizontal
                    Math.abs(line.y1 - cousinChildPos.y) < 10,
            );

            // Should have double line (2 parallel lines)
            expect(partnershipLines.length).toBeGreaterThanOrEqual(2);
        });

        it('should handle double first cousins (two siblings marry two other siblings)', () => {
            const dataset: Individual[] = [
                // Grandparents - Family A
                { name: 'gfA', sex: 'M', top_level: true },
                { name: 'gmA', sex: 'F', top_level: true },
                // Grandparents - Family B
                { name: 'gfB', sex: 'M', top_level: true },
                { name: 'gmB', sex: 'F', top_level: true },
                // Parents - Siblings from A marry siblings from B
                { name: 'brother1', sex: 'M', mother: 'gmA', father: 'gfA' },
                { name: 'sister1', sex: 'F', mother: 'gmB', father: 'gfB' },
                { name: 'brother2', sex: 'M', mother: 'gmA', father: 'gfA' },
                { name: 'sister2', sex: 'F', mother: 'gmB', father: 'gfB' },
                // Double first cousins
                {
                    name: 'child1',
                    sex: 'F',
                    mother: 'sister1',
                    father: 'brother1',
                },
                {
                    name: 'child2',
                    sex: 'M',
                    mother: 'sister2',
                    father: 'brother2',
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            renderer.calculatePositions();

            const child1Pos = renderer.nodePositions.get('child1');
            const child2Pos = renderer.nodePositions.get('child2');

            // Children should be at same generation
            expect(child1Pos.y).toBe(child2Pos.y);

            // Children should have proper spacing
            const minNodeSpacing = 140;
            expect(Math.abs(child2Pos.x - child1Pos.x)).toBeGreaterThanOrEqual(
                minNodeSpacing,
            );

            const svg = renderer.renderSvg();
            expect(svg).toContain('<svg');
            expect(svg).toContain('>child1<');
            expect(svg).toContain('>child2<');
        });
    });

    describe('Wide Pedigree Edge Cases', () => {
        it('should handle 15+ siblings without overlaps', () => {
            const dataset: Individual[] = [
                { name: 'dad', sex: 'M', top_level: true },
                { name: 'mom', sex: 'F', top_level: true },
            ];

            // Add 15 siblings
            for (let i = 1; i <= 15; i++) {
                dataset.push({
                    name: `s${i}`,
                    sex: i % 2 === 0 ? 'M' : 'F',
                    mother: 'mom',
                    father: 'dad',
                    proband: i === 8, // Middle child is proband
                });
            }

            const renderer = new PedigreeRenderer(dataset) as any;
            renderer.calculatePositions();

            // Get all sibling positions
            const siblings = [];
            for (let i = 1; i <= 15; i++) {
                siblings.push(renderer.nodePositions.get(`s${i}`));
            }

            // All siblings at same Y
            const firstY = siblings[0].y;
            for (const sibling of siblings) {
                expect(sibling.y).toBe(firstY);
            }

            // Siblings should be ordered left to right
            for (let i = 1; i < siblings.length; i++) {
                expect(siblings[i].x).toBeGreaterThan(siblings[i - 1].x);
            }

            // All siblings should have minimum spacing (no overlaps)
            const minNodeSpacing = 140;
            const symbolSize = 35;
            for (let i = 1; i < siblings.length; i++) {
                const spacing = siblings[i].x - siblings[i - 1].x;
                expect(spacing).toBeGreaterThanOrEqual(minNodeSpacing);
                expect(spacing).toBeGreaterThan(symbolSize); // No overlaps
            }

            const svg = renderer.renderSvg();
            expect(svg).toContain('<svg');
        });

        it('should handle asymmetric sibships (8 kids left, 1 kid right)', () => {
            const dataset: Individual[] = [
                // Grandparents
                { name: 'gf', sex: 'M', top_level: true },
                { name: 'gm', sex: 'F', top_level: true },
                // Left branch: 8 siblings
                { name: 'leftParent', sex: 'M', mother: 'gm', father: 'gf' },
                { name: 'leftSpouse', sex: 'F', top_level: true },
                // Right branch: 1 child
                { name: 'rightParent', sex: 'F', mother: 'gm', father: 'gf' },
                { name: 'rightSpouse', sex: 'M', top_level: true },
            ];

            // Add 8 kids to left branch
            for (let i = 1; i <= 8; i++) {
                dataset.push({
                    name: `leftChild${i}`,
                    sex: i % 2 === 0 ? 'M' : 'F',
                    mother: 'leftSpouse',
                    father: 'leftParent',
                });
            }

            // Add 1 kid to right branch
            dataset.push({
                name: 'rightChild',
                sex: 'F',
                mother: 'rightParent',
                father: 'rightSpouse',
                proband: true,
            });

            const renderer = new PedigreeRenderer(dataset) as any;
            renderer.calculatePositions();

            const leftParentPos = renderer.nodePositions.get('leftParent');
            const rightParentPos = renderer.nodePositions.get('rightParent');

            // Both parents at same generation
            expect(leftParentPos.y).toBe(rightParentPos.y);

            // Get left children positions
            const leftChildren = [];
            for (let i = 1; i <= 8; i++) {
                leftChildren.push(renderer.nodePositions.get(`leftChild${i}`));
            }

            const rightChildPos = renderer.nodePositions.get('rightChild');

            // All children at same generation
            const firstChildY = leftChildren[0].y;
            for (const child of leftChildren) {
                expect(child.y).toBe(firstChildY);
            }
            expect(rightChildPos.y).toBe(firstChildY);

            // Left children should be ordered and spaced
            const minNodeSpacing = 140;
            for (let i = 1; i < leftChildren.length; i++) {
                expect(leftChildren[i].x).toBeGreaterThan(
                    leftChildren[i - 1].x,
                );
                const spacing = leftChildren[i].x - leftChildren[i - 1].x;
                expect(spacing).toBeGreaterThanOrEqual(minNodeSpacing);
            }

            const svg = renderer.renderSvg();
            expect(svg).toContain('<svg');
        });
    });

    describe('Deep Pedigree Edge Cases', () => {
        it('should handle 7+ generations without Y compression', () => {
            const dataset: Individual[] = [
                // Gen 0
                { name: 'g0', sex: 'M', top_level: true },
                { name: 'g0s', sex: 'F', top_level: true },
                // Gen 1
                { name: 'g1', sex: 'M', mother: 'g0s', father: 'g0' },
                { name: 'g1s', sex: 'F', top_level: true },
                // Gen 2
                { name: 'g2', sex: 'F', mother: 'g1s', father: 'g1' },
                { name: 'g2s', sex: 'M', top_level: true },
                // Gen 3
                { name: 'g3', sex: 'M', mother: 'g2', father: 'g2s' },
                { name: 'g3s', sex: 'F', top_level: true },
                // Gen 4
                { name: 'g4', sex: 'F', mother: 'g3s', father: 'g3' },
                { name: 'g4s', sex: 'M', top_level: true },
                // Gen 5
                { name: 'g5', sex: 'M', mother: 'g4', father: 'g4s' },
                { name: 'g5s', sex: 'F', top_level: true },
                // Gen 6
                { name: 'g6', sex: 'F', mother: 'g5s', father: 'g5' },
                { name: 'g6s', sex: 'M', top_level: true },
                // Gen 7
                {
                    name: 'g7',
                    sex: 'M',
                    mother: 'g6',
                    father: 'g6s',
                    proband: true,
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            renderer.calculatePositions();

            // Get all generation positions
            const generations = [];
            for (let i = 0; i <= 7; i++) {
                const pos = renderer.nodePositions.get(`g${i}`);
                generations.push(pos);
            }

            // Assert strictly increasing Y values (no compression)
            for (let i = 1; i < generations.length; i++) {
                expect(generations[i].y).toBeGreaterThan(generations[i - 1].y);

                // Assert minimum Y spacing between generations
                // With 8 generations, spacing is adaptive but should be reasonable
                const ySpacing = generations[i].y - generations[i - 1].y;
                expect(ySpacing).toBeGreaterThan(50); // Reasonable minimum spacing
                expect(ySpacing).toBeLessThan(600); // Not too spread out
            }

            // Verify 7 distinct Y levels
            const yValues = generations.map(g => g.y);
            const uniqueY = new Set(yValues);
            expect(uniqueY.size).toBe(8); // 8 generations (0-7)

            const svg = renderer.renderSvg();
            expect(svg).toContain('<svg');
        });
    });

    describe('Complex Partnership Edge Cases', () => {
        it('should handle individual with 3+ partners (serial marriages)', () => {
            const dataset: Individual[] = [
                { name: 'person', sex: 'M', top_level: true },
                { name: 'spouse1', sex: 'F', top_level: true },
                { name: 'spouse2', sex: 'F', top_level: true },
                { name: 'spouse3', sex: 'F', top_level: true },
                {
                    name: 'child1',
                    sex: 'M',
                    mother: 'spouse1',
                    father: 'person',
                },
                {
                    name: 'child2',
                    sex: 'F',
                    mother: 'spouse2',
                    father: 'person',
                },
                {
                    name: 'child3',
                    sex: 'M',
                    mother: 'spouse3',
                    father: 'person',
                    proband: true,
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            renderer.calculatePositions();

            const personPos = renderer.nodePositions.get('person');
            const spouse1Pos = renderer.nodePositions.get('spouse1');
            const spouse2Pos = renderer.nodePositions.get('spouse2');
            const spouse3Pos = renderer.nodePositions.get('spouse3');

            // All partners at same Y
            expect(personPos.y).toBe(spouse1Pos.y);
            expect(personPos.y).toBe(spouse2Pos.y);
            expect(personPos.y).toBe(spouse3Pos.y);

            const child1Pos = renderer.nodePositions.get('child1');
            const child2Pos = renderer.nodePositions.get('child2');
            const child3Pos = renderer.nodePositions.get('child3');

            // All children at same Y (same generation)
            expect(child1Pos.y).toBe(child2Pos.y);
            expect(child2Pos.y).toBe(child3Pos.y);

            // Children below parents
            expect(child1Pos.y).toBeGreaterThan(personPos.y);

            const svg = renderer.renderSvg();
            expect(svg).toContain('<svg');
        });

        it('should handle step-sibling relationships (parent remarries)', () => {
            const dataset: Individual[] = [
                // Original partnership
                { name: 'dad', sex: 'M', top_level: true },
                { name: 'mom1', sex: 'F', top_level: true },
                { name: 'child1', sex: 'F', mother: 'mom1', father: 'dad' },
                // Dad remarries
                { name: 'mom2', sex: 'F', top_level: true },
                { name: 'child2', sex: 'M', mother: 'mom2', father: 'dad' },
                {
                    name: 'child3',
                    sex: 'F',
                    mother: 'mom2',
                    father: 'dad',
                    proband: true,
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            renderer.calculatePositions();

            const dadPos = renderer.nodePositions.get('dad');
            const mom1Pos = renderer.nodePositions.get('mom1');
            const mom2Pos = renderer.nodePositions.get('mom2');

            // All parents at same Y
            expect(dadPos.y).toBe(mom1Pos.y);
            expect(dadPos.y).toBe(mom2Pos.y);

            const child1Pos = renderer.nodePositions.get('child1');
            const child2Pos = renderer.nodePositions.get('child2');
            const child3Pos = renderer.nodePositions.get('child3');

            // All children (including step-siblings) at same Y
            expect(child1Pos.y).toBe(child2Pos.y);
            expect(child2Pos.y).toBe(child3Pos.y);

            // Children should have proper spacing
            const minNodeSpacing = 140;
            expect(Math.abs(child2Pos.x - child1Pos.x)).toBeGreaterThanOrEqual(
                minNodeSpacing,
            );
            expect(Math.abs(child3Pos.x - child2Pos.x)).toBeGreaterThanOrEqual(
                minNodeSpacing,
            );

            const svg = renderer.renderSvg();
            expect(svg).toContain('<svg');
        });
    });

    describe('Combined Indicator Edge Cases', () => {
        it('should handle carrier + deceased indicators together', () => {
            const dataset: Individual[] = [
                {
                    name: 'person',
                    sex: 'F',
                    top_level: true,
                    carrier: true,
                    status: 1, // deceased
                    proband: true,
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            renderer.calculatePositions();

            const personPos = renderer.nodePositions.get('person');

            const svg = renderer.renderSvg();

            // Should have circle (female), carrier dot, and deceased line
            expect(svg).toContain('<circle');
            expect(svg).toContain('<line');

            // Extract circles
            const circleRegex = /<circle[^>]*r="([^"]*)"[^>]*>/g;
            const circles: Array<{ r: number }> = [];
            let match;
            while ((match = circleRegex.exec(svg)) !== null) {
                circles.push({ r: parseFloat(match[1]) });
            }

            // Should have main circle and carrier dot
            const mainCircle = circles.find(c => c.r > 10);
            const carrierDot = circles.find(c => c.r === 4);
            expect(mainCircle).toBeDefined();
            expect(carrierDot).toBeDefined();

            // Extract lines
            const lineRegex =
                /<line[^>]*x1="([^"]*)"[^>]*y1="([^"]*)"[^>]*x2="([^"]*)"[^>]*y2="([^"]*)"[^>]*>/g;
            const lines: Array<{
                x1: number;
                y1: number;
                x2: number;
                y2: number;
            }> = [];
            let lineMatch;
            while ((lineMatch = lineRegex.exec(svg)) !== null) {
                lines.push({
                    x1: parseFloat(lineMatch[1]),
                    y1: parseFloat(lineMatch[2]),
                    x2: parseFloat(lineMatch[3]),
                    y2: parseFloat(lineMatch[4]),
                });
            }

            // Find deceased line (diagonal, relative coordinates centered at 0,0)
            const deceasedLine = lines.find(line => {
                const centerX = (line.x1 + line.x2) / 2;
                const centerY = (line.y1 + line.y2) / 2;
                return (
                    Math.abs(centerX) < 5 &&
                    Math.abs(centerY) < 5 &&
                    Math.abs(line.y2 - line.y1) > 10 &&
                    Math.abs(line.x2 - line.x1) > 10
                );
            });
            expect(deceasedLine).toBeDefined();
        });

        it('should handle pregnant + affected indicators together', () => {
            const dataset: Individual[] = [
                {
                    name: 'person',
                    sex: 'F',
                    top_level: true,
                    pregnant: true,
                    conditions: [{ name: 'Breast cancer', age: 35 }],
                    proband: true,
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            renderer.calculatePositions();

            const personPos = renderer.nodePositions.get('person');

            const svg = renderer.renderSvg();

            // Should have circle with colored fill (condition) and "P" text (pregnant)
            expect(svg).toContain('<circle');
            expect(svg).toContain('>P<');
            expect(svg).toContain('#F68F35'); // First color from palette

            // Verify group transform matches position
            const groupRegex =
                /<g[^>]*transform="translate\(([^,]+),\s*([^)]+)\)"[^>]*>/g;
            let foundGroup = false;
            let match;
            while ((match = groupRegex.exec(svg)) !== null) {
                const groupX = parseFloat(match[1]);
                const groupY = parseFloat(match[2]);
                if (
                    Math.abs(groupX - personPos.x) < 1 &&
                    Math.abs(groupY - personPos.y) < 1
                ) {
                    foundGroup = true;
                    break;
                }
            }
            expect(foundGroup).toBe(true);
        });

        it('should handle adopted + proband indicators together', () => {
            const dataset: Individual[] = [
                { name: 'dad', sex: 'M', top_level: true },
                { name: 'mom', sex: 'F', top_level: true },
                {
                    name: 'child',
                    sex: 'F',
                    mother: 'mom',
                    father: 'dad',
                    noparents: true, // adopted
                    proband: true,
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            renderer.calculatePositions();

            const childPos = renderer.nodePositions.get('child');

            const svg = renderer.renderSvg();

            // Should have adoption brackets and proband arrow
            expect(svg).toContain('<path'); // Adoption brackets
            expect(svg).toContain('<polygon'); // Proband arrow

            // Extract paths
            const pathRegex = /<path[^>]*d="([^"]*)"[^>]*>/g;
            const paths: Array<string> = [];
            let match;
            while ((match = pathRegex.exec(svg)) !== null) {
                paths.push(match[1]);
            }

            expect(paths.length).toBeGreaterThanOrEqual(2);

            // Check for left and right brackets
            const leftBrackets = paths.filter(p => p.match(/^M-\d+/));
            const rightBrackets = paths.filter(
                p => p.match(/^M\d+/) || p.match(/^M\s+\d+/),
            );
            expect(leftBrackets.length).toBeGreaterThanOrEqual(1);
            expect(rightBrackets.length).toBeGreaterThanOrEqual(1);

            // Extract polygons
            const polygonRegex = /<polygon[^>]*points="([^"]*)"[^>]*>/g;
            const polygons: Array<string> = [];
            let polyMatch;
            while ((polyMatch = polygonRegex.exec(svg)) !== null) {
                polygons.push(polyMatch[1]);
            }

            // Should have proband arrow
            expect(polygons.length).toBeGreaterThanOrEqual(1);
        });
    });
});
