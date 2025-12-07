#!/usr/bin/env tsx
import { PedigreeRenderer } from '../src/renderer/pedigree-renderer.js';
import type { Individual } from '../src/types.js';
import * as fs from 'fs';
import * as path from 'path';

const outputDir = path.join(process.cwd(), 'examples', 'output');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

async function generateScenario(name: string, dataset: Individual[], options = {}) {
    console.log(`Generating: ${name}...`);
    const renderer = new PedigreeRenderer(dataset, options);
    const pngBuffer = await renderer.render();
    fs.writeFileSync(path.join(outputDir, `${name}.png`), pngBuffer);
}

async function main() {
    // 1. Gender Diversity (Bennett 2022)
    await generateScenario('01-gender-diversity', [
        { name: 'Trans Male', sex: 'F', gender: 'TM', top_level: true, age: 28 },
        { name: 'Trans Female', sex: 'M', gender: 'TF', top_level: true, age: 32 },
        { name: 'Non-Binary', sex: 'U', gender: 'NB', top_level: true, age: 25 },
        { name: 'Gender NC', sex: 'F', gender: 'GNC', top_level: true, age: 30 },
    ]);

    // 2. Generation Numbering
    await generateScenario('02-generation-numbering', [
        { name: 'Grandpa', sex: 'M', top_level: true },
        { name: 'Grandma', sex: 'F', top_level: true },
        { name: 'Father', sex: 'M', mother: 'Grandma', father: 'Grandpa' },
        { name: 'Mother', sex: 'F', top_level: true },
        { name: 'Child', sex: 'M', mother: 'Mother', father: 'Father' },
    ], { labels: ['generation'] });

    // 3. ART Indicators
    await generateScenario('03-art-indicators', [
        { name: 'Egg Donor', sex: 'F', top_level: true, art_type: 'egg_donor', age: 35 },
        { name: 'Sperm Donor', sex: 'M', top_level: true, art_type: 'sperm_donor', age: 40 },
        { name: 'Embryo Donor', sex: 'F', top_level: true, art_type: 'embryo_donor', age: 38 },
        { name: 'Surrogate', sex: 'F', top_level: true, art_type: 'surrogate', age: 32 },
    ]);

    // 4. Adoption Types
    await generateScenario('04-adoption-types', [
        { name: 'Bio Dad', sex: 'M', top_level: true },
        { name: 'Bio Mom', sex: 'F', top_level: true },
        { name: 'Adopted IN', sex: 'M', mother: 'Bio Mom', father: 'Bio Dad', adoption_type: 'in', age: 8 },
        { name: 'Adopted OUT', sex: 'F', mother: 'Bio Mom', father: 'Bio Dad', adoption_type: 'out', age: 6 },
        { name: 'Foster', sex: 'M', mother: 'Bio Mom', father: 'Bio Dad', adoption_type: 'foster', age: 10 },
    ]);

    // 5. Birth Order
    await generateScenario('05-birth-order', [
        { name: 'Dad', sex: 'M', top_level: true },
        { name: 'Mom', sex: 'F', top_level: true },
        { name: 'First', sex: 'M', mother: 'Mom', father: 'Dad', birth_order: 1, age: 15 },
        { name: 'Second', sex: 'F', mother: 'Mom', father: 'Dad', birth_order: 2, age: 12 },
        { name: 'Third', sex: 'M', mother: 'Mom', father: 'Dad', birth_order: 3, age: 8 },
    ]);

    // 6. Pregnancy Outcomes
    await generateScenario('06-pregnancy-outcomes', [
        { name: 'Mother', sex: 'F', top_level: true },
        { name: 'SAB', sex: 'U', mother: 'Mother', terminated: true, pregnancy_outcome: 'miscarriage' },
        { name: 'TOP', sex: 'U', mother: 'Mother', terminated: true, pregnancy_outcome: 'induced_termination' },
        { name: 'Stillbirth', sex: 'M', mother: 'Mother', terminated: true, pregnancy_outcome: 'stillbirth', terminated_age: 32 },
        { name: 'Living', sex: 'F', mother: 'Mother', age: 5 },
    ]);

    // 7. Gene Copy Number
    await generateScenario('07-gene-copy-number', [
        { name: 'Het', sex: 'F', top_level: true, carrier: true, gene_copy_number: 'heterozygous', age: 40 },
        { name: 'Hom', sex: 'M', top_level: true, carrier: true, gene_copy_number: 'homozygous', age: 38 },
        { name: 'CH', sex: 'F', top_level: true, carrier: true, gene_copy_number: 'compound_heterozygous', age: 42 },
    ]);

    // 8. Relationship Types
    await generateScenario('08-relationship-types', [
        { name: 'Husband', sex: 'M', top_level: true },
        { name: 'Wife', sex: 'F' }, // Partner of Husband, not top_level
        { name: 'Child1', sex: 'M', mother: 'Wife', father: 'Husband', age: 10 },
        { name: 'Partner1', sex: 'M', top_level: true },
        { name: 'Partner2', sex: 'F', relationship_type: 'unmarried' }, // Unmarried partnership, not top_level
        { name: 'Child2', sex: 'F', mother: 'Partner2', father: 'Partner1', age: 6 },
    ]);

    // 9. Special Indicators
    await generateScenario('09-special-indicators', [
        { name: 'Ashkenazi', sex: 'M', top_level: true, ashkenazi: 1, age: 55 },
        { name: 'Ectopic', sex: 'F', top_level: true, terminated: true, ectopic: true, pregnancy_outcome: 'ectopic', age: 30 },
        { name: 'Infertility', sex: 'M', top_level: true, infertility: true, age: 45 },
        { name: 'Anticipation', sex: 'F', top_level: true, anticipation: true, age: 50 },
    ]);

    // 10. Carrier Types
    await generateScenario('10-carrier-types', [
        { name: 'Carrier', sex: 'F', top_level: true, carrier: true, age: 40 },
        { name: 'Obligate', sex: 'M', top_level: true, obligate_carrier: true, age: 42 },
        { name: 'Normal', sex: 'F', top_level: true, age: 38 },
    ]);

    // 11. Twins (MZ and DZ)
    await generateScenario('11-twins', [
        { name: 'Dad', sex: 'M', top_level: true },
        { name: 'Mom', sex: 'F', top_level: true },
        { name: 'MZ Twin 1', sex: 'F', mother: 'Mom', father: 'Dad', mztwin: 'A', age: 12 },
        { name: 'MZ Twin 2', sex: 'F', mother: 'Mom', father: 'Dad', mztwin: 'A', age: 12 },
        { name: 'DZ Twin 1', sex: 'M', mother: 'Mom', father: 'Dad', dztwin: 'B', age: 8 },
        { name: 'DZ Twin 2', sex: 'M', mother: 'Mom', father: 'Dad', dztwin: 'B', age: 8 },
    ]);

    // 12. Consanguinity with Degree
    await generateScenario('12-consanguinity', [
        { name: 'Grandpa', sex: 'M', top_level: true },
        { name: 'Grandma', sex: 'F', top_level: true },
        { name: 'Uncle', sex: 'M', mother: 'Grandma', father: 'Grandpa' },
        { name: 'Aunt', sex: 'F', mother: 'Grandma', father: 'Grandpa', consanguinity_degree: '1st cousins' as any },
        { name: 'Child', sex: 'M', mother: 'Aunt', father: 'Uncle' },
    ]);

    // 13. Proband and Consultand
    await generateScenario('13-proband-consultand', [
        { name: 'Proband', sex: 'M', top_level: true, proband: true, age: 35 },
        { name: 'Consultand', sex: 'F', top_level: true, consultand: true, age: 32 },
        { name: 'Normal', sex: 'M', top_level: true, age: 40 },
    ]);

    // 14. Deceased with Age at Death
    await generateScenario('14-deceased', [
        { name: 'Died Young', sex: 'M', top_level: true, status: 1, yob: 1980, yod: 2010 },
        { name: 'Died Old', sex: 'F', top_level: true, status: 1, yob: 1940, yod: 2020 },
        { name: 'Living', sex: 'M', top_level: true, status: 0, age: 45 },
    ]);

    // 15. Pregnancy Duration
    await generateScenario('15-pregnancy-duration', [
        { name: 'Mother', sex: 'F', top_level: true, pregnant: true, terminated_age: 28 },
        { name: 'Father', sex: 'M', top_level: true },
    ]);

    // 16. Stillbirth vs Early Loss
    await generateScenario('16-stillbirth-vs-early-loss', [
        { name: 'Mother', sex: 'F', top_level: true },
        { name: 'Early Loss', sex: 'U', mother: 'Mother', terminated: true, terminated_age: 12 },
        { name: 'Stillbirth', sex: 'M', mother: 'Mother', terminated: true, terminated_age: 32 },
    ]);

    // 17. No Children by Choice
    await generateScenario('17-no-children-by-choice', [
        { name: 'Husband', sex: 'M', top_level: true, no_children_by_choice: true },
        { name: 'Wife', sex: 'F', top_level: true },
    ]);

    // 18. Divorced
    await generateScenario('18-divorced', [
        { name: 'Ex Husband', sex: 'M', top_level: true, divorced: true },
        { name: 'Ex Wife', sex: 'F', top_level: true },
        { name: 'Child', sex: 'F', mother: 'Ex Wife', father: 'Ex Husband', age: 18 },
    ]);

    // 19. Conditions with Legend (single and multiple conditions)
    await generateScenario('19-conditions', [
        { name: 'Dad', sex: 'M', top_level: true, conditions: [{ name: 'Diabetes', age: 45 }] },
        { name: 'Mom', sex: 'F', top_level: true, conditions: [{ name: 'Breast Cancer', age: 50 }] },
        { name: 'Child', sex: 'M', mother: 'Mom', father: 'Dad', conditions: [{ name: 'Asthma', age: 8 }], age: 12 },
        // Multiple conditions on one individual (shows quadrants for male, pie slices for female)
        { name: 'Sister', sex: 'F', mother: 'Mom', father: 'Dad', age: 15, conditions: [
            { name: 'Depression', age: 12 },
            { name: 'Anxiety', age: 13 }
        ]},
    ]);

    // 20. Gene Tests
    await generateScenario('20-gene-tests', [
        { name: 'BRCA1+', sex: 'F', top_level: true, brca1_gene_test: { type: 'T', result: 'P' }, age: 40 },
        { name: 'BRCA1-', sex: 'M', top_level: true, brca1_gene_test: { type: 'T', result: 'N' }, age: 42 },
        { name: 'HTT Test', sex: 'F', top_level: true, htt_gene_test: { type: 'S', result: '-' }, age: 35 },
    ], { labels: ['age', 'gene_test'] });

    // 21. Complex Pedigree (Multiple Features)
    await generateScenario('21-complex-pedigree', [
        // Generation 0: Great-grandparents
        { name: 'GGF1', sex: 'M', top_level: true, status: 1, yob: 1920, yod: 1995 },
        { name: 'GGM1', sex: 'F', top_level: true, status: 1, yob: 1925, yod: 2000 },
        { name: 'GGF2', sex: 'M', top_level: true, status: 1, yob: 1918, yod: 1990, ashkenazi: 1 },
        { name: 'GGM2', sex: 'F', top_level: true, status: 1, yob: 1922, yod: 1998 },

        // Generation 1: Grandparents
        { name: 'GF', sex: 'M', mother: 'GGM1', father: 'GGF1', status: 1, yob: 1940, yod: 2010, conditions: [{ name: 'Heart Disease', age: 65 }] },
        { name: 'GM', sex: 'F', mother: 'GGM2', father: 'GGF2', status: 1, yob: 1945, yod: 2015, carrier: true },
        { name: 'GF2', sex: 'M', top_level: true, divorced: true },

        // Generation 2: Parents and aunts/uncles
        { name: 'Uncle1', sex: 'M', mother: 'GM', father: 'GF', divorced: true, conditions: [{ name: 'Diabetes', age: 50 }] },
        { name: 'Aunt1', sex: 'F', top_level: true, infertility: true },
        { name: 'Uncle2', sex: 'M', mother: 'GM', father: 'GF', gender: 'TM', age: 52 },
        { name: 'Aunt2', sex: 'F', top_level: true, relationship_type: 'unmarried' },
        { name: 'Father', sex: 'M', mother: 'GM', father: 'GF', proband: true, obligate_carrier: true, age: 55 },
        { name: 'Mother1', sex: 'F', divorced: true, conditions: [{ name: 'Breast Cancer', age: 45 }] },
        { name: 'Mother2', sex: 'F', art_type: 'egg_donor', brca1_gene_test: { type: 'T', result: 'P' } },
        { name: 'Aunt3', sex: 'F', mother: 'GM', father: 'GF2', age: 48 },
        { name: 'Uncle3', sex: 'M', top_level: true, consanguinity_degree: '1st cousins' as any },

        // Generation 2: Pregnancy losses
        { name: 'SAB1', sex: 'U', mother: 'GM', father: 'GF', terminated: true, pregnancy_outcome: 'miscarriage' },
        { name: 'Stillbirth1', sex: 'M', mother: 'GM', father: 'GF', terminated: true, pregnancy_outcome: 'stillbirth', terminated_age: 32 },

        // Generation 3: Cousins and children
        { name: 'Cousin1', sex: 'F', mother: 'Aunt1', father: 'Uncle1', carrier: true, age: 28, gene_copy_number: 'heterozygous' },
        { name: 'Cousin2', sex: 'M', mother: 'Aunt2', father: 'Uncle2', age: 25, adoption_type: 'in' },
        { name: 'Cousin3', sex: 'F', mother: 'Aunt3', father: 'Uncle3', age: 20, conditions: [{ name: 'Asthma', age: 8 }] },

        // Father's first marriage children
        { name: 'Child1', sex: 'F', mother: 'Mother1', father: 'Father', age: 30, conditions: [{ name: 'Depression', age: 25 }] },
        { name: 'Child2', sex: 'M', mother: 'Mother1', father: 'Father', age: 28, brca1_gene_test: { type: 'T', result: 'N' } },

        // Father's second marriage children - MZ twins + DZ twins + singleton
        { name: 'MZTwin1', sex: 'M', mother: 'Mother2', father: 'Father', mztwin: 'A', birth_order: 1, age: 12 },
        { name: 'MZTwin2', sex: 'M', mother: 'Mother2', father: 'Father', mztwin: 'A', birth_order: 2, age: 12 },
        { name: 'DZTwin1', sex: 'F', mother: 'Mother2', father: 'Father', dztwin: 'B', birth_order: 3, age: 8 },
        { name: 'DZTwin2', sex: 'F', mother: 'Mother2', father: 'Father', dztwin: 'B', birth_order: 4, age: 8 },
        { name: 'Youngest', sex: 'M', mother: 'Mother2', father: 'Father', birth_order: 5, age: 5 },

        // Generation 4: Next generation (showing anticipation and prenatal testing)
        { name: 'Grandchild1', sex: 'F', mother: 'Child1', father: 'Partner1', consultand: true, age: 8, anticipation: true },
        { name: 'Partner1', sex: 'M', top_level: true },
        { name: 'Grandchild2', sex: 'U', mother: 'Cousin3', father: 'Partner2', terminated: true, pregnancy_outcome: 'induced_termination' },
        { name: 'Partner2', sex: 'M', top_level: true },
    ], { labels: ['age', 'generation'] });

    console.log(`\n✅ Generated 21 scenario diagrams in ${outputDir}`);
}

main().catch(console.error);
