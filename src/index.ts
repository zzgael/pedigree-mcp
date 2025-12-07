#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getDocumentation } from './tools/get-documentation.js';
import { generatePedigree } from './tools/generate-pedigree.js';

const GeneTestSchema = z.object({
    type: z.enum(['-', 'S', 'T']),
    result: z.enum(['-', 'P', 'N']),
});

// Condition schema per Bennett 2008 NSGC standard (free text)
const ConditionSchema = z.object({
    name: z
        .string()
        .describe(
            'Condition/disease name (free text): "Breast cancer", "Huntington\'s disease", "Type 2 diabetes"',
        ),
    age: z.number().optional().describe('Age at diagnosis/onset'),
});

// Use passthrough() to allow arbitrary gene test properties
const IndividualSchema = z
    .object({
        name: z
            .string()
            .max(7, 'name exceeds 7 char limit')
            .describe('Unique identifier (max 7 chars)'),
        sex: z.enum(['M', 'F', 'U']).describe('M=male, F=female, U=unknown'),
        display_name: z
            .string()
            .max(13, 'display_name exceeds 13 char limit')
            .optional()
            .describe('Human-readable name (max 13 chars)'),
        top_level: z
            .boolean()
            .optional()
            .describe(
                'ONLY for founders with NO known parents. Siblings without partners still need mother/father refs.',
            ),
        proband: z.boolean().optional().describe('True for the index case'),
        mother: z
            .string()
            .optional()
            .describe(
                'Reference to mother name. Siblings share same mother/father.',
            ),
        father: z
            .string()
            .optional()
            .describe(
                'Reference to father name. Siblings share same mother/father.',
            ),
        age: z.number().optional().describe('Current age'),
        yob: z.number().optional().describe('Year of birth'),
        status: z.number().optional().describe('0=alive, 1=deceased'),
        mztwin: z
            .string()
            .optional()
            .describe('Monozygotic twin marker (same value = identical twins)'),
        dztwin: z
            .string()
            .optional()
            .describe('Dizygotic twin marker (same value = fraternal twins)'),
        ashkenazi: z.number().optional().describe('0=no, 1=Ashkenazi ancestry'),
        noparents: z
            .boolean()
            .optional()
            .describe(
                'Shows adoption brackets [ ]. Use for adopted individuals.',
            ),
        // Bennett 2008 standard: conditions as free text
        conditions: z
            .array(ConditionSchema)
            .optional()
            .describe(
                'ONLY way to get colored fills. Array of conditions/diseases (free text). Gene tests alone do NOT color symbols.',
            ),
        // Bennett standard indicators
        carrier: z
            .boolean()
            .optional()
            .describe('Carrier status (dot in center)'),
        pregnant: z
            .boolean()
            .optional()
            .describe('Pregnancy (P inside symbol)'),
        terminated: z
            .boolean()
            .optional()
            .describe(
                'PREGNANCY LOSS ONLY (stillbirth/miscarriage). Shows small triangle. NEVER use for living individuals!',
            ),
        divorced: z
            .boolean()
            .optional()
            .describe('Divorced/separated (hash marks on partnership line)'),
        // Gene tests (pattern: {gene}_gene_test)
        brca1_gene_test: GeneTestSchema.optional(),
        brca2_gene_test: GeneTestSchema.optional(),
        palb2_gene_test: GeneTestSchema.optional(),
        atm_gene_test: GeneTestSchema.optional(),
        chek2_gene_test: GeneTestSchema.optional(),
    })
    .passthrough();

const server = new McpServer({
    name: 'pedigree-mcp',
    version: '1.0.0',
});

// Tool 1: Get Documentation
server.tool(
    'get_pedigree_documentation',
    'Returns comprehensive documentation for the pedigree data format. ALWAYS call this first before generating a pedigree to understand the required data structure, properties, and examples.',
    {},
    async () => {
        const documentation = getDocumentation();
        return {
            content: [
                {
                    type: 'text',
                    text: documentation,
                },
            ],
        };
    },
);

// Tool 2: Generate Pedigree
server.tool(
    'generate_pedigree',
    'Generates a pedigree tree (Bennett 2008 standard) in PNG or SVG format. IMPORTANT: Use mother/father for ALL individuals with known parents - siblings share same parents. Only use top_level:true for founders with NO known parents.',
    {
        dataset: z
            .array(IndividualSchema)
            .describe('Array of family members in pedigreejs format'),
        width: z
            .number()
            .optional()
            .default(800)
            .describe('Image width in pixels'),
        height: z
            .number()
            .optional()
            .default(600)
            .describe('Image height in pixels'),
        symbol_size: z
            .number()
            .optional()
            .default(35)
            .describe('Size of individual symbols'),
        background: z
            .string()
            .optional()
            .default('#ffffff')
            .describe('Background color'),
        labels: z
            .array(z.enum(['age', 'yob']))
            .optional()
            .default(['age'])
            .describe(
                'Which demographics to show: age, yob, or both. Condition and gene test labels are always shown automatically.',
            ),
        format: z
            .enum(['png', 'svg'])
            .optional()
            .default('png')
            .describe(
                'Output format: png (base64 image, default) or svg (XML text)',
            ),
    },
    async params => {
        const result = await generatePedigree({
            dataset: params.dataset as any,
            width: params.width,
            height: params.height,
            symbol_size: params.symbol_size,
            background: params.background,
            labels: params.labels,
            format: params.format,
        });

        const formatText = params.format === 'svg' ? 'SVG' : 'PNG';

        if (params.format === 'svg') {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Pedigree generated successfully (${formatText} format)!\nIndividuals: ${result.metadata.individual_count}\nGenerations: ${result.metadata.generation_count}\nDimensions: ${result.metadata.width}x${result.metadata.height}px`,
                    },
                    {
                        type: 'text',
                        text: result.svg_string!,
                    },
                ],
            };
        } else {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Pedigree generated successfully (${formatText} format)!\nIndividuals: ${result.metadata.individual_count}\nGenerations: ${result.metadata.generation_count}\nDimensions: ${result.metadata.width}x${result.metadata.height}px`,
                    },
                    {
                        type: 'image',
                        data: result.image_base64!,
                        mimeType: 'image/png',
                    },
                ],
            };
        }
    },
);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Pedigree MCP server started');
}

main().catch(console.error);
