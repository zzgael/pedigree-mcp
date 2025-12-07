#!/usr/bin/env node
import { PedigreeRenderer } from '../src/renderer/pedigree-renderer.js';
import type { Individual } from '../src/types.js';
import * as fs from 'fs';
import * as path from 'path';

// Realistic BRCA1 Breast/Ovarian Cancer Family History
// Shows 3 generations with clear inheritance pattern
// Demonstrates key features without overwhelming complexity

const dataset: Individual[] = [
    // Generation 0: Grandparents (maternal)
    {
        name: 'Grandmother',
        sex: 'F',
        top_level: true,
        status: 1, // Deceased
        yob: 1925,
        yod: 2000,
        carrier: true,
        conditions: [
            { name: 'Breast Cancer', age: 52 }
        ]
    },
    {
        name: 'Grandfather',
        sex: 'M',
        top_level: true,
        status: 1, // Deceased
        yob: 1923,
        yod: 1998
    },

    // Generation 1: Parents and Aunt/Uncle
    {
        name: 'Mother',
        sex: 'F',
        mother: 'Grandmother',
        father: 'Grandfather',
        age: 55,
        brca1_gene_test: { type: 'T', result: 'P' }, // BRCA1 positive
        conditions: [
            { name: 'Breast Cancer', age: 45 }
        ]
    },
    {
        name: 'Father',
        sex: 'M',
        top_level: true,
        age: 57
    },
    {
        name: 'Aunt',
        sex: 'F',
        mother: 'Grandmother',
        father: 'Grandfather',
        age: 52,
        brca1_gene_test: { type: 'T', result: 'P' }, // BRCA1 positive
        conditions: [
            { name: 'Ovarian Cancer', age: 48 }
        ]
    },
    {
        name: 'Uncle',
        sex: 'M',
        top_level: true,
        age: 54
    },

    // Generation 2: Siblings and Cousin
    {
        name: 'Proband',
        sex: 'F',
        mother: 'Mother',
        father: 'Father',
        age: 28,
        proband: true,
        consultand: true,
        brca1_gene_test: { type: 'T', result: 'P' } // BRCA1 positive, seeking counseling
    },
    {
        name: 'Brother',
        sex: 'M',
        mother: 'Mother',
        father: 'Father',
        age: 25,
        brca1_gene_test: { type: 'T', result: 'N' } // BRCA1 negative
    },
    {
        name: 'Sister',
        sex: 'F',
        mother: 'Mother',
        father: 'Father',
        age: 32,
        brca1_gene_test: { type: 'T', result: 'P' }, // BRCA1 positive
        conditions: [
            { name: 'Breast Cancer', age: 30 },
            { name: 'Ovarian Cancer', age: 31 }
        ]
    },
    {
        name: 'Twin1',
        sex: 'F',
        mother: 'Aunt',
        father: 'Uncle',
        age: 30,
        mztwin: 'A', // Identical twins
        carrier: true // Obligate carrier (mother is BRCA1+)
    },
    {
        name: 'Twin2',
        sex: 'F',
        mother: 'Aunt',
        father: 'Uncle',
        age: 30,
        mztwin: 'A', // Identical twins
        brca1_gene_test: { type: 'T', result: 'P' }
    }
];

async function main() {
    const renderer = new PedigreeRenderer(dataset);
    const pngBuffer = await renderer.render();

    const outputDir = path.join(process.cwd(), 'examples', 'output');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save as showcase example (will replace example.png in README)
    const outputPath = path.join(outputDir, 'showcase-example.png');
    fs.writeFileSync(outputPath, pngBuffer);

    console.log(`✅ Generated showcase example: ${outputPath}`);
    console.log('\nThis example demonstrates:');
    console.log('  • 3 generations (Grandparents → Parents → Current)');
    console.log('  • BRCA1 hereditary breast/ovarian cancer syndrome');
    console.log('  • Affected individuals (filled symbols with conditions)');
    console.log('  • Combined conditions (Sister has both breast + ovarian cancer)');
    console.log('  • MZ identical twins (Twin1 and Twin2 with connecting bar)');
    console.log('  • Carrier status (dots in symbols)');
    console.log('  • Deceased (diagonal lines)');
    console.log('  • Proband + consultand (seeking genetic counseling)');
    console.log('  • Gene test results (BRCA1 positive/negative)');
    console.log('  • Realistic medical genetics scenario');
}

main().catch(console.error);
