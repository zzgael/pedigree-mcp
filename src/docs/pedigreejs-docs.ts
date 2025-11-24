export const PEDIGREEJS_DOCUMENTATION = `# Pedigree Generator

Generates PNG pedigree trees following Bennett 2008 NSGC standard notation.

## ⚠️ LIMITS: name≤7chars, display_name≤13chars

## Individual Properties

**Required:** \`name\` (unique ID), \`sex\` (M/F/U)

**Family:** \`mother\`, \`father\` (refs to existing individuals), \`top_level\` (true for founders)

**Display:** \`display_name\`, \`proband\` (index case), \`age\`, \`yob\`, \`status\` (0=alive, 1=deceased)

**Special:** \`noparents\` (adopted, shows brackets), \`mztwin\`/\`dztwin\` (same value=twins), \`ashkenazi\` (0/1)

## Conditions (Bennett Standard - FREE TEXT) → COLORED FILLS

⚠️ **Only \`conditions\` array entries trigger colored symbol fills.** Gene tests alone do NOT color the symbol.

Use \`conditions\` array with any disease/condition name:

\`\`\`json
"conditions": [
  { "name": "Breast cancer", "age": 42 },
  { "name": "Ovarian cancer", "age": 55 }
]
\`\`\`

**Examples:**
- \`{ "name": "Huntington's disease", "age": 45 }\`
- \`{ "name": "Type 2 diabetes" }\` (no age = affected status only)
- \`{ "name": "Cystic fibrosis" }\`
- \`{ "name": "Hereditary hemochromatosis", "age": 38 }\`

**Colors are auto-assigned** from palette based on unique condition names. Multiple conditions = pie chart slices.

## Bennett Standard Indicators

- \`carrier: true\` - Dot in center (obligate/carrier status)
- \`pregnant: true\` - "P" inside symbol
- \`terminated: true\` - Small triangle (stillbirth/SAB/termination)
- \`divorced: true\` - Hash marks on partnership line

## Gene Tests (Labels Only - NO Color Fill)

⚠️ **Gene tests only add text labels (e.g., "BRCA1+"), NOT colored fills.**

To show both a gene test label AND a colored condition fill, use BOTH properties:

\`\`\`json
{
  "name": "mom",
  "sex": "F",
  "conditions": [{ "name": "Breast cancer", "age": 45 }],
  "brca1_gene_test": { "type": "T", "result": "P" }
}
\`\`\`
Result: Pink/red fill for breast cancer + "BRCA1+" label below.

Pattern: \`{gene}_gene_test: {type, result}\`

Genes: brca1, brca2, palb2, atm, chek2, rad51d, rad51c, brip1

Type: "-"=untested, "S"=screening, "T"=direct | Result: "-"=N/A, "P"=positive, "N"=negative

Labels shown as: "BRCA1+", "BRCA2-"

## Visual Features

- **Symbols:** □=male, ○=female, ◇=unknown, △=terminated pregnancy
- **Conditions:** Colored fill/pie chart (multiple conditions=slices)
- **Deceased:** Diagonal line through symbol
- **Proband:** Arrow pointing to symbol
- **MZ Twins:** Horizontal bar connecting siblings with same \`mztwin\`
- **DZ Twins:** Siblings with same \`dztwin\` value
- **Adopted:** Brackets [ ] around symbol (\`noparents: true\`)
- **Consanguinity:** Double partnership line (auto-detected)
- **Carrier:** Dot in center of symbol
- **Divorced:** Double hash marks on partnership line

## Options

\`width\` (800), \`height\` (600), \`symbol_size\` (35), \`background\` (#ffffff)

\`labels\`: Controls age/yob display only. Values: \`['age']\`, \`['yob']\`, \`['age','yob']\`, or \`[]\`. Condition and gene test labels are always shown automatically.

## Example

\`\`\`json
[
  {"name":"gf","sex":"M","top_level":true,"conditions":[{"name":"Heart disease","age":72}]},
  {"name":"gm","sex":"F","top_level":true,"status":1,"conditions":[{"name":"Breast cancer","age":67},{"name":"Ovarian cancer","age":63}]},
  {"name":"f","sex":"M","mother":"gm","father":"gf","age":56,"carrier":true},
  {"name":"m","sex":"F","conditions":[{"name":"Breast cancer","age":55}],"age":63,"brca1_gene_test":{"type":"T","result":"P"}},
  {"name":"ana","display_name":"Ana","sex":"F","mother":"m","father":"f","proband":true,"age":25,"yob":1996}
]
\`\`\`

## Validation

- Parents must exist before children reference them
- Mother must be sex:"F", father must be sex:"M"
- Unique names required
- Founders need top_level:true
`;
