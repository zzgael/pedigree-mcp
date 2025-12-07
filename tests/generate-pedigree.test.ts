import { describe, it, expect } from 'vitest';
import { generatePedigree } from '../src/tools/generate-pedigree.js';
import type { Individual } from '../src/types.js';

describe('generatePedigree tool', () => {
    describe('input validation', () => {
        it('should throw error for empty dataset', async () => {
            await expect(generatePedigree({ dataset: [] })).rejects.toThrow(
                'non-empty array',
            );
        });

        it('should throw error for undefined dataset', async () => {
            await expect(
                generatePedigree({ dataset: undefined as any }),
            ).rejects.toThrow('required');
        });

        it('should throw error for invalid dataset (not array)', async () => {
            await expect(
                generatePedigree({ dataset: 'not an array' as any }),
            ).rejects.toThrow('array');
        });
    });

    describe('successful generation', () => {
        it('should generate pedigree with metadata', async () => {
            const dataset: Individual[] = [
                { name: 'gf', sex: 'M', top_level: true },
                { name: 'gm', sex: 'F', top_level: true },
                {
                    name: 'p',
                    sex: 'F',
                    mother: 'gm',
                    father: 'gf',
                    proband: true,
                },
            ];

            const result = await generatePedigree({ dataset });

            expect(result.image_base64).toBeDefined();
            expect(result.metadata).toBeDefined();
            expect(result.metadata.individual_count).toBe(3);
            expect(result.metadata.generation_count).toBe(2);
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

            expect(result.metadata.width).toBe(1200);
            expect(result.metadata.height).toBe(900);
        });

        it('should return valid base64 PNG', async () => {
            const dataset: Individual[] = [
                { name: 'solo', sex: 'M', top_level: true, proband: true },
            ];

            const result = await generatePedigree({ dataset });

            expect(result.image_base64).toBeDefined();

            // Decode base64 and verify PNG magic bytes
            const buffer = Buffer.from(result.image_base64, 'base64');
            expect(buffer[0]).toBe(0x89);
            expect(buffer[1]).toBe(0x50); // P
            expect(buffer[2]).toBe(0x4e); // N
            expect(buffer[3]).toBe(0x47); // G
        });

        it('should handle complex multi-generation pedigree', async () => {
            const dataset: Individual[] = [
                { name: 'ggf', sex: 'M', top_level: true, status: 1 },
                {
                    name: 'ggm',
                    sex: 'F',
                    top_level: true,
                    status: 1,
                    conditions: [{ name: 'Ovarian cancer', age: 72 }],
                },
                {
                    name: 'gf1',
                    sex: 'M',
                    mother: 'ggm',
                    father: 'ggf',
                    status: 1,
                },
                {
                    name: 'gm1',
                    sex: 'F',
                    top_level: true,
                    conditions: [{ name: 'Breast cancer', age: 58 }],
                },
                { name: 'f1', sex: 'M', mother: 'gm1', father: 'gf1', age: 52 },
                {
                    name: 'm1',
                    sex: 'F',
                    mother: 'gm1',
                    father: 'gf1',
                    age: 48,
                    conditions: [{ name: 'Breast cancer', age: 44 }],
                },
                { name: 'sp1', sex: 'F', top_level: true, age: 50 },
                {
                    name: 'ch1',
                    display_name: 'Patient',
                    sex: 'F',
                    mother: 'm1',
                    father: 'f1',
                    proband: true,
                    age: 25,
                },
                { name: 'ch2', sex: 'M', mother: 'm1', father: 'f1', age: 22 },
            ];

            const result = await generatePedigree({ dataset });

            expect(result.metadata.individual_count).toBe(9);
            expect(result.metadata.generation_count).toBeGreaterThanOrEqual(3);
        });
    });

    describe('error handling', () => {
        it('should throw validation error for invalid parent reference', async () => {
            const dataset: Individual[] = [
                { name: 'child', sex: 'F', mother: 'missing', father: 'dad' },
                { name: 'dad', sex: 'M', top_level: true },
            ];

            await expect(generatePedigree({ dataset })).rejects.toThrow(
                'Validation',
            );
        });
    });

    describe('condition legend', () => {
        it('should generate pedigree without legend when no conditions exist', async () => {
            const dataset: Individual[] = [
                { name: 'p', sex: 'M', top_level: true },
            ];
            const result = await generatePedigree({ dataset });
            expect(result.metadata.individual_count).toBe(1);
            const buffer = Buffer.from(result.image_base64, 'base64');
            expect(buffer[0]).toBe(0x89);
        });

        it('should generate pedigree with legend when conditions exist', async () => {
            const dataset: Individual[] = [
                {
                    name: 'p',
                    sex: 'M',
                    top_level: true,
                    conditions: [{ name: 'Diabetes' }],
                },
            ];
            const result = await generatePedigree({ dataset });
            expect(result.metadata.individual_count).toBe(1);
            const buffer = Buffer.from(result.image_base64, 'base64');
            expect(buffer.length).toBeGreaterThan(1000);
        });

        it('should handle multiple conditions with different colors', async () => {
            const dataset: Individual[] = [
                {
                    name: 'gf',
                    sex: 'M',
                    top_level: true,
                    conditions: [{ name: 'Huntington' }],
                },
                {
                    name: 'gm',
                    sex: 'F',
                    top_level: true,
                    conditions: [{ name: 'Breast cancer' }],
                },
                {
                    name: 'p',
                    sex: 'F',
                    mother: 'gm',
                    father: 'gf',
                    conditions: [
                        { name: 'Huntington' },
                        { name: 'Breast cancer' },
                    ],
                },
            ];
            const result = await generatePedigree({ dataset });
            expect(result.metadata.individual_count).toBe(3);
            const buffer = Buffer.from(result.image_base64, 'base64');
            expect(buffer[0]).toBe(0x89);
        });

        it('should wrap legend to multiple rows when many conditions', async () => {
            const conditions = [
                'Alzheimer disease',
                'Breast cancer',
                'Colon cancer',
                'Diabetes type 2',
                'Epilepsy',
                'Fragile X syndrome',
                'Glaucoma',
                'Hemophilia A',
                'Inflammatory bowel disease',
            ];
            const dataset: Individual[] = conditions.map((name, i) => ({
                name: `p${i}`,
                sex: (i % 2 === 0 ? 'M' : 'F') as 'M' | 'F',
                top_level: true,
                conditions: [{ name }],
            }));

            const result = await generatePedigree({ dataset, width: 600 });
            expect(result.image_base64).toBeDefined();
            const buffer = Buffer.from(result.image_base64, 'base64');
            expect(buffer[0]).toBe(0x89);
        });

        it('should generate pedigree with symbol_size option', async () => {
            const dataset: Individual[] = [
                { name: 'p', sex: 'M', top_level: true },
            ];
            const result = await generatePedigree({ dataset, symbol_size: 50 });
            expect(result.image_base64).toBeDefined();
            const buffer = Buffer.from(result.image_base64, 'base64');
            expect(buffer[0]).toBe(0x89);
        });

        it('should generate pedigree with background option', async () => {
            const dataset: Individual[] = [
                { name: 'p', sex: 'M', top_level: true },
            ];
            const result = await generatePedigree({
                dataset,
                background: '#f0f0f0',
            });
            expect(result.image_base64).toBeDefined();
            const buffer = Buffer.from(result.image_base64, 'base64');
            expect(buffer[0]).toBe(0x89);
        });

        it('should generate pedigree with labels option', async () => {
            const dataset: Individual[] = [
                { name: 'p', sex: 'M', top_level: true, age: 45 },
            ];
            const result = await generatePedigree({
                dataset,
                labels: ['age', 'name'],
            });
            expect(result.image_base64).toBeDefined();
            const buffer = Buffer.from(result.image_base64, 'base64');
            expect(buffer[0]).toBe(0x89);
        });
    });

    describe('format parameter', () => {
        it('should generate PNG by default when format is not specified', async () => {
            const dataset: Individual[] = [
                { name: 'f', sex: 'M', top_level: true },
            ];

            const result = await generatePedigree({ dataset });

            expect(result.image_base64).toBeDefined();
            expect(result.svg_string).toBeUndefined();
            expect(result.metadata.individual_count).toBe(1);

            // Verify PNG magic bytes
            const buffer = Buffer.from(result.image_base64!, 'base64');
            expect(buffer[0]).toBe(0x89);
            expect(buffer[1]).toBe(0x50); // P
            expect(buffer[2]).toBe(0x4e); // N
            expect(buffer[3]).toBe(0x47); // G
        });

        it('should generate PNG when format=png is explicitly set', async () => {
            const dataset: Individual[] = [
                { name: 'f', sex: 'M', top_level: true },
            ];

            const result = await generatePedigree({ dataset, format: 'png' });

            expect(result.image_base64).toBeDefined();
            expect(result.svg_string).toBeUndefined();

            // Verify PNG magic bytes
            const buffer = Buffer.from(result.image_base64!, 'base64');
            expect(buffer[0]).toBe(0x89);
        });

        it('should generate SVG when format=svg', async () => {
            const dataset: Individual[] = [
                { name: 'f', sex: 'M', top_level: true },
                { name: 'm', sex: 'F', top_level: true },
                { name: 'c', sex: 'F', mother: 'm', father: 'f' },
            ];

            const result = await generatePedigree({ dataset, format: 'svg' });

            expect(result.svg_string).toBeDefined();
            expect(result.image_base64).toBeUndefined();
            expect(result.metadata.individual_count).toBe(3);
            expect(result.metadata.generation_count).toBe(2);

            // Verify SVG structure
            expect(result.svg_string).toContain('<svg');
            expect(result.svg_string).toContain('</svg>');
            expect(result.svg_string).toContain('width=');
            expect(result.svg_string).toContain('height=');
        });

        it('should generate valid SVG with conditions', async () => {
            const dataset: Individual[] = [
                {
                    name: 'p',
                    sex: 'F',
                    top_level: true,
                    proband: true,
                    conditions: [{ name: 'Breast cancer', age: 45 }],
                },
            ];

            const result = await generatePedigree({ dataset, format: 'svg' });

            expect(result.svg_string).toBeDefined();
            expect(result.svg_string).toContain('<svg');
            expect(result.svg_string).toContain('</svg>');

            // Verify it contains circle for female
            expect(result.svg_string).toContain('<circle');
        });

        it('should respect width/height in both PNG and SVG formats', async () => {
            const dataset: Individual[] = [
                { name: 'solo', sex: 'M', top_level: true },
            ];

            const pngResult = await generatePedigree({
                dataset,
                width: 1000,
                height: 800,
                format: 'png',
            });

            const svgResult = await generatePedigree({
                dataset,
                width: 1000,
                height: 800,
                format: 'svg',
            });

            expect(pngResult.metadata.width).toBe(1000);
            expect(pngResult.metadata.height).toBe(800);
            expect(svgResult.metadata.width).toBe(1000);
            expect(svgResult.metadata.height).toBe(800);

            // SVG should contain dimensions
            expect(svgResult.svg_string).toContain('width="1000"');
            expect(svgResult.svg_string).toContain('height="800"');
        });
    });
});
