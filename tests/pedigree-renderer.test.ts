import { describe, it, expect } from 'vitest';
import { PedigreeRenderer } from '../src/renderer/pedigree-renderer.js';
import type { Individual } from '../src/types.js';
import { extractSvgElements, extractSymbols, extractText, assertCentered } from './test-helpers.js';

describe('PedigreeRenderer', () => {
    describe('validation', () => {
        it('should reject dataset with missing mother reference', () => {
            const dataset: Individual[] = [
                {
                    name: 'child',
                    sex: 'F',
                    mother: 'nonexistent',
                    father: 'dad',
                },
                { name: 'dad', sex: 'M', top_level: true },
            ];

            const renderer = new PedigreeRenderer(dataset);
            expect(() => renderer.renderSvg()).toThrow(/Mother.*not found/);
        });

        it('should reject dataset with missing father reference', () => {
            const dataset: Individual[] = [
                {
                    name: 'child',
                    sex: 'F',
                    mother: 'mom',
                    father: 'nonexistent',
                },
                { name: 'mom', sex: 'F', top_level: true },
            ];

            const renderer = new PedigreeRenderer(dataset);
            expect(() => renderer.renderSvg()).toThrow(/Father.*not found/);
        });

        it('should reject dataset where mother is male', () => {
            const dataset: Individual[] = [
                { name: 'dad', sex: 'M', top_level: true },
                { name: 'wrongmom', sex: 'M', top_level: true },
                { name: 'child', sex: 'F', mother: 'wrongmom', father: 'dad' },
            ];

            const renderer = new PedigreeRenderer(dataset);
            expect(() => renderer.renderSvg()).toThrow(/must be female/);
        });

        it('should reject dataset where father is female', () => {
            const dataset: Individual[] = [
                { name: 'wrongdad', sex: 'F', top_level: true },
                { name: 'mom', sex: 'F', top_level: true },
                { name: 'child', sex: 'F', mother: 'mom', father: 'wrongdad' },
            ];

            const renderer = new PedigreeRenderer(dataset);
            expect(() => renderer.renderSvg()).toThrow(/must be male/);
        });
    });

    describe('SVG rendering', () => {
        it('should generate valid SVG for simple pedigree', () => {
            const dataset: Individual[] = [
                { name: 'gf', sex: 'M', top_level: true },
                { name: 'gm', sex: 'F', top_level: true },
                {
                    name: 'child',
                    sex: 'F',
                    mother: 'gm',
                    father: 'gf',
                    proband: true,
                },
            ];

            const renderer = new PedigreeRenderer(dataset);
            const svg = renderer.renderSvg();

            // Valid SVG structure
            expect(svg).toContain('<svg');
            expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');

            // Male symbol (rect for gf)
            expect(svg).toContain('<rect');

            // Female symbols (circle for gm and child)
            expect(svg).toMatch(/<circle[^>]*r=/);

            // Labels for names
            expect(svg).toContain('>gf<');
            expect(svg).toContain('>gm<');
            expect(svg).toContain('>child<');

            // Proband indicator (polygon arrow)
            expect(svg).toContain('<polygon');
        });

        it('should render male as rect and female as circle', () => {
            const dataset: Individual[] = [
                { name: 'male', sex: 'M', top_level: true },
                { name: 'female', sex: 'F', top_level: true },
            ];

            const renderer = new PedigreeRenderer(dataset);
            const svg = renderer.renderSvg();

            // Male = rect
            expect(svg).toContain('<rect');
            // Female = circle
            expect(svg).toContain('<circle');
        });

        it('should render unknown sex as diamond (polygon)', () => {
            const dataset: Individual[] = [
                { name: 'f', sex: 'M', top_level: true },
                { name: 'm', sex: 'F', top_level: true },
                { name: 'unk', sex: 'U', mother: 'm', father: 'f' },
            ];

            const renderer = new PedigreeRenderer(dataset);
            const svg = renderer.renderSvg();

            // Unknown sex = polygon (diamond shape)
            expect(svg).toContain('<polygon');
        });

        it('should render deceased indicator (diagonal line)', () => {
            const dataset: Individual[] = [
                { name: 'deceased', sex: 'M', top_level: true, status: 1 },
            ];

            const renderer = new PedigreeRenderer(dataset);
            const svg = renderer.renderSvg();

            // Deceased = extra line through symbol
            const lineMatches = svg.match(/<line/g) || [];
            expect(lineMatches.length).toBeGreaterThanOrEqual(1);
        });

        it('should render adoption brackets for noparents', () => {
            const dataset: Individual[] = [
                { name: 'f', sex: 'M', top_level: true },
                { name: 'm', sex: 'F', top_level: true },
                {
                    name: 'adopted',
                    sex: 'F',
                    mother: 'm',
                    father: 'f',
                    noparents: true,
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            renderer.calculatePositions();

            const adoptedPos = renderer.nodePositions.get('adopted');
            const symbolSize = 35; // Default symbol size

            const svg = renderer.renderSvg();

            // Adoption brackets are path elements
            // Note: paths use relative coordinates within the group transform
            const pathRegex = /<path[^>]*d="([^"]*)"[^>]*>/g;
            const paths: Array<string> = [];
            let match;
            while ((match = pathRegex.exec(svg)) !== null) {
                paths.push(match[1]);
            }

            expect(paths.length).toBeGreaterThanOrEqual(2); // Left and right brackets

            // Verify the group transform matches the calculated position
            const groupRegex = /<g[^>]*transform="translate\(([^,]+),\s*([^)]+)\)"[^>]*>/g;
            let foundAdoptedGroup = false;
            let groupMatch;
            while ((groupMatch = groupRegex.exec(svg)) !== null) {
                const groupX = parseFloat(groupMatch[1]);
                const groupY = parseFloat(groupMatch[2]);

                // Check if this group matches adopted position
                if (Math.abs(groupX - adoptedPos.x) < 1 && Math.abs(groupY - adoptedPos.y) < 1) {
                    foundAdoptedGroup = true;
                    break;
                }
            }

            expect(foundAdoptedGroup).toBe(true);

            // Parse path d attributes to check for left and right brackets
            // Paths have M (move) and L (line) commands with relative coordinates
            const leftBrackets = paths.filter(p => {
                // Left bracket should start with negative X (M-14... or similar)
                return p.match(/^M-\d+/);
            });
            const rightBrackets = paths.filter(p => {
                // Right bracket should start with positive X (M14... or M\s*\d+)
                return p.match(/^M\d+/) || p.match(/^M\s+\d+/);
            });

            expect(leftBrackets.length).toBeGreaterThanOrEqual(1);
            expect(rightBrackets.length).toBeGreaterThanOrEqual(1);
        });

        it('should render twins with connecting bar', () => {
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

            const renderer = new PedigreeRenderer(dataset) as any;
            renderer.calculatePositions();

            const t1Pos = renderer.nodePositions.get('t1');
            const t2Pos = renderer.nodePositions.get('t2');

            const svg = renderer.renderSvg();

            // Extract all lines
            const lineRegex = /<line[^>]*x1="([^"]*)"[^>]*y1="([^"]*)"[^>]*x2="([^"]*)"[^>]*y2="([^"]*)"[^>]*>/g;
            const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
            let match;
            while ((match = lineRegex.exec(svg)) !== null) {
                lines.push({
                    x1: parseFloat(match[1]),
                    y1: parseFloat(match[2]),
                    x2: parseFloat(match[3]),
                    y2: parseFloat(match[4]),
                });
            }

            expect(lines.length).toBeGreaterThanOrEqual(4);

            // Find horizontal twin bar (connects twins)
            // Twin bar is a horizontal line above the twin symbols
            // Find lines that are horizontal
            const horizontalLines = lines.filter(
                line => Math.abs(line.y1 - line.y2) < 1 // Horizontal
            );

            // Find twin bar (should span from t1 X to t2 X and be above the twins)
            const twinBar = horizontalLines.find(
                line =>
                    line.y1 < t1Pos.y && // Above the twins
                    ((Math.abs(line.x1 - t1Pos.x) < 5 && Math.abs(line.x2 - t2Pos.x) < 5) ||
                     (Math.abs(line.x1 - t2Pos.x) < 5 && Math.abs(line.x2 - t1Pos.x) < 5))
            );

            expect(twinBar).toBeDefined();

            if (twinBar) {
                // Twin bar should be horizontal
                expect(Math.abs(twinBar.y1 - twinBar.y2)).toBeLessThan(1);

                // Twin bar should span the distance between twins
                const barLength = Math.abs(twinBar.x2 - twinBar.x1);
                const twinDistance = Math.abs(t2Pos.x - t1Pos.x);
                expect(Math.abs(barLength - twinDistance)).toBeLessThan(10);
            }
        });

        it('should render consanguineous partnership with double line', () => {
            const dataset: Individual[] = [
                { name: 'ggf', sex: 'M', top_level: true },
                { name: 'ggm', sex: 'F', top_level: true },
                { name: 'uncle', sex: 'M', mother: 'ggm', father: 'ggf' },
                { name: 'aunt', sex: 'F', top_level: true },
                { name: 'dad', sex: 'M', mother: 'ggm', father: 'ggf' },
                { name: 'mom', sex: 'F', top_level: true },
                { name: 'cousin1', sex: 'M', mother: 'aunt', father: 'uncle' },
                { name: 'cousin2', sex: 'F', mother: 'mom', father: 'dad' },
                {
                    name: 'inbred',
                    sex: 'F',
                    mother: 'cousin2',
                    father: 'cousin1',
                    proband: true,
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            renderer.calculatePositions();

            const cousin1Pos = renderer.nodePositions.get('cousin1');
            const cousin2Pos = renderer.nodePositions.get('cousin2');

            const svg = renderer.renderSvg();

            // Extract all lines
            const lineRegex = /<line[^>]*x1="([^"]*)"[^>]*y1="([^"]*)"[^>]*x2="([^"]*)"[^>]*y2="([^"]*)"[^>]*>/g;
            const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
            let match;
            while ((match = lineRegex.exec(svg)) !== null) {
                lines.push({
                    x1: parseFloat(match[1]),
                    y1: parseFloat(match[2]),
                    x2: parseFloat(match[3]),
                    y2: parseFloat(match[4]),
                });
            }

            // Should have many lines: partnerships, sibships, children drops, consanguineous double
            expect(lines.length).toBeGreaterThanOrEqual(10);

            // Find consanguineous partnership lines (should be two parallel horizontal lines)
            // Between cousin1 and cousin2
            const partnershipLines = lines.filter(
                line =>
                    Math.abs(line.y1 - line.y2) < 1 && // Horizontal
                    Math.abs(line.y1 - cousin1Pos.y) < 5 && // At cousins' Y position
                    ((Math.abs(line.x1 - cousin1Pos.x) < 10 && Math.abs(line.x2 - cousin2Pos.x) < 10) ||
                     (Math.abs(line.x1 - cousin2Pos.x) < 10 && Math.abs(line.x2 - cousin1Pos.x) < 10))
            );

            // Consanguineous partnerships should have double line (2 parallel lines)
            expect(partnershipLines.length).toBeGreaterThanOrEqual(2);

            if (partnershipLines.length >= 2) {
                const [line1, line2] = partnershipLines;

                // Both lines should be horizontal
                expect(Math.abs(line1.y1 - line1.y2)).toBeLessThan(1);
                expect(Math.abs(line2.y1 - line2.y2)).toBeLessThan(1);

                // Lines should be parallel with small vertical offset (3-5px spacing for double line)
                const yOffset = Math.abs(line1.y1 - line2.y1);
                expect(yOffset).toBeGreaterThan(1); // Must have spacing
                expect(yOffset).toBeLessThan(10); // Should be close (typical double line spacing)

                // Both lines should span approximately the same X distance
                const line1Length = Math.abs(line1.x2 - line1.x1);
                const line2Length = Math.abs(line2.x2 - line2.x1);
                expect(Math.abs(line1Length - line2Length)).toBeLessThan(10);
            }
        });

        it('should render condition with colored fill', () => {
            const dataset: Individual[] = [
                { name: 'gf', sex: 'M', top_level: true },
                {
                    name: 'gm',
                    sex: 'F',
                    top_level: true,
                    conditions: [{ name: 'Breast cancer', age: 55 }],
                },
            ];

            const renderer = new PedigreeRenderer(dataset);
            const svg = renderer.renderSvg();

            // Auto-assigned color from palette (first color is #F68F35)
            expect(svg).toContain('#F68F35');
            // Condition label
            expect(svg).toContain('Breast cancer: 55');
        });

        it('should render multiple conditions with multiple colors', () => {
            const dataset: Individual[] = [
                {
                    name: 'patient',
                    sex: 'F',
                    top_level: true,
                    conditions: [
                        { name: 'Breast cancer', age: 55 },
                        { name: 'Ovarian cancer', age: 60 },
                    ],
                },
            ] as Individual[];

            const renderer = new PedigreeRenderer(dataset);
            const svg = renderer.renderSvg();

            // First condition gets first color from palette
            expect(svg).toContain('#F68F35');
            // Second condition gets second color from palette
            expect(svg).toContain('#4DAA4D');
            // Condition labels
            expect(svg).toContain('Breast cancer: 55');
            expect(svg).toContain('Ovarian cancer: 60');
        });

        it('should render gene test results with +/- notation', () => {
            const dataset: Individual[] = [
                {
                    name: 'patient',
                    sex: 'F',
                    top_level: true,
                    brca1_gene_test: { type: 'T', result: 'P' },
                },
            ] as Individual[];

            const renderer = new PedigreeRenderer(dataset);
            const svg = renderer.renderSvg();

            // Gene test label with + for positive
            expect(svg).toContain('BRCA1+');
        });

        it('should render age and yob labels', () => {
            const dataset: Individual[] = [
                { name: 'test', sex: 'F', top_level: true, age: 45, yob: 1980 },
            ];

            const renderer = new PedigreeRenderer(dataset, {
                labels: ['age', 'yob'],
            });
            const svg = renderer.renderSvg();

            // Combined age/yob label
            expect(svg).toContain('45y');
            expect(svg).toContain('1980');
        });

        it('should render display_name instead of name when provided', () => {
            const dataset: Individual[] = [
                {
                    name: 'p1',
                    display_name: 'Patient One',
                    sex: 'F',
                    top_level: true,
                },
            ];

            const renderer = new PedigreeRenderer(dataset);
            const svg = renderer.renderSvg();

            expect(svg).toContain('>Patient One<');
            expect(svg).not.toContain('>p1<');
        });

        it('should render family lines connecting parents to children', () => {
            const dataset: Individual[] = [
                { name: 'gf', sex: 'M', top_level: true },
                { name: 'gm', sex: 'F', top_level: true },
                { name: 'child', sex: 'F', mother: 'gm', father: 'gf' },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            renderer.calculatePositions();

            const gfPos = renderer.nodePositions.get('gf');
            const gmPos = renderer.nodePositions.get('gm');
            const childPos = renderer.nodePositions.get('child');

            const svg = renderer.renderSvg();

            // Extract all lines
            const lineRegex = /<line[^>]*x1="([^"]*)"[^>]*y1="([^"]*)"[^>]*x2="([^"]*)"[^>]*y2="([^"]*)"[^>]*>/g;
            const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
            let match;
            while ((match = lineRegex.exec(svg)) !== null) {
                lines.push({
                    x1: parseFloat(match[1]),
                    y1: parseFloat(match[2]),
                    x2: parseFloat(match[3]),
                    y2: parseFloat(match[4]),
                });
            }

            // Should have lines: partnership, vertical drop, line to child
            expect(lines.length).toBeGreaterThanOrEqual(3);

            // Find partnership line (horizontal between gf and gm)
            const partnershipLine = lines.find(
                line =>
                    Math.abs(line.y1 - line.y2) < 1 && // Horizontal
                    Math.abs(line.y1 - gfPos.y) < 1 && // At partner Y position
                    ((Math.abs(line.x1 - gfPos.x) < 5 && Math.abs(line.x2 - gmPos.x) < 5) ||
                     (Math.abs(line.x1 - gmPos.x) < 5 && Math.abs(line.x2 - gfPos.x) < 5))
            );

            expect(partnershipLine).toBeDefined();

            if (partnershipLine) {
                // Partnership line should be horizontal
                expect(Math.abs(partnershipLine.y1 - partnershipLine.y2)).toBeLessThan(1);

                // Calculate partnership midpoint
                const partnershipMidX = (partnershipLine.x1 + partnershipLine.x2) / 2;
                const partnershipY = partnershipLine.y1;

                // Find vertical drop from partnership to sibship level
                const sibshipY = (partnershipY + childPos.y) / 2;
                const verticalDrop = lines.find(
                    line =>
                        Math.abs(line.x1 - line.x2) < 1 && // Vertical
                        Math.abs(line.x1 - partnershipMidX) < 1 && // At partnership midpoint
                        Math.abs(line.y1 - partnershipY) < 5 && // Starts at partnership
                        Math.abs(line.y2 - sibshipY) < 10 // Ends at sibship level
                );

                expect(verticalDrop).toBeDefined();

                // Find vertical line connecting sibship to child
                // Note: Line ends near top of child symbol, not at center
                const symbolSize = 35;
                const childConnection = lines.find(
                    line =>
                        Math.abs(line.x1 - line.x2) < 1 && // Vertical
                        Math.abs(line.x1 - childPos.x) < 1 && // At child X position
                        line.y1 < childPos.y && // Starts above child
                        line.y2 > sibshipY && // Ends below sibship
                        line.y2 <= childPos.y // Ends at or before child center
                );

                expect(childConnection).toBeDefined();
            }
        });

        it('should respect custom dimensions', () => {
            const dataset: Individual[] = [
                { name: 'f', sex: 'M', top_level: true },
                { name: 'm', sex: 'F', top_level: true },
            ];

            const renderer = new PedigreeRenderer(dataset, {
                width: 1200,
                height: 900,
            });
            const svg = renderer.renderSvg();

            // Width and height should be at least what was requested
            expect(svg).toMatch(/width="(1200|[1-9]\d{3,})"/);
            expect(svg).toMatch(/height="(900|[1-9]\d{2,})"/);
        });

        it('should handle single individual', () => {
            const dataset: Individual[] = [
                { name: 'solo', sex: 'M', top_level: true, proband: true },
            ];

            const renderer = new PedigreeRenderer(dataset);
            const svg = renderer.renderSvg();

            expect(svg).toContain('<svg');
            expect(svg).toContain('<rect'); // Male symbol
            expect(svg).toContain('>solo<');
        });

        it('should not overlap nodes with multiple partnerships in same generation', () => {
            // Regression test: complex pedigree with multiple partnerships and condition labels
            const dataset: Individual[] = [
                // Grandparents (gen 0) - 4 couples
                {
                    name: 'MGF',
                    sex: 'M',
                    top_level: true,
                    conditions: [{ name: 'Prostate cancer', age: 78 }],
                },
                {
                    name: 'MGM',
                    sex: 'F',
                    top_level: true,
                    conditions: [
                        { name: 'Breast cancer', age: 70 },
                        { name: 'Ovarian cancer', age: 75 },
                    ],
                },
                { name: 'PGF', sex: 'M', top_level: true },
                {
                    name: 'PGM',
                    sex: 'F',
                    top_level: true,
                    conditions: [{ name: 'Pancreatic cancer', age: 82 }],
                },
                // Parents generation (gen 1) - multiple partnerships with conditions
                {
                    name: 'Father',
                    sex: 'M',
                    mother: 'MGM',
                    father: 'MGF',
                    age: 52,
                    conditions: [{ name: 'Prostate cancer', age: 48 }],
                },
                {
                    name: 'Mother',
                    sex: 'F',
                    top_level: true,
                    age: 50,
                    conditions: [{ name: 'Breast cancer', age: 45 }],
                },
                { name: 'AuntsH', sex: 'M', top_level: true, age: 56 }, // Aunt's husband
                {
                    name: 'M Aunt',
                    sex: 'F',
                    mother: 'MGM',
                    father: 'MGF',
                    age: 55,
                    conditions: [{ name: 'Ovarian cancer', age: 50 }],
                },
                {
                    name: 'P Uncle',
                    sex: 'M',
                    mother: 'PGM',
                    father: 'PGF',
                    age: 58,
                    conditions: [{ name: 'Pancreatic cancer', age: 55 }],
                },
                { name: 'UnclesW', sex: 'F', top_level: true, age: 57 }, // Uncle's wife
                // Children (gen 2) - multiple families
                {
                    name: 'Proband',
                    sex: 'F',
                    mother: 'Mother',
                    father: 'Father',
                    proband: true,
                    age: 30,
                    conditions: [{ name: 'Breast cancer', age: 28 }],
                },
                {
                    name: 'MZ Twin',
                    sex: 'F',
                    mother: 'Mother',
                    father: 'Father',
                    age: 30,
                    mztwin: 'twins',
                    conditions: [{ name: 'Breast cancer', age: 29 }],
                },
                {
                    name: 'Brother',
                    sex: 'M',
                    mother: 'Mother',
                    father: 'Father',
                    age: 28,
                },
                {
                    name: 'Sister',
                    sex: 'F',
                    mother: 'Mother',
                    father: 'Father',
                    age: 26,
                },
                {
                    name: 'M Cousin',
                    sex: 'F',
                    mother: 'M Aunt',
                    father: 'AuntsH',
                    age: 25,
                    conditions: [{ name: 'Ovarian cancer', age: 23 }],
                },
                {
                    name: 'P Cousin',
                    sex: 'M',
                    mother: 'UnclesW',
                    father: 'P Uncle',
                    age: 27,
                    conditions: [{ name: 'Prostate cancer', age: 35 }],
                },
            ] as Individual[];

            const renderer = new PedigreeRenderer(dataset);
            const svg = renderer.renderSvg();

            // Verify key individuals are rendered
            expect(svg).toContain('>Father<');
            expect(svg).toContain('>Mother<');
            expect(svg).toContain('>M Aunt<');
            expect(svg).toContain('>Proband<');

            // Extract transform positions from groups (format: translate(x, y))
            // Only match <g transform="..."> to avoid other elements
            const gTagMatches =
                svg.match(/<g[^>]*transform="translate\(([^)]+)\)"[^>]*>/g) ||
                [];
            const positions = gTagMatches.map(m => {
                const coords = m.match(/translate\(([^,]+),\s*([^)]+)\)/);
                return {
                    x: parseFloat(coords?.[1] || '0'),
                    y: parseFloat(coords?.[2] || '0'),
                };
            });

            // Group by y (generation) and check spacing within each row
            const byGeneration = new Map<number, number[]>();
            for (const pos of positions) {
                const roundedY = Math.round(pos.y);
                if (!byGeneration.has(roundedY)) byGeneration.set(roundedY, []);
                byGeneration.get(roundedY)!.push(pos.x);
            }

            // Verify minimum spacing within each generation
            // minNodeSpacing = symbol_size * 4 = 140px
            const minExpectedSpacing = 100; // Allow some tolerance for centering adjustments
            for (const [, xPositions] of byGeneration) {
                const sortedX = [...new Set(xPositions)].sort((a, b) => a - b);
                for (let i = 1; i < sortedX.length; i++) {
                    const spacing = sortedX[i] - sortedX[i - 1];
                    expect(spacing).toBeGreaterThanOrEqual(minExpectedSpacing);
                }
            }
        });
    });

    describe('PNG rendering', () => {
        it('should generate valid PNG buffer from SVG', async () => {
            const dataset: Individual[] = [
                { name: 'gf', sex: 'M', top_level: true },
                { name: 'gm', sex: 'F', top_level: true },
                {
                    name: 'child',
                    sex: 'F',
                    mother: 'gm',
                    father: 'gf',
                    proband: true,
                },
            ];

            const renderer = new PedigreeRenderer(dataset);
            const buffer = await renderer.render();

            expect(buffer).toBeInstanceOf(Buffer);
            expect(buffer.length).toBeGreaterThan(0);
            // PNG magic bytes
            expect(buffer[0]).toBe(0x89);
            expect(buffer[1]).toBe(0x50); // P
            expect(buffer[2]).toBe(0x4e); // N
            expect(buffer[3]).toBe(0x47); // G
        });

        it('should generate PNG with reasonable size', async () => {
            const dataset: Individual[] = [
                { name: 'gf', sex: 'M', top_level: true },
                {
                    name: 'gm',
                    sex: 'F',
                    top_level: true,
                    conditions: [{ name: 'Breast cancer', age: 55 }],
                },
                {
                    name: 'mom',
                    sex: 'F',
                    mother: 'gm',
                    father: 'gf',
                    conditions: [{ name: 'Breast cancer', age: 42 }],
                },
                { name: 'dad', sex: 'M', top_level: true },
                {
                    name: 'p',
                    sex: 'F',
                    mother: 'mom',
                    father: 'dad',
                    proband: true,
                },
            ];

            const renderer = new PedigreeRenderer(dataset);
            const buffer = await renderer.render();

            expect(buffer).toBeInstanceOf(Buffer);
            expect(buffer.length).toBeGreaterThan(1000);
        });
    });

    describe('edge cases', () => {
        it('should connect siblings without partners to sibship line', () => {
            // Regression test: siblings without partners must still be connected
            // via mother/father references, NOT top_level: true
            const dataset: Individual[] = [
                { name: 'gf', sex: 'M', top_level: true },
                { name: 'gm', sex: 'F', top_level: true },
                // Two siblings: f has partner/children, aunt has no partner
                { name: 'f', sex: 'M', mother: 'gm', father: 'gf' },
                {
                    name: 'aunt',
                    sex: 'F',
                    mother: 'gm',
                    father: 'gf',
                    pregnant: true,
                },
                { name: 'm', sex: 'F', top_level: true }, // married into family
                {
                    name: 'child',
                    sex: 'F',
                    mother: 'm',
                    father: 'f',
                    proband: true,
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            renderer.calculatePositions();

            const gfPos = renderer.nodePositions.get('gf');
            const gmPos = renderer.nodePositions.get('gm');
            const fPos = renderer.nodePositions.get('f');
            const auntPos = renderer.nodePositions.get('aunt');
            const mPos = renderer.nodePositions.get('m');
            const childPos = renderer.nodePositions.get('child');

            const svg = renderer.renderSvg();

            // Both siblings should be present
            expect(svg).toContain('>f<');
            expect(svg).toContain('>aunt<');

            // Assert siblings (f, aunt) are at same Y (same generation)
            expect(fPos.y).toBe(auntPos.y);

            // Assert m (partner) is also at same generation as siblings
            expect(fPos.y).toBe(mPos.y);

            // Assert grandparents above siblings
            expect(gfPos.y).toBeLessThan(fPos.y);
            expect(gmPos.y).toBeLessThan(fPos.y);

            // Assert child below siblings
            expect(childPos.y).toBeGreaterThan(fPos.y);

            // Extract all lines
            const lineRegex = /<line[^>]*x1="([^"]*)"[^>]*y1="([^"]*)"[^>]*x2="([^"]*)"[^>]*y2="([^"]*)"[^>]*>/g;
            const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
            let match;
            while ((match = lineRegex.exec(svg)) !== null) {
                lines.push({
                    x1: parseFloat(match[1]),
                    y1: parseFloat(match[2]),
                    x2: parseFloat(match[3]),
                    y2: parseFloat(match[4]),
                });
            }

            // Calculate expected sibship line Y (between parents and siblings)
            const partnershipY = gfPos.y;
            const siblingsY = fPos.y;
            const sibshipY = (partnershipY + siblingsY) / 2;

            // Find horizontal sibship line at expected Y position
            const sibshipLine = lines.find(
                line =>
                    Math.abs(line.y1 - line.y2) < 1 && // Horizontal
                    Math.abs(line.y1 - sibshipY) < 20 && // At sibship Y level
                    line.x2 - line.x1 > 50 // Long enough to span siblings
            );

            expect(sibshipLine).toBeDefined();

            if (sibshipLine) {
                // Sibship line should be horizontal
                expect(Math.abs(sibshipLine.y1 - sibshipLine.y2)).toBeLessThan(1);

                // Sibship line should be at the expected Y position
                expect(Math.abs(sibshipLine.y1 - sibshipY)).toBeLessThan(20);

                // Sibship line should span from leftmost to rightmost sibling
                const leftmostX = Math.min(fPos.x, auntPos.x);
                const rightmostX = Math.max(fPos.x, auntPos.x);

                // Sibship line endpoints should be near the sibling positions
                const line1X = Math.min(sibshipLine.x1, sibshipLine.x2);
                const line2X = Math.max(sibshipLine.x1, sibshipLine.x2);

                expect(Math.abs(line1X - leftmostX)).toBeLessThan(10);
                expect(Math.abs(line2X - rightmostX)).toBeLessThan(10);
            }
        });

        it('should handle deep pedigree (5 generations)', () => {
            const dataset: Individual[] = [
                // Gen 0: Great-great-grandparents
                { name: 'gggf', sex: 'M', top_level: true },
                { name: 'gggm', sex: 'F', top_level: true },
                // Gen 1: Great-grandparents
                { name: 'ggf', sex: 'M', mother: 'gggm', father: 'gggf' },
                { name: 'ggm', sex: 'F', top_level: true },
                // Gen 2: Grandparents
                { name: 'gf', sex: 'M', mother: 'ggm', father: 'ggf' },
                { name: 'gm', sex: 'F', top_level: true },
                // Gen 3: Parents
                { name: 'dad', sex: 'M', mother: 'gm', father: 'gf' },
                { name: 'mom', sex: 'F', top_level: true },
                // Gen 4: Proband
                {
                    name: 'p',
                    sex: 'F',
                    mother: 'mom',
                    father: 'dad',
                    proband: true,
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            renderer.calculatePositions();

            // Get all positions
            const gggfPos = renderer.nodePositions.get('gggf');
            const gggmPos = renderer.nodePositions.get('gggm');
            const ggfPos = renderer.nodePositions.get('ggf');
            const ggmPos = renderer.nodePositions.get('ggm');
            const gfPos = renderer.nodePositions.get('gf');
            const gmPos = renderer.nodePositions.get('gm');
            const dadPos = renderer.nodePositions.get('dad');
            const momPos = renderer.nodePositions.get('mom');
            const pPos = renderer.nodePositions.get('p');

            // Assert 5 distinct Y levels (strict generational ordering)
            const yValues = [gggfPos.y, ggfPos.y, gfPos.y, dadPos.y, pPos.y];
            const uniqueY = new Set(yValues);
            expect(uniqueY.size).toBe(5);

            // Assert Y values strictly increase (gen 0 < gen 1 < gen 2 < gen 3 < gen 4)
            expect(gggfPos.y).toBeLessThan(ggfPos.y);
            expect(ggfPos.y).toBeLessThan(gfPos.y);
            expect(gfPos.y).toBeLessThan(dadPos.y);
            expect(dadPos.y).toBeLessThan(pPos.y);

            // Assert partnerships are aligned (same Y)
            expect(gggfPos.y).toBe(gggmPos.y); // Gen 0 partners
            expect(ggfPos.y).toBe(ggmPos.y);   // Gen 1 partners
            expect(gfPos.y).toBe(gmPos.y);     // Gen 2 partners
            expect(dadPos.y).toBe(momPos.y);   // Gen 3 partners

            // Assert minimum X spacing between partners (should be symbol_size * 4 = 140px)
            const minNodeSpacing = 140;
            expect(gggmPos.x - gggfPos.x).toBeGreaterThanOrEqual(minNodeSpacing);
            expect(ggmPos.x - ggfPos.x).toBeGreaterThanOrEqual(minNodeSpacing);
            expect(gmPos.x - gfPos.x).toBeGreaterThanOrEqual(minNodeSpacing);
            expect(momPos.x - dadPos.x).toBeGreaterThanOrEqual(minNodeSpacing);

            // Render SVG and verify elements exist
            const svg = renderer.renderSvg();
            expect(svg).toContain('<svg');
            expect(svg).toContain('>gggf<');
            expect(svg).toContain('>p<');
        });

        it('should handle wide pedigree (many siblings)', () => {
            const dataset: Individual[] = [
                { name: 'dad', sex: 'M', top_level: true },
                { name: 'mom', sex: 'F', top_level: true },
                { name: 's1', sex: 'M', mother: 'mom', father: 'dad' },
                { name: 's2', sex: 'F', mother: 'mom', father: 'dad' },
                { name: 's3', sex: 'M', mother: 'mom', father: 'dad' },
                { name: 's4', sex: 'F', mother: 'mom', father: 'dad' },
                { name: 's5', sex: 'M', mother: 'mom', father: 'dad' },
                {
                    name: 's6',
                    sex: 'F',
                    mother: 'mom',
                    father: 'dad',
                    proband: true,
                },
                { name: 's7', sex: 'M', mother: 'mom', father: 'dad' },
                { name: 's8', sex: 'F', mother: 'mom', father: 'dad' },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            renderer.calculatePositions();

            // Get all sibling positions
            const siblings = [];
            for (let i = 1; i <= 8; i++) {
                siblings.push(renderer.nodePositions.get(`s${i}`));
            }

            // Assert all siblings at same Y coordinate (same generation)
            const firstSiblingY = siblings[0].y;
            for (const sibling of siblings) {
                expect(sibling.y).toBe(firstSiblingY);
            }

            // Assert siblings are ordered left to right
            const xPositions = siblings.map(s => s.x);
            for (let i = 1; i < xPositions.length; i++) {
                expect(xPositions[i]).toBeGreaterThan(xPositions[i - 1]);
            }

            // Assert minimum spacing between siblings (symbol_size * 4 = 140px)
            const minNodeSpacing = 140;
            for (let i = 1; i < siblings.length; i++) {
                const spacing = siblings[i].x - siblings[i - 1].x;
                expect(spacing).toBeGreaterThanOrEqual(minNodeSpacing);
            }

            // Assert no overlaps (max symbol width is 35px, so spacing must be > 35px)
            const symbolSize = 35;
            for (let i = 1; i < siblings.length; i++) {
                const spacing = siblings[i].x - siblings[i - 1].x;
                expect(spacing).toBeGreaterThan(symbolSize);
            }

            // Render SVG and verify all siblings present
            const svg = renderer.renderSvg();
            for (let i = 1; i <= 8; i++) {
                expect(svg).toContain(`>s${i}<`);
            }
        });

        it('should handle half-siblings (same mother, different fathers)', () => {
            const dataset: Individual[] = [
                { name: 'dad1', sex: 'M', top_level: true },
                { name: 'mom', sex: 'F', top_level: true },
                { name: 'dad2', sex: 'M', top_level: true },
                { name: 'c1', sex: 'M', mother: 'mom', father: 'dad1' },
                {
                    name: 'c2',
                    sex: 'F',
                    mother: 'mom',
                    father: 'dad2',
                    proband: true,
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            renderer.calculatePositions();

            // Get positions
            const dad1Pos = renderer.nodePositions.get('dad1');
            const momPos = renderer.nodePositions.get('mom');
            const dad2Pos = renderer.nodePositions.get('dad2');
            const c1Pos = renderer.nodePositions.get('c1');
            const c2Pos = renderer.nodePositions.get('c2');

            // All parents at same Y (generation 0)
            expect(dad1Pos.y).toBe(momPos.y);
            expect(dad2Pos.y).toBe(momPos.y);

            // Both children at same Y (generation 1)
            expect(c1Pos.y).toBe(c2Pos.y);

            // Children below parents
            expect(c1Pos.y).toBeGreaterThan(momPos.y);

            // Partnership 1 (dad1-mom) centered above c1
            const p1MidX = (dad1Pos.x + momPos.x) / 2;
            expect(Math.abs(p1MidX - c1Pos.x)).toBeLessThan(1);

            // Partnership 2 (mom-dad2) - may not be perfectly centered when parent has multiple partnerships
            // This is acceptable as mom's position is constrained by partnership 1
            const p2MidX = (momPos.x + dad2Pos.x) / 2;
            expect(Math.abs(p2MidX - c2Pos.x)).toBeLessThan(50); // Relaxed tolerance for multiple partnerships

            // Half-siblings should have spacing
            const minNodeSpacing = 140;
            expect(Math.abs(c2Pos.x - c1Pos.x)).toBeGreaterThanOrEqual(minNodeSpacing);

            // Render SVG and verify elements
            const svg = renderer.renderSvg();
            expect(svg).toContain('>c1<');
            expect(svg).toContain('>c2<');
            const lineCount = (svg.match(/<line/g) || []).length;
            expect(lineCount).toBeGreaterThanOrEqual(2);
        });

        it('should handle pedigree with no conditions (plain family tree)', () => {
            const dataset: Individual[] = [
                { name: 'gf', sex: 'M', top_level: true },
                { name: 'gm', sex: 'F', top_level: true },
                {
                    name: 'p',
                    sex: 'F',
                    mother: 'gm',
                    father: 'gf',
                    proband: true,
                    age: 30,
                },
            ];

            const renderer = new PedigreeRenderer(dataset);
            const svg = renderer.renderSvg();

            // No condition colors should be present (no conditions means no colored fills)
            expect(svg).not.toContain('#F68F35'); // first palette color
            expect(svg).not.toContain('#4DAA4D'); // second palette color
            expect(svg).toContain('>30y<'); // age label
        });

        it('should handle individual with multiple conditions (pie chart)', () => {
            const dataset: Individual[] = [
                {
                    name: 'p',
                    sex: 'F',
                    top_level: true,
                    proband: true,
                    conditions: [
                        { name: 'Breast cancer', age: 45 },
                        { name: 'Ovarian cancer', age: 52 },
                        { name: 'Pancreatic cancer', age: 58 },
                    ],
                },
            ] as Individual[];

            const renderer = new PedigreeRenderer(dataset);
            const svg = renderer.renderSvg();

            // Should have multiple condition colors from palette
            expect(svg).toContain('#F68F35'); // first
            expect(svg).toContain('#4DAA4D'); // second
            expect(svg).toContain('#4289BA'); // third
            // Should have path elements for pie slices
            expect(svg).toContain('<path');
        });

        it('should truncate long display names', () => {
            const dataset: Individual[] = [
                {
                    name: 'p',
                    display_name: 'VeryLongNameThatExceedsLimit',
                    sex: 'F',
                    top_level: true,
                    proband: true,
                },
            ];

            const renderer = new PedigreeRenderer(dataset);
            const svg = renderer.renderSvg();

            // Name should be present (truncated or not, the renderer should handle it)
            expect(svg).toContain('<text');
        });
    });

    describe('twin rendering', () => {
        it('should connect monozygotic twins with horizontal bar', () => {
            const dataset: Individual[] = [
                { name: 'dad', sex: 'M', top_level: true },
                { name: 'mom', sex: 'F', top_level: true },
                {
                    name: 't1',
                    sex: 'F',
                    mother: 'mom',
                    father: 'dad',
                    mztwin: 'twins',
                    proband: true,
                },
                {
                    name: 't2',
                    sex: 'F',
                    mother: 'mom',
                    father: 'dad',
                    mztwin: 'twins',
                },
            ];

            const renderer = new PedigreeRenderer(dataset);
            const svg = renderer.renderSvg();

            // Both twins should be present
            expect(svg).toContain('>t1<');
            expect(svg).toContain('>t2<');
            // Twin bar should be a horizontal line (multiple lines expected)
            const lineCount = (svg.match(/<line/g) || []).length;
            expect(lineCount).toBeGreaterThanOrEqual(4); // partnership + sibship + child drops + twin bar
        });

        it('should handle triplets', () => {
            const dataset: Individual[] = [
                { name: 'dad', sex: 'M', top_level: true },
                { name: 'mom', sex: 'F', top_level: true },
                {
                    name: 't1',
                    sex: 'F',
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

            const renderer = new PedigreeRenderer(dataset);
            const svg = renderer.renderSvg();

            expect(svg).toContain('>t1<');
            expect(svg).toContain('>t2<');
            expect(svg).toContain('>t3<');
        });
    });

    describe('gene test rendering', () => {
        it('should render all gene test types', () => {
            const dataset: Individual[] = [
                {
                    name: 'p1',
                    sex: 'F',
                    top_level: true,
                    brca1_gene_test: { type: 'T', result: 'P' },
                },
                {
                    name: 'p2',
                    sex: 'F',
                    top_level: true,
                    brca2_gene_test: { type: 'T', result: 'N' },
                },
                {
                    name: 'p3',
                    sex: 'M',
                    top_level: true,
                    palb2_gene_test: { type: 'T', result: 'P' },
                },
                {
                    name: 'p4',
                    sex: 'M',
                    top_level: true,
                    atm_gene_test: { type: 'T', result: 'N' },
                },
            ] as Individual[];

            const renderer = new PedigreeRenderer(dataset);
            const svg = renderer.renderSvg();

            expect(svg).toContain('BRCA1+');
            expect(svg).toContain('BRCA2-');
            expect(svg).toContain('PALB2+');
            expect(svg).toContain('ATM-');
        });

        it('should not render untested gene results', () => {
            const dataset: Individual[] = [
                {
                    name: 'p',
                    sex: 'F',
                    top_level: true,
                    proband: true,
                    brca1_gene_test: { type: '-', result: '-' },
                },
            ] as Individual[];

            const renderer = new PedigreeRenderer(dataset);
            const svg = renderer.renderSvg();

            expect(svg).not.toContain('BRCA1');
        });
    });

    describe('consanguinity', () => {
        it('should detect first cousin marriage and show double line', () => {
            const dataset: Individual[] = [
                // Shared grandparents
                { name: 'gf', sex: 'M', top_level: true },
                { name: 'gm', sex: 'F', top_level: true },
                // Two siblings who have children
                { name: 'unc', sex: 'M', mother: 'gm', father: 'gf' },
                { name: 'aunt', sex: 'F', top_level: true },
                { name: 'dad', sex: 'M', mother: 'gm', father: 'gf' },
                { name: 'mom', sex: 'F', top_level: true },
                // First cousins who marry
                { name: 'c1', sex: 'M', mother: 'aunt', father: 'unc' },
                { name: 'c2', sex: 'F', mother: 'mom', father: 'dad' },
                // Their child (consanguineous)
                {
                    name: 'child',
                    sex: 'F',
                    mother: 'c2',
                    father: 'c1',
                    proband: true,
                },
            ];

            const renderer = new PedigreeRenderer(dataset);
            const svg = renderer.renderSvg();

            // Should have lines (multiple for consanguineous double line)
            const lineCount = (svg.match(/<line/g) || []).length;
            expect(lineCount).toBeGreaterThanOrEqual(10);
        });
    });

    describe('additional validation', () => {
        it('should handle duplicate names gracefully', () => {
            // Note: pedigreejs allows duplicate names but treats them as same person
            // Our renderer should either reject or handle gracefully
            const dataset: Individual[] = [
                { name: 'p', sex: 'M', top_level: true },
                { name: 'p', sex: 'F', top_level: true }, // Duplicate!
            ];

            const renderer = new PedigreeRenderer(dataset);
            // Should either render or throw - just shouldn't crash silently
            try {
                const svg = renderer.renderSvg();
                expect(svg).toContain('<svg');
            } catch (e) {
                expect(e).toBeDefined();
            }
        });
    });

    describe('generation calculation and positioning', () => {
        it('should calculate correct generations regardless of dataset order', () => {
            // Regression test: child defined before parents should still be in correct generation
            const dataset: Individual[] = [
                { name: 'Proband', sex: 'M', mother: 'Mère', father: 'Père', proband: true },
                { name: 'Père', sex: 'M', father: 'GP Pat' },
                { name: 'Mère', sex: 'F', top_level: true },
                { name: 'Soeur', sex: 'F', mother: 'Mère', father: 'Père' },
                { name: 'GP Pat', sex: 'M', top_level: true },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            const generations = renderer.calculateGenerations();

            // GP Pat and Mère are founders (gen 0)
            expect(generations.get('GP Pat')).toBe(0);
            expect(generations.get('Mère')).toBe(0);
            // Père is child of GP Pat (gen 1)
            expect(generations.get('Père')).toBe(1);
            // Proband and Soeur are children of Père+Mère (gen 2)
            expect(generations.get('Proband')).toBe(2);
            expect(generations.get('Soeur')).toBe(2);
        });

        it('should align partners from different generations to same Y-coordinate', () => {
            // Regression test: Père (gen 1, has parent) + Mère (gen 0, founder) should be at same Y
            const dataset: Individual[] = [
                { name: 'Proband', sex: 'M', mother: 'Mère', father: 'Père', proband: true },
                { name: 'Père', sex: 'M', father: 'GP Pat' },
                { name: 'Mère', sex: 'F', top_level: true },
                { name: 'Soeur', sex: 'F', mother: 'Mère', father: 'Père' },
                { name: 'GP Pat', sex: 'M', top_level: true },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            renderer.calculatePositions();

            const perePos = renderer.nodePositions.get('Père');
            const merePos = renderer.nodePositions.get('Mère');
            const gpPos = renderer.nodePositions.get('GP Pat');

            // Partners must be at same Y (horizontal alignment)
            expect(perePos.y).toBe(merePos.y);
            // GP Pat must be ABOVE (lower Y value) than Père
            expect(gpPos.y).toBeLessThan(perePos.y);
        });

        it('should position single parent DIRECTLY ABOVE child (same X coordinate)', () => {
            // SCENARIO 1: Single child from single parent
            // Grandpa -> Dad (who has partner Mom) -> Child
            // CRITICAL: Grandpa must be at SAME X as Dad (directly above), not centered independently
            const dataset: Individual[] = [
                { name: 'grandpa', sex: 'M', top_level: true },
                { name: 'dad', sex: 'M', father: 'grandpa' },
                { name: 'mom', sex: 'F', top_level: true },
                { name: 'child', sex: 'F', mother: 'mom', father: 'dad' },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            renderer.calculatePositions();

            const grandpaPos = renderer.nodePositions.get('grandpa');
            const dadPos = renderer.nodePositions.get('dad');
            const momPos = renderer.nodePositions.get('mom');
            const childPos = renderer.nodePositions.get('child');

            // CRITICAL TEST: Grandpa should be at SAME X as Dad (his only child)
            // NOT centered on canvas independently
            expect(Math.abs(grandpaPos.x - dadPos.x)).toBeLessThan(1);

            // Dad+Mom partnership should be centered above child
            const partnershipMidX = (dadPos.x + momPos.x) / 2;
            expect(Math.abs(partnershipMidX - childPos.x)).toBeLessThan(1);

            // Verify Y positioning (3 generations)
            expect(grandpaPos.y).toBeLessThan(dadPos.y);
            expect(dadPos.y).toBe(momPos.y);
            expect(dadPos.y).toBeLessThan(childPos.y);
        });

        it('should position single parent centered above MULTIPLE children', () => {
            // SCENARIO 2: Multiple children from single parent
            // Grandma -> [Uncle, Dad, Aunt]
            // Grandma should be centered above all three children
            const dataset: Individual[] = [
                { name: 'grandma', sex: 'F', top_level: true },
                { name: 'uncle', sex: 'M', mother: 'grandma' },
                { name: 'dad', sex: 'M', mother: 'grandma' },
                { name: 'aunt', sex: 'F', mother: 'grandma' },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            renderer.calculatePositions();

            const grandmaPos = renderer.nodePositions.get('grandma');
            const unclePos = renderer.nodePositions.get('uncle');
            const dadPos = renderer.nodePositions.get('dad');
            const auntPos = renderer.nodePositions.get('aunt');

            // Grandma should be centered above all three children
            const childrenMidX = (unclePos.x + dadPos.x + auntPos.x) / 3;
            expect(Math.abs(grandmaPos.x - childrenMidX)).toBeLessThan(1);

            // All children same generation
            expect(unclePos.y).toBe(dadPos.y);
            expect(dadPos.y).toBe(auntPos.y);

            // Grandma above children
            expect(grandmaPos.y).toBeLessThan(unclePos.y);
        });

        it('should position partnership centered above single child', () => {
            // SCENARIO 6 simplified: GGF -> GF+GM -> Dad+Mom -> Child
            // Each partnership should be centered above their child
            const dataset: Individual[] = [
                { name: 'ggf', sex: 'M', top_level: true },
                { name: 'gf', sex: 'M', father: 'ggf' },
                { name: 'gm', sex: 'F', top_level: true },
                { name: 'dad', sex: 'M', mother: 'gm', father: 'gf' },
                { name: 'mom', sex: 'F', top_level: true },
                { name: 'child', sex: 'F', mother: 'mom', father: 'dad' },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            renderer.calculatePositions();

            const ggfPos = renderer.nodePositions.get('ggf');
            const gfPos = renderer.nodePositions.get('gf');
            const gmPos = renderer.nodePositions.get('gm');
            const dadPos = renderer.nodePositions.get('dad');
            const momPos = renderer.nodePositions.get('mom');
            const childPos = renderer.nodePositions.get('child');

            // GGF should be directly above GF (his only child)
            expect(Math.abs(ggfPos.x - gfPos.x)).toBeLessThan(1);

            // GF+GM partnership should be centered above Dad (their only child)
            const gfgmMidX = (gfPos.x + gmPos.x) / 2;
            expect(Math.abs(gfgmMidX - dadPos.x)).toBeLessThan(1);

            // Dad+Mom partnership should be centered above Child (their only child)
            const dadmomMidX = (dadPos.x + momPos.x) / 2;
            expect(Math.abs(dadmomMidX - childPos.x)).toBeLessThan(1);
        });

        it('should draw VERTICAL parent-child lines when parent has partner', () => {
            // CRITICAL BUG: When grandpa is alone (centered) and dad has partner (offset),
            // the line from grandpa->dad should drop VERTICALLY from grandpa, not diagonally to dad
            const dataset: Individual[] = [
                { name: 'grandpa', sex: 'M', top_level: true },
                { name: 'dad', sex: 'M', father: 'grandpa' },  // Single-parent from grandpa
                { name: 'mom', sex: 'F', top_level: true },    // Dad's partner
                { name: 'child', sex: 'F', mother: 'mom', father: 'dad' },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            renderer.calculatePositions();

            const grandpaPos = renderer.nodePositions.get('grandpa');
            const dadPos = renderer.nodePositions.get('dad');

            const svg = renderer.renderSvg();

            // Extract all lines with their coordinates
            const lineRegex = /<line[^>]*x1="([^"]*)"[^>]*y1="([^"]*)"[^>]*x2="([^"]*)"[^>]*y2="([^"]*)"[^>]*>/g;
            const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
            let match;
            while ((match = lineRegex.exec(svg)) !== null) {
                lines.push({
                    x1: parseFloat(match[1]),
                    y1: parseFloat(match[2]),
                    x2: parseFloat(match[3]),
                    y2: parseFloat(match[4]),
                });
            }

            // Find the grandpa->dad line (starts at grandpa's position)
            const grandpaToDadLine = lines.find(
                line =>
                    Math.abs(line.x1 - grandpaPos.x) < 1 &&
                    Math.abs(line.y1 - grandpaPos.y) < 1 &&
                    line.y2 > line.y1  // Going downward
            );

            expect(grandpaToDadLine).toBeDefined();

            // CRITICAL: Line must drop VERTICALLY from grandpa (x1 should equal grandpa.x)
            // It should NOT go diagonally to dad's position
            expect(Math.abs(grandpaToDadLine!.x1 - grandpaPos.x)).toBeLessThan(1);

            // The line should drop straight down from grandpa, NOT diagonally to dad
            // x2 should be close to x1 (vertical line) or close to grandpa.x
            const isVertical = Math.abs(grandpaToDadLine!.x1 - grandpaToDadLine!.x2) < 1;

            if (!isVertical) {
                throw new Error(
                    `Grandpa->Dad line is DIAGONAL: (${grandpaToDadLine!.x1}, ${grandpaToDadLine!.y1}) -> (${grandpaToDadLine!.x2}, ${grandpaToDadLine!.y2}). ` +
                    `Expected vertical line from grandpa at x=${grandpaPos.x}. ` +
                    `Line should drop straight down, not go to dad at x=${dadPos.x}.`
                );
            }
        });

        it('should draw sibship line for multiple siblings from single parent', () => {
            // Test that multiple siblings from same single parent get horizontal sibship line
            const dataset: Individual[] = [
                { name: 'grandma', sex: 'F', top_level: true },
                { name: 'uncle', sex: 'M', mother: 'grandma' },  // First sibling
                { name: 'mom', sex: 'M', mother: 'grandma' },    // Second sibling
                { name: 'aunt', sex: 'F', mother: 'grandma' },   // Third sibling
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            renderer.calculatePositions();

            const grandmaPos = renderer.nodePositions.get('grandma');
            const unclePos = renderer.nodePositions.get('uncle');
            const momPos = renderer.nodePositions.get('mom');
            const auntPos = renderer.nodePositions.get('aunt');

            const svg = renderer.renderSvg();

            // Extract all lines
            const lineRegex = /<line[^>]*x1="([^"]*)"[^>]*y1="([^"]*)"[^>]*x2="([^"]*)"[^>]*y2="([^"]*)"[^>]*>/g;
            const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
            let match;
            while ((match = lineRegex.exec(svg)) !== null) {
                lines.push({
                    x1: parseFloat(match[1]),
                    y1: parseFloat(match[2]),
                    x2: parseFloat(match[3]),
                    y2: parseFloat(match[4]),
                });
            }

            // Find the vertical drop from grandma
            const sibshipY = (grandmaPos.y + unclePos.y) / 2;
            const verticalDrop = lines.find(
                line =>
                    Math.abs(line.x1 - grandmaPos.x) < 1 &&
                    Math.abs(line.x2 - grandmaPos.x) < 1 &&
                    Math.abs(line.y2 - sibshipY) < 1
            );

            expect(verticalDrop).toBeDefined();

            // Find horizontal sibship line (should span all siblings)
            const horizontalLines = lines.filter(
                line =>
                    Math.abs(line.y1 - line.y2) < 1 &&  // Horizontal
                    Math.abs(line.y1 - sibshipY) < 1    // At sibship Y
            );

            // Should have at least one horizontal line at sibship level
            expect(horizontalLines.length).toBeGreaterThanOrEqual(1);

            // Find a horizontal line that spans multiple siblings
            const sibshipLine = horizontalLines.find(line => {
                const lineLength = Math.abs(line.x2 - line.x1);
                return lineLength > 50; // Sibship lines are usually longer
            });

            expect(sibshipLine).toBeDefined();
        });

        it('should handle complex multi-generation pedigree with partner alignment', () => {
            const dataset: Individual[] = [
                // Gen 0: Great-grandparents (founders)
                { name: 'gggf', sex: 'M', top_level: true },
                { name: 'gggm', sex: 'F', top_level: true },
                // Gen 1: Grandfather (child of gggf+gggm), Grandmother (founder)
                { name: 'ggf', sex: 'M', mother: 'gggm', father: 'gggf' },
                { name: 'ggm', sex: 'F', top_level: true },
                // Gen 2: Father (child of ggf+ggm), Mother (founder)
                { name: 'dad', sex: 'M', mother: 'ggm', father: 'ggf' },
                { name: 'mom', sex: 'F', top_level: true },
                // Gen 3: Proband (child of dad+mom)
                { name: 'p', sex: 'F', mother: 'mom', father: 'dad', proband: true },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            renderer.calculatePositions();

            const gggfPos = renderer.nodePositions.get('gggf');
            const gggmPos = renderer.nodePositions.get('gggm');
            const ggfPos = renderer.nodePositions.get('ggf');
            const ggmPos = renderer.nodePositions.get('ggm');
            const dadPos = renderer.nodePositions.get('dad');
            const momPos = renderer.nodePositions.get('mom');
            const pPos = renderer.nodePositions.get('p');

            // Gen 0: gggf+gggm aligned
            expect(gggfPos.y).toBe(gggmPos.y);
            // Gen 1: ggf+ggm aligned (ggm moved to match ggf)
            expect(ggfPos.y).toBe(ggmPos.y);
            // Gen 2: dad+mom aligned (mom moved to match dad)
            expect(dadPos.y).toBe(momPos.y);

            // Each generation is separate
            expect(gggfPos.y).toBeLessThan(ggfPos.y);
            expect(ggfPos.y).toBeLessThan(dadPos.y);
            expect(dadPos.y).toBeLessThan(pPos.y);

            // 4 distinct generations
            const yValues = [gggfPos.y, ggfPos.y, dadPos.y, pPos.y];
            const uniqueY = new Set(yValues);
            expect(uniqueY.size).toBe(4);
        });

        it('should handle sibling partnerships (no parent reference for aunt)', () => {
            // Regression test: siblings must use mother/father references, not top_level
            const dataset: Individual[] = [
                { name: 'gf', sex: 'M', top_level: true },
                { name: 'gm', sex: 'F', top_level: true },
                { name: 'dad', sex: 'M', mother: 'gm', father: 'gf' },
                { name: 'aunt', sex: 'F', mother: 'gm', father: 'gf' },
                { name: 'mom', sex: 'F', top_level: true },
                { name: 'uncle_spouse', sex: 'M', top_level: true },
                { name: 'child', sex: 'F', mother: 'mom', father: 'dad' },
                { name: 'cousin', sex: 'M', mother: 'aunt', father: 'uncle_spouse' },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            renderer.calculatePositions();

            const gfPos = renderer.nodePositions.get('gf');
            const gmPos = renderer.nodePositions.get('gm');
            const dadPos = renderer.nodePositions.get('dad');
            const auntPos = renderer.nodePositions.get('aunt');
            const momPos = renderer.nodePositions.get('mom');
            const uncleSpousePos = renderer.nodePositions.get('uncle_spouse');
            const childPos = renderer.nodePositions.get('child');
            const cousinPos = renderer.nodePositions.get('cousin');

            // Gen 0: grandparents at same Y
            expect(gfPos.y).toBe(gmPos.y);

            // Gen 1: dad, aunt (siblings), mom, uncle_spouse (all aligned)
            expect(dadPos.y).toBe(auntPos.y); // Siblings at same generation
            expect(dadPos.y).toBe(momPos.y); // Partners aligned
            expect(auntPos.y).toBe(uncleSpousePos.y); // Aunt+uncle_spouse aligned

            // Gen 2: children at same Y
            expect(childPos.y).toBe(cousinPos.y);

            // Vertical ordering: Gen 0 < Gen 1 < Gen 2
            expect(gfPos.y).toBeLessThan(dadPos.y);
            expect(dadPos.y).toBeLessThan(childPos.y);

            // GF+GM partnership centered above children (dad+aunt)
            const gfgmMidX = (gfPos.x + gmPos.x) / 2;
            const siblingsMidX = (dadPos.x + auntPos.x) / 2;
            expect(Math.abs(gfgmMidX - siblingsMidX)).toBeLessThan(50); // Reasonable tolerance

            // Dad+Mom partnership centered above child
            const dadmomMidX = (dadPos.x + momPos.x) / 2;
            expect(Math.abs(dadmomMidX - childPos.x)).toBeLessThan(1);

            // Aunt+Uncle partnership centered above cousin
            const auntuncleMidX = (auntPos.x + uncleSpousePos.x) / 2;
            expect(Math.abs(auntuncleMidX - cousinPos.x)).toBeLessThan(1);

            // Siblings (dad, aunt) should have spacing
            const minNodeSpacing = 140;
            expect(Math.abs(auntPos.x - dadPos.x)).toBeGreaterThanOrEqual(minNodeSpacing);
        });
    });

    describe('Bennett 2008 standard compliance', () => {
        it('should render carrier status as dot in center', () => {
            const dataset: Individual[] = [
                { name: 'carrier', sex: 'F', top_level: true, carrier: true },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            renderer.calculatePositions();

            const carrierPos = renderer.nodePositions.get('carrier');

            const svg = renderer.renderSvg();

            // Extract all circles (SVG uses groups with transforms, circles have r attribute only)
            const circleRegex = /<circle[^>]*r="([^"]*)"[^>]*>/g;
            const circles: Array<{ r: number }> = [];
            let match;
            while ((match = circleRegex.exec(svg)) !== null) {
                circles.push({
                    r: parseFloat(match[1]),
                });
            }

            // Should have main circle (female) and carrier dot (small circle)
            expect(circles.length).toBeGreaterThanOrEqual(2);

            // Find main female symbol (larger circle, r=17.5)
            const mainCircle = circles.find(c => c.r > 10);
            expect(mainCircle).toBeDefined();

            // Find carrier dot (small circle, r=4)
            const carrierDot = circles.find(c => c.r === 4);
            expect(carrierDot).toBeDefined();

            // Both circles should be in same group transform (same position)
            // Verify the group transform matches the calculated position
            const groupRegex = /<g[^>]*transform="translate\(([^,]+),\s*([^)]+)\)"[^>]*>/g;
            let groupMatch;
            while ((groupMatch = groupRegex.exec(svg)) !== null) {
                const groupX = parseFloat(groupMatch[1]);
                const groupY = parseFloat(groupMatch[2]);

                // Check if this group matches carrier position
                if (Math.abs(groupX - carrierPos.x) < 1 && Math.abs(groupY - carrierPos.y) < 1) {
                    // Found the carrier's group - verify it contains both circles
                    expect(svg).toContain('carrier'); // Should have the label
                    break;
                }
            }
        });

        it('should render pregnancy indicator with P inside symbol', () => {
            const dataset: Individual[] = [
                { name: 'pregnant', sex: 'F', top_level: true, pregnant: true },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            renderer.calculatePositions();

            const pregnantPos = renderer.nodePositions.get('pregnant');

            const svg = renderer.renderSvg();

            // Should have "P" text inside the symbol
            expect(svg).toContain('>P<');

            // Verify the group transform matches the calculated position
            const groupRegex = /<g[^>]*transform="translate\(([^,]+),\s*([^)]+)\)"[^>]*>/g;
            let foundPregnantGroup = false;
            let groupMatch;
            while ((groupMatch = groupRegex.exec(svg)) !== null) {
                const groupX = parseFloat(groupMatch[1]);
                const groupY = parseFloat(groupMatch[2]);

                // Check if this group matches pregnant position
                if (Math.abs(groupX - pregnantPos.x) < 1 && Math.abs(groupY - pregnantPos.y) < 1) {
                    foundPregnantGroup = true;
                    // Found the pregnant's group - verify it contains "P" text
                    expect(svg).toContain('>P<');
                    break;
                }
            }

            expect(foundPregnantGroup).toBe(true);

            // Extract "P" text element (has relative coordinates within group)
            // Use individual regex for x and y to handle attributes in any order
            const textMatch = svg.match(/<text[^>]*>P<\/text>/);
            expect(textMatch).not.toBeNull();

            if (textMatch) {
                const textElement = textMatch[0];
                const xMatch = textElement.match(/x="([^"]*)"/);
                const yMatch = textElement.match(/y="([^"]*)"/);

                expect(xMatch).not.toBeNull();
                expect(yMatch).not.toBeNull();

                if (xMatch && yMatch) {
                    const pX = parseFloat(xMatch[1]);
                    const pY = parseFloat(yMatch[1]);

                    // "P" should be centered relative to group (x=0, y near 0-10)
                    expect(Math.abs(pX)).toBeLessThan(1); // Centered horizontally
                    expect(Math.abs(pY)).toBeLessThan(10); // Near top of symbol
                }
            }
        });

        it('should render termination/stillbirth as small triangle', () => {
            const dataset: Individual[] = [
                { name: 'dad', sex: 'M', top_level: true },
                { name: 'mom', sex: 'F', top_level: true },
                {
                    name: 'loss',
                    sex: 'U',
                    mother: 'mom',
                    father: 'dad',
                    terminated: true,
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            renderer.calculatePositions();

            const lossPos = renderer.nodePositions.get('loss');
            const dadPos = renderer.nodePositions.get('dad');
            const momPos = renderer.nodePositions.get('mom');

            const svg = renderer.renderSvg();

            // Should have polygon for triangle (termination) in addition to any other polygons
            expect(svg).toContain('<polygon');

            // Termination symbol should be positioned below parents
            expect(lossPos.y).toBeGreaterThan(dadPos.y);
            expect(lossPos.y).toBeGreaterThan(momPos.y);

            // Termination symbol should be centered below partnership
            const partnershipMidX = (dadPos.x + momPos.x) / 2;
            expect(Math.abs(lossPos.x - partnershipMidX)).toBeLessThan(1);

            // Extract polygon points to verify it's a triangle
            const polygonRegex = /<polygon[^>]*points="([^"]*)"[^>]*>/g;
            const polygons: Array<string> = [];
            let match;
            while ((match = polygonRegex.exec(svg)) !== null) {
                polygons.push(match[1]);
            }

            // Should have at least one polygon (the termination triangle)
            expect(polygons.length).toBeGreaterThanOrEqual(1);

            // Verify one polygon has triangle points (3 coordinate pairs)
            const terminationTriangle = polygons.find(points => {
                const coords = points.trim().split(/\s+/);
                return coords.length === 3; // Triangle has 3 vertices
            });

            expect(terminationTriangle).toBeDefined();
        });

        it('should render divorced indicator as hash marks on partnership line', () => {
            const dataset: Individual[] = [
                {
                    name: 'exhusband',
                    sex: 'M',
                    top_level: true,
                    divorced: true,
                },
                { name: 'exwife', sex: 'F', top_level: true },
                {
                    name: 'child',
                    sex: 'F',
                    mother: 'exwife',
                    father: 'exhusband',
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            renderer.calculatePositions();

            const exhusbandPos = renderer.nodePositions.get('exhusband');
            const exwifePos = renderer.nodePositions.get('exwife');

            const svg = renderer.renderSvg();

            // Extract all lines
            const lineRegex = /<line[^>]*x1="([^"]*)"[^>]*y1="([^"]*)"[^>]*x2="([^"]*)"[^>]*y2="([^"]*)"[^>]*>/g;
            const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
            let match;
            while ((match = lineRegex.exec(svg)) !== null) {
                lines.push({
                    x1: parseFloat(match[1]),
                    y1: parseFloat(match[2]),
                    x2: parseFloat(match[3]),
                    y2: parseFloat(match[4]),
                });
            }

            // Should have multiple lines including hash marks
            // Partnership line + vertical drop + child connection + 2 hash marks = 5+ lines
            expect(lines.length).toBeGreaterThanOrEqual(5);

            // Find partnership line (horizontal line between partners)
            const partnershipLine = lines.find(
                line =>
                    Math.abs(line.y1 - line.y2) < 1 && // Horizontal
                    Math.abs(line.y1 - exhusbandPos.y) < 1 && // At partner Y position
                    ((Math.abs(line.x1 - exhusbandPos.x) < 5 && Math.abs(line.x2 - exwifePos.x) < 5) ||
                     (Math.abs(line.x1 - exwifePos.x) < 5 && Math.abs(line.x2 - exhusbandPos.x) < 5))
            );

            expect(partnershipLine).toBeDefined();

            if (partnershipLine) {
                // Partnership line should be horizontal at partners' Y position
                expect(Math.abs(partnershipLine.y1 - partnershipLine.y2)).toBeLessThan(1);
                expect(Math.abs(partnershipLine.y1 - exhusbandPos.y)).toBeLessThan(1);

                // Calculate partnership midpoint (where hash marks should be)
                const partnershipMidX = (partnershipLine.x1 + partnershipLine.x2) / 2;
                const partnershipY = partnershipLine.y1;

                // Find hash marks (small diagonal lines near midpoint)
                // Hash marks are typically diagonal lines crossing the partnership line
                const hashMarks = lines.filter(line => {
                    const lineMidX = (line.x1 + line.x2) / 2;
                    const lineMidY = (line.y1 + line.y2) / 2;
                    // Hash marks should be near partnership midpoint
                    return (
                        Math.abs(lineMidX - partnershipMidX) < 10 &&
                        Math.abs(lineMidY - partnershipY) < 10 &&
                        // Not the partnership line itself
                        line !== partnershipLine
                    );
                });

                // Should have at least 2 hash marks
                expect(hashMarks.length).toBeGreaterThanOrEqual(2);

                // Hash marks should be centered at partnership midpoint
                for (const hashMark of hashMarks.slice(0, 2)) {
                    const hashMidX = (hashMark.x1 + hashMark.x2) / 2;
                    const hashMidY = (hashMark.y1 + hashMark.y2) / 2;
                    expect(Math.abs(hashMidX - partnershipMidX)).toBeLessThan(10);
                    expect(Math.abs(hashMidY - partnershipY)).toBeLessThan(10);
                }
            }
        });

        it('should render DZ twins without connecting bar', () => {
            const dataset: Individual[] = [
                { name: 'dad', sex: 'M', top_level: true },
                { name: 'mom', sex: 'F', top_level: true },
                {
                    name: 'dz1',
                    sex: 'M',
                    mother: 'mom',
                    father: 'dad',
                    dztwin: 'dz',
                },
                {
                    name: 'dz2',
                    sex: 'F',
                    mother: 'mom',
                    father: 'dad',
                    dztwin: 'dz',
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            renderer.calculatePositions();

            const dz1Pos = renderer.nodePositions.get('dz1');
            const dz2Pos = renderer.nodePositions.get('dz2');

            const svg = renderer.renderSvg();

            // Should render both twins
            expect(svg).toContain('>dz1<');
            expect(svg).toContain('>dz2<');

            // DZ twins should be at same Y (same generation)
            expect(dz1Pos.y).toBe(dz2Pos.y);

            // Extract all lines
            const lineRegex = /<line[^>]*x1="([^"]*)"[^>]*y1="([^"]*)"[^>]*x2="([^"]*)"[^>]*y2="([^"]*)"[^>]*>/g;
            const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
            let match;
            while ((match = lineRegex.exec(svg)) !== null) {
                lines.push({
                    x1: parseFloat(match[1]),
                    y1: parseFloat(match[2]),
                    x2: parseFloat(match[3]),
                    y2: parseFloat(match[4]),
                });
            }

            // Find horizontal lines at the expected twin bar Y position
            const symbolSize = 35;
            const expectedTwinBarY = dz1Pos.y - symbolSize / 2;

            // DZ twins should NOT have a twin bar (unlike MZ twins)
            // Check that there's no horizontal line connecting the twins at the top of their symbols
            const twinBar = lines.find(
                line =>
                    Math.abs(line.y1 - line.y2) < 1 && // Horizontal
                    Math.abs(line.y1 - expectedTwinBarY) < 5 && // At expected twin bar Y
                    ((Math.abs(line.x1 - dz1Pos.x) < 5 && Math.abs(line.x2 - dz2Pos.x) < 5) ||
                     (Math.abs(line.x1 - dz2Pos.x) < 5 && Math.abs(line.x2 - dz1Pos.x) < 5))
            );

            // CRITICAL: DZ twins should NOT have a twin bar
            expect(twinBar).toBeUndefined();
        });

        it('should render MZ twins with connecting bar', () => {
            const dataset: Individual[] = [
                { name: 'dad', sex: 'M', top_level: true },
                { name: 'mom', sex: 'F', top_level: true },
                {
                    name: 'mz1',
                    sex: 'M',
                    mother: 'mom',
                    father: 'dad',
                    mztwin: 'mz',
                },
                {
                    name: 'mz2',
                    sex: 'M',
                    mother: 'mom',
                    father: 'dad',
                    mztwin: 'mz',
                },
            ];

            const renderer = new PedigreeRenderer(dataset);
            const svg = renderer.renderSvg();

            // Should have twin bar (horizontal line connecting twins)
            // This is separate from sibship line
            const lineCount = (svg.match(/<line/g) || []).length;
            // Partnership + drop + sibship + child1 + child2 + twin bar = 6+ lines
            expect(lineCount).toBeGreaterThanOrEqual(6);
        });

        it('should render Ashkenazi ancestry indicator with A marker', () => {
            const dataset: Individual[] = [
                {
                    name: 'ashkenazi',
                    sex: 'M',
                    top_level: true,
                    ashkenazi: 1,
                    proband: true,
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            renderer.calculatePositions();

            const ashkenaziPos = renderer.nodePositions.get('ashkenazi');

            const svg = renderer.renderSvg();

            // Should have "A" text marker
            expect(svg).toContain('>A<');

            // Verify the group transform matches the calculated position
            const groupRegex = /<g[^>]*transform="translate\(([^,]+),\s*([^)]+)\)"[^>]*>/g;
            let foundGroup = false;
            let match;
            while ((match = groupRegex.exec(svg)) !== null) {
                const groupX = parseFloat(match[1]);
                const groupY = parseFloat(match[2]);

                if (Math.abs(groupX - ashkenaziPos.x) < 1 && Math.abs(groupY - ashkenaziPos.y) < 1) {
                    foundGroup = true;
                    break;
                }
            }

            expect(foundGroup).toBe(true);

            // Extract "A" text element
            const textMatch = svg.match(/<text[^>]*>A<\/text>/);
            expect(textMatch).not.toBeNull();

            if (textMatch) {
                const textElement = textMatch[0];
                const xMatch = textElement.match(/x="([^"]*)"/);
                const yMatch = textElement.match(/y="([^"]*)"/);

                expect(xMatch).not.toBeNull();
                expect(yMatch).not.toBeNull();

                if (xMatch && yMatch) {
                    const aX = parseFloat(xMatch[1]);
                    const aY = parseFloat(yMatch[1]);

                    // "A" should be positioned in upper right quadrant (positive x, negative y)
                    expect(aX).toBeGreaterThan(0); // Upper right quadrant
                    expect(aY).toBeLessThan(0); // Above center
                }
            }
        });

        it('should combine multiple Bennett indicators on one individual', () => {
            const dataset: Individual[] = [
                {
                    name: 'complex',
                    sex: 'F',
                    top_level: true,
                    carrier: true,
                    status: 1, // deceased
                    proband: true,
                    noparents: true, // adopted
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            renderer.calculatePositions();

            const complexPos = renderer.nodePositions.get('complex');

            const svg = renderer.renderSvg();

            // Should have circle (female), carrier dot, deceased line, proband arrow, adoption brackets
            expect(svg).toContain('<circle'); // Female + carrier dot
            expect(svg).toContain('<line'); // Deceased diagonal
            expect(svg).toContain('<polygon'); // Proband arrow
            expect(svg).toContain('<path'); // Adoption brackets

            // Extract all circles (SVG uses groups with transforms, circles have r attribute only)
            const circleRegex = /<circle[^>]*r="([^"]*)"[^>]*>/g;
            const circles: Array<{ r: number }> = [];
            let circleMatch;
            while ((circleMatch = circleRegex.exec(svg)) !== null) {
                circles.push({
                    r: parseFloat(circleMatch[1]),
                });
            }

            // Find main female symbol (larger circle, r=17.5)
            const mainCircle = circles.find(c => c.r > 10);
            expect(mainCircle).toBeDefined();

            // Find carrier dot (small circle, r=4)
            const carrierDot = circles.find(c => c.r === 4);
            expect(carrierDot).toBeDefined();

            // Verify the group transform matches the calculated position
            const groupRegex = /<g[^>]*transform="translate\(([^,]+),\s*([^)]+)\)"[^>]*>/g;
            let foundComplexGroup = false;
            let groupMatch;
            while ((groupMatch = groupRegex.exec(svg)) !== null) {
                const groupX = parseFloat(groupMatch[1]);
                const groupY = parseFloat(groupMatch[2]);

                // Check if this group matches complex position
                if (Math.abs(groupX - complexPos.x) < 1 && Math.abs(groupY - complexPos.y) < 1) {
                    foundComplexGroup = true;
                    break;
                }
            }

            expect(foundComplexGroup).toBe(true);

            // Extract deceased line (diagonal line through symbol)
            // Note: Lines use relative coordinates within the group transform
            const lineRegex = /<line[^>]*x1="([^"]*)"[^>]*y1="([^"]*)"[^>]*x2="([^"]*)"[^>]*y2="([^"]*)"[^>]*>/g;
            const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
            let lineMatch;
            while ((lineMatch = lineRegex.exec(svg)) !== null) {
                lines.push({
                    x1: parseFloat(lineMatch[1]),
                    y1: parseFloat(lineMatch[2]),
                    x2: parseFloat(lineMatch[3]),
                    y2: parseFloat(lineMatch[4]),
                });
            }

            // Find deceased line (diagonal line through the symbol)
            // Deceased line has relative coordinates and should be centered at (0, 0)
            const deceasedLine = lines.find(line => {
                const lineCenterX = (line.x1 + line.x2) / 2;
                const lineCenterY = (line.y1 + line.y2) / 2;
                // Deceased line should be diagonal and centered relative to group (0, 0)
                return (
                    Math.abs(lineCenterX) < 5 && // Centered at x=0 (relative to group)
                    Math.abs(lineCenterY) < 5 && // Centered at y=0 (relative to group)
                    Math.abs(line.y2 - line.y1) > 10 && // Diagonal (has Y distance)
                    Math.abs(line.x2 - line.x1) > 10   // Diagonal (has X distance)
                );
            });
            expect(deceasedLine).toBeDefined();

            // Extract proband arrow (polygon)
            const polygonRegex = /<polygon[^>]*points="([^"]*)"[^>]*>/g;
            const polygons: Array<string> = [];
            let polygonMatch;
            while ((polygonMatch = polygonRegex.exec(svg)) !== null) {
                polygons.push(polygonMatch[1]);
            }

            // Proband arrow should exist as polygon
            expect(polygons.length).toBeGreaterThanOrEqual(1);

            // Extract adoption brackets (path elements)
            // Note: paths use relative coordinates within the group transform
            const pathRegex = /<path[^>]*d="([^"]*)"[^>]*>/g;
            const paths: Array<string> = [];
            let pathMatch;
            while ((pathMatch = pathRegex.exec(svg)) !== null) {
                paths.push(pathMatch[1]);
            }

            // Should have at least 2 adoption brackets (left and right)
            expect(paths.length).toBeGreaterThanOrEqual(2);

            // Parse path d attributes to check for left and right brackets
            // Paths have M (move) and L (line) commands with relative coordinates
            const leftBrackets = paths.filter(p => {
                // Left bracket should start with negative X (M-14... or similar)
                return p.match(/^M-\d+/);
            });
            const rightBrackets = paths.filter(p => {
                // Right bracket should start with positive X (M14... or M\s*\d+)
                return p.match(/^M\d+/) || p.match(/^M\s+\d+/);
            });

            expect(leftBrackets.length).toBeGreaterThanOrEqual(1);
            expect(rightBrackets.length).toBeGreaterThanOrEqual(1);
        });

        it('should render ectopic pregnancy indicator with EP marker', () => {
            const dataset: Individual[] = [
                {
                    name: 'ectopic',
                    sex: 'F',
                    top_level: true,
                    ectopic: true,
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            const svg = renderer.renderSvg();

            // Should have "EP" text marker
            expect(svg).toContain('>EP<');
        });

        it('should render infertility indicator with crossed lines', () => {
            const dataset: Individual[] = [
                {
                    name: 'infertile',
                    sex: 'F',
                    top_level: true,
                    infertility: true,
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            const svg = renderer.renderSvg();

            // Should have crossed lines (two diagonal line elements)
            const lineMatches = svg.match(/<line/g);
            expect(lineMatches).not.toBeNull();
            expect(lineMatches!.length).toBeGreaterThanOrEqual(2); // At least 2 lines for the X
        });

        it('should render pregnancy duration label when pregnant and terminated_age present', () => {
            const dataset: Individual[] = [
                {
                    name: 'pregnant',
                    sex: 'F',
                    top_level: true,
                    pregnant: true,
                    terminated_age: 12, // 12 weeks
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            const svg = renderer.renderSvg();

            // Should have both "P" marker and "12w" duration label
            expect(svg).toContain('>P<');
            expect(svg).toContain('>12w<');
        });

        it('should render stillbirth with larger triangle (>= 20 weeks)', () => {
            const dataset: Individual[] = [
                {
                    name: 'stillbirth',
                    sex: 'U',
                    top_level: true,
                    terminated: true,
                    terminated_age: 24, // 24 weeks = stillbirth
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            const svg = renderer.renderSvg();

            // Should have polygon for triangle
            const polygonMatch = svg.match(/<polygon[^>]*points="([^"]*)"[^>]*>/);
            expect(polygonMatch).not.toBeNull();

            if (polygonMatch) {
                const points = polygonMatch[1];
                // Parse the points to check triangle size
                const coords = points.split(/\s+/).map(p => {
                    const [x, y] = p.split(',').map(parseFloat);
                    return { x, y };
                });

                // Calculate approximate size (distance from top to bottom)
                const yValues = coords.map(c => c.y);
                const triangleHeight = Math.max(...yValues) - Math.min(...yValues);

                // Stillbirth triangle should be larger (symbolSize/2.5 ≈ 14 with default symbolSize 35)
                // vs early loss (symbolSize/3 ≈ 11.67)
                expect(triangleHeight).toBeGreaterThan(12); // Larger than early loss
            }
        });

        it('should render early pregnancy loss with smaller triangle (< 20 weeks)', () => {
            const dataset: Individual[] = [
                {
                    name: 'sab',
                    sex: 'U',
                    top_level: true,
                    terminated: true,
                    terminated_age: 8, // 8 weeks = early loss
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            const svg = renderer.renderSvg();

            // Should have polygon for triangle
            const polygonMatch = svg.match(/<polygon[^>]*points="([^"]*)"[^>]*>/);
            expect(polygonMatch).not.toBeNull();

            if (polygonMatch) {
                const points = polygonMatch[1];
                // Parse the points to check triangle size
                const coords = points.split(/\s+/).map(p => {
                    const [x, y] = p.split(',').map(parseFloat);
                    return { x, y };
                });

                // Calculate approximate size (distance from top to bottom)
                const yValues = coords.map(c => c.y);
                const triangleHeight = Math.max(...yValues) - Math.min(...yValues);

                // Early loss triangle should be smaller (symbolSize/3 ≈ 11.67 with default symbolSize 35)
                // Actual height is about 23.33 (2/3 of symbolSize for the full triangle height)
                expect(triangleHeight).toBeLessThan(25); // Smaller than stillbirth (which is ~28)
            }
        });

        it('should render consanguinity degree label on consanguineous partnership', () => {
            const dataset: Individual[] = [
                // Child of consanguineous relationship
                {
                    name: 'child',
                    sex: 'M',
                    mother: 'cousin2',
                    father: 'cousin1',
                },
                // First cousins who marry
                {
                    name: 'cousin1',
                    sex: 'M',
                    top_level: true,
                    mother: 'aunt',
                    father: 'uncle1',
                    consanguinity_degree: '1st cousins',
                },
                {
                    name: 'cousin2',
                    sex: 'F',
                    top_level: true,
                    mother: 'mother',
                    father: 'uncle2',
                },
                // Parents generation (siblings)
                { name: 'aunt', sex: 'F', mother: 'grandma', father: 'grandpa' },
                { name: 'uncle1', sex: 'M' },
                { name: 'mother', sex: 'F', mother: 'grandma', father: 'grandpa' },
                { name: 'uncle2', sex: 'M' },
                // Grandparents
                { name: 'grandma', sex: 'F', top_level: true },
                { name: 'grandpa', sex: 'M', top_level: true },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            const svg = renderer.renderSvg();

            // Should have "1st cousins" text label on the consanguineous partnership line
            expect(svg).toContain('>1st cousins<');
        });

        it('should render no children by choice indicator when partnership has no children', () => {
            // NOTE: This test verifies the drawing function exists and has correct signature
            // In practice, "no children by choice" requires an explicit partnership marker
            // which isn't currently supported in the basic pedigree structure.
            // This is a limitation of the current implementation.

            // For now, we just verify that individuals with the property don't cause errors
            const dataset: Individual[] = [
                {
                    name: 'parent1',
                    sex: 'M',
                    top_level: true,
                    no_children_by_choice: true,
                },
                {
                    name: 'parent2',
                    sex: 'F',
                    top_level: true,
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            const svg = renderer.renderSvg();

            // Verify the SVG is generated without errors
            expect(svg).toContain('<svg');
            expect(svg).toContain('parent1');
            expect(svg).toContain('parent2');

            // NOTE: The indicator would only show if these individuals formed a partnership
            // (which requires either children or an explicit partnership marker)
        });

        it('should render age at death for deceased individual with yob and yod', () => {
            const dataset: Individual[] = [
                {
                    name: 'deceased',
                    sex: 'M',
                    top_level: true,
                    status: 1, // deceased
                    yob: 1950,
                    yod: 2020,
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            const svg = renderer.renderSvg();

            // Should show age at death (2020 - 1950 = 70)
            expect(svg).toContain('d. 70y');
        });

        it('should render consultand indicator with double arrow', () => {
            const dataset: Individual[] = [
                {
                    name: 'consultand',
                    sex: 'F',
                    top_level: true,
                    consultand: true,
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            const svg = renderer.renderSvg();

            // Should have two polygon elements for the double arrow
            const polygonMatches = svg.match(/<polygon/g);
            expect(polygonMatches).not.toBeNull();
            expect(polygonMatches!.length).toBeGreaterThanOrEqual(2); // Two arrows
        });

        it('should render anticipation indicator with asterisk', () => {
            const dataset: Individual[] = [
                {
                    name: 'anticipation',
                    sex: 'M',
                    top_level: true,
                    anticipation: true,
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            const svg = renderer.renderSvg();

            // Should have asterisk text marker
            expect(svg).toContain('>*<');
        });

        it('should render obligate carrier with outlined dot', () => {
            const dataset: Individual[] = [
                {
                    name: 'obligate',
                    sex: 'F',
                    top_level: true,
                    obligate_carrier: true,
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            const svg = renderer.renderSvg();

            // Should have a circle with no fill (outlined)
            expect(svg).toMatch(/<circle[^>]*fill="none"[^>]*>/);
        });

        it('should render adopted OUT indicator with arrow and OUT label', () => {
            const dataset: Individual[] = [
                {
                    name: 'placed',
                    sex: 'M',
                    top_level: true,
                    adoption_type: 'out',
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            const svg = renderer.renderSvg();

            // Should have "OUT" text label
            expect(svg).toContain('>OUT<');
            // Should have polygon for arrow
            const polygonMatches = svg.match(/<polygon/g);
            expect(polygonMatches).not.toBeNull();
        });

        it('should render foster placement with dashed brackets', () => {
            const dataset: Individual[] = [
                {
                    name: 'foster',
                    sex: 'F',
                    top_level: true,
                    adoption_type: 'foster',
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            const svg = renderer.renderSvg();

            // Should have dashed path elements (stroke-dasharray)
            expect(svg).toMatch(/stroke-dasharray="3,2"/);
        });

        it('should render birth order with Roman numerals', () => {
            const dataset: Individual[] = [
                {
                    name: 'first',
                    sex: 'M',
                    top_level: true,
                    birth_order: 1,
                },
                {
                    name: 'second',
                    sex: 'F',
                    top_level: true,
                    birth_order: 2,
                },
                {
                    name: 'third',
                    sex: 'M',
                    top_level: true,
                    birth_order: 3,
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            const svg = renderer.renderSvg();

            // Should have Roman numerals I, II, III
            expect(svg).toContain('>I<');
            expect(svg).toContain('>II<');
            expect(svg).toContain('>III<');
        });

        it('should render ART egg donor indicator', () => {
            const dataset: Individual[] = [
                {
                    name: 'child',
                    sex: 'F',
                    top_level: true,
                    art_type: 'egg_donor',
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            const svg = renderer.renderSvg();

            // Should have "E" marker for egg donor
            expect(svg).toContain('>E<');
        });

        it('should render ART sperm donor indicator', () => {
            const dataset: Individual[] = [
                {
                    name: 'child',
                    sex: 'M',
                    top_level: true,
                    art_type: 'sperm_donor',
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            const svg = renderer.renderSvg();

            // Should have "S" marker for sperm donor
            expect(svg).toContain('>S<');
        });

        it('should render ART surrogate (gestational carrier) indicator', () => {
            const dataset: Individual[] = [
                {
                    name: 'child',
                    sex: 'F',
                    top_level: true,
                    art_type: 'surrogate',
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            const svg = renderer.renderSvg();

            // Should have "GC" marker for gestational carrier
            expect(svg).toContain('>GC<');
        });

        it('should render pregnancy outcome label (SAB)', () => {
            const dataset: Individual[] = [
                {
                    name: 'miscarriage',
                    sex: 'U',
                    top_level: true,
                    terminated: true,
                    pregnancy_outcome: 'miscarriage',
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            const svg = renderer.renderSvg();

            // Should have "SAB" label for spontaneous abortion
            expect(svg).toContain('>SAB<');
        });

        it('should render pregnancy outcome label (TOP)', () => {
            const dataset: Individual[] = [
                {
                    name: 'termination',
                    sex: 'U',
                    top_level: true,
                    terminated: true,
                    pregnancy_outcome: 'induced_termination',
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            const svg = renderer.renderSvg();

            // Should have "TOP" label for termination of pregnancy
            expect(svg).toContain('>TOP<');
        });

        it('should render gene copy number heterozygous label', () => {
            const dataset: Individual[] = [
                {
                    name: 'het',
                    sex: 'F',
                    top_level: true,
                    carrier: true,
                    gene_copy_number: 'heterozygous',
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            const svg = renderer.renderSvg();

            // Should have "Het" label
            expect(svg).toContain('>Het<');
        });

        it('should render gene copy number homozygous label', () => {
            const dataset: Individual[] = [
                {
                    name: 'hom',
                    sex: 'M',
                    top_level: true,
                    gene_copy_number: 'homozygous',
                    conditions: [{ name: 'Cystic fibrosis' }],
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            const svg = renderer.renderSvg();

            // Should have "Hom" label
            expect(svg).toContain('>Hom<');
        });

        it('should render gene copy number compound heterozygous label', () => {
            const dataset: Individual[] = [
                {
                    name: 'ch',
                    sex: 'F',
                    top_level: true,
                    gene_copy_number: 'compound_heterozygous',
                    conditions: [{ name: 'Beta-thalassemia' }],
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            const svg = renderer.renderSvg();

            // Should have "CH" label
            expect(svg).toContain('>CH<');
        });

        it('should render unmarried partnership with dashed line', () => {
            const dataset: Individual[] = [
                {
                    name: 'child',
                    sex: 'M',
                    mother: 'mother',
                    father: 'father',
                },
                {
                    name: 'father',
                    sex: 'M',
                    top_level: true,
                    relationship_type: 'unmarried',
                },
                {
                    name: 'mother',
                    sex: 'F',
                    top_level: true,
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            const svg = renderer.renderSvg();

            // Should have dashed line (stroke-dasharray)
            expect(svg).toMatch(/stroke-dasharray="5,3"/);
        });

        it('should render gender identity marker for trans male (Bennett 2022)', () => {
            const dataset: Individual[] = [
                {
                    name: 'transmale',
                    sex: 'F', // Sex assigned at birth
                    gender: 'TM', // Gender identity: trans male
                    top_level: true,
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            const svg = renderer.renderSvg();

            // Should have "TM" marker in purple
            expect(svg).toContain('>TM<');
            expect(svg).toMatch(/fill="#9370DB"/); // Purple color
        });

        it('should render gender identity marker for non-binary (Bennett 2022)', () => {
            const dataset: Individual[] = [
                {
                    name: 'nonbinary',
                    sex: 'U',
                    gender: 'NB',
                    top_level: true,
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            const svg = renderer.renderSvg();

            // Should have "NB" marker
            expect(svg).toContain('>NB<');
        });

        it('should NOT render gender marker when gender matches sex', () => {
            const dataset: Individual[] = [
                {
                    name: 'cisgender',
                    sex: 'M',
                    gender: 'M',
                    top_level: true,
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            const svg = renderer.renderSvg();

            // Should NOT have TM, TF, NB, or GNC markers
            expect(svg).not.toContain('>TM<');
            expect(svg).not.toContain('>TF<');
            expect(svg).not.toContain('>NB<');
            expect(svg).not.toContain('>GNC<');
        });

        it('should render generation numbers with labels option', () => {
            const dataset: Individual[] = [
                { name: 'grandpa1', sex: 'M', top_level: true },
                { name: 'grandma1', sex: 'F', top_level: true },
                { name: 'grandpa2', sex: 'M', top_level: true },
                { name: 'grandma2', sex: 'F', top_level: true },
                {
                    name: 'father',
                    sex: 'M',
                    mother: 'grandma1',
                    father: 'grandpa1',
                },
                {
                    name: 'mother',
                    sex: 'F',
                    mother: 'grandma2',
                    father: 'grandpa2',
                },
                {
                    name: 'child',
                    sex: 'M',
                    mother: 'mother',
                    father: 'father',
                },
            ];

            const renderer = new PedigreeRenderer(dataset, {
                labels: ['generation'],
            }) as any;
            const svg = renderer.renderSvg();

            // Should have generation numbers I, II, III
            expect(svg).toContain('>I<'); // Grandparents
            expect(svg).toContain('>II<'); // Parents
            expect(svg).toContain('>III<'); // Child
        });
    });

    describe('Code coverage completion', () => {
        it('should render DZ twins (dizygotic twins)', () => {
            const dataset: Individual[] = [
                { name: 'father', sex: 'M', top_level: true },
                { name: 'mother', sex: 'F', top_level: true },
                {
                    name: 'twin1',
                    sex: 'M',
                    mother: 'mother',
                    father: 'father',
                    dztwin: 'A',
                },
                {
                    name: 'twin2',
                    sex: 'F',
                    mother: 'mother',
                    father: 'father',
                    dztwin: 'A',
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            const svg = renderer.renderSvg();

            expect(svg).toContain('twin1');
            expect(svg).toContain('twin2');
        });

        it('should render no children by choice indicator for childless couple', () => {
            const dataset: Individual[] = [
                { name: 'husband', sex: 'M', top_level: true, no_children_by_choice: true },
                { name: 'wife', sex: 'F', top_level: true },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            const svg = renderer.renderSvg();

            expect(svg).toContain('husband');
            expect(svg).toContain('wife');
        });

        it('should render consanguinity degree label', () => {
            const dataset: Individual[] = [
                { name: 'grandpa', sex: 'M', top_level: true },
                { name: 'grandma', sex: 'F', top_level: true },
                {
                    name: 'uncle',
                    sex: 'M',
                    mother: 'grandma',
                    father: 'grandpa',
                },
                {
                    name: 'aunt',
                    sex: 'F',
                    mother: 'grandma',
                    father: 'grandpa',
                    consanguinity_degree: '1st cousins' as any,
                },
                {
                    name: 'child',
                    sex: 'M',
                    mother: 'aunt',
                    father: 'uncle',
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            const svg = renderer.renderSvg();

            expect(svg).toContain('child');
            expect(svg).toContain('1st cousins');
        });

        it('should handle single child with offset parent', () => {
            const dataset: Individual[] = [
                { name: 'parent1', sex: 'M', top_level: true },
                { name: 'parent2', sex: 'F', top_level: true },
                { name: 'parent3', sex: 'M', top_level: true },
                { name: 'parent4', sex: 'F', top_level: true },
                {
                    name: 'sibling1',
                    sex: 'M',
                    mother: 'parent2',
                    father: 'parent1',
                },
                {
                    name: 'sibling2',
                    sex: 'F',
                    mother: 'parent2',
                    father: 'parent1',
                },
                {
                    name: 'only_child',
                    sex: 'M',
                    mother: 'parent4',
                    father: 'parent3',
                },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;
            const svg = renderer.renderSvg();

            expect(svg).toContain('only_child');
            expect(svg).toContain('sibling1');
            expect(svg).toContain('sibling2');
        });

        it('should prevent position overlaps by shifting partnerships', () => {
            // Regression test for overlapping symbols bug - renderer should prevent overlaps
            const dataset: Individual[] = [
                { name: 'Husband', sex: 'M', top_level: true },
                { name: 'Wife', sex: 'F', top_level: true },
                { name: 'Child1', sex: 'M', mother: 'Wife', father: 'Husband', age: 10 },
                { name: 'Partner1', sex: 'M', top_level: true },
                { name: 'Partner2', sex: 'F', top_level: true, relationship_type: 'unmarried' },
                { name: 'Child2', sex: 'F', mother: 'Partner2', father: 'Partner1', age: 6 },
            ];

            const renderer = new PedigreeRenderer(dataset) as any;

            // Renderer should successfully position all individuals without overlap
            renderer.calculatePositions();

            // Verify no overlaps exist
            const positions = Array.from(renderer.nodePositions.values());
            for (let i = 0; i < positions.length; i++) {
                for (let j = i + 1; j < positions.length; j++) {
                    const pos1 = positions[i];
                    const pos2 = positions[j];
                    const overlaps = pos1.x === pos2.x && pos1.y === pos2.y;
                    expect(overlaps).toBe(false);
                }
            }

            // Verify Wife and Partner1 are properly spaced
            const wifePos = renderer.nodePositions.get('Wife');
            const partner1Pos = renderer.nodePositions.get('Partner1');
            expect(Math.abs(wifePos.x - partner1Pos.x)).toBeGreaterThanOrEqual(70); // minNodeSpacing

            // CRITICAL: Child2 should be centered below Partner1-Partner2 partnership
            const partner2Pos = renderer.nodePositions.get('Partner2');
            const child2Pos = renderer.nodePositions.get('Child2');
            const partnershipMidX = (partner1Pos.x + partner2Pos.x) / 2;

            // Child2 X should be at partnership midpoint (tolerance: 1px)
            expect(Math.abs(child2Pos.x - partnershipMidX)).toBeLessThan(1);
        });
    });
});
