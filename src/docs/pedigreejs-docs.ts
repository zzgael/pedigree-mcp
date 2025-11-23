export const PEDIGREEJS_DOCUMENTATION = `# Pedigree Generator

Generates PNG pedigree trees using standard genetic notation.

## ⚠️ LIMITS: name≤7chars, display_name≤13chars

## Individual Properties

**Required:** \`name\` (unique ID), \`sex\` (M/F/U)

**Family:** \`mother\`, \`father\` (refs to existing individuals), \`top_level\` (true for founders)

**Display:** \`display_name\`, \`proband\` (index case), \`age\`, \`yob\`, \`status\` (0=alive, 1=deceased)

**Special:** \`noparents\` (adopted, shows brackets), \`mztwin\` (same value=identical twins), \`ashkenazi\` (0/1)

## Diseases

Pattern: \`{disease}_diagnosis_age: number\`

Built-in: \`breast_cancer\`, \`breast_cancer2\`, \`ovarian_cancer\`, \`pancreatic_cancer\`, \`prostate_cancer\`

Labels shown as: "breast ca.: 67", "ovarian ca.: 58"

Colors: breast=#F68F35, breast2=#FFC0CB, ovarian=#4DAA4D, pancreatic=#4289BA, prostate=#D5494A

## Gene Tests

Pattern: \`{gene}_gene_test: {type, result}\`

Genes: brca1, brca2, palb2, atm, chek2, rad51d, rad51c, brip1

Type: "-"=untested, "S"=screening, "T"=direct | Result: "-"=N/A, "P"=positive, "N"=negative

Labels shown as: "BRCA1+", "BRCA2-"

## Visual Features

- **Symbols:** □=male, ○=female, ◇=unknown
- **Disease:** Pie chart fill (multiple diseases=slices)
- **Deceased:** Diagonal line through symbol
- **Proband:** Arrow pointing to symbol
- **Twins:** Horizontal bar connecting siblings with same mztwin
- **Adopted:** Brackets [ ] around symbol (noparents=true)
- **Consanguinity:** Double partnership line (auto-detected from shared ancestry)

## Options

\`width\` (800), \`height\` (600), \`symbol_size\` (35), \`background\` (#ffffff), \`labels\` (['age'])

## Example

\`\`\`json
[
  {"name":"gf","sex":"M","top_level":true},
  {"name":"gm","sex":"F","top_level":true,"status":1,"breast_cancer_diagnosis_age":67,"ovarian_cancer_diagnosis_age":63},
  {"name":"f","sex":"M","mother":"gm","father":"gf","age":56},
  {"name":"m","sex":"F","breast_cancer_diagnosis_age":55,"age":63,"brca1_gene_test":{"type":"T","result":"P"}},
  {"name":"ana","display_name":"Ana","sex":"F","mother":"m","father":"f","proband":true,"age":25,"yob":1996}
]
\`\`\`

## Validation

- Parents must exist before children reference them
- Mother must be sex:"F", father must be sex:"M"
- Unique names required
- Founders need top_level:true
`;
