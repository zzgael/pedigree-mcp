export const PEDIGREEJS_DOCUMENTATION = `# Pedigree Generator

Generates PNG pedigree trees following Bennett 2008 NSGC standard notation.

## ⚠️ Auto-Truncation: name truncated to 7 chars, display_name to 13 chars

## Individual Properties

**Required:** \`name\` (unique ID), \`sex\` (M/F/U)

**Family Connections:**
- \`mother\`, \`father\` - References to existing individuals. **Siblings share the same mother AND father.**
- \`top_level: true\` - ONLY for founders with NO known parents (e.g., grandparents at top of tree)

⚠️ **CRITICAL RULES:**
1. If an individual has parents in the pedigree, use \`mother\`/\`father\` - NOT \`top_level: true\`
2. Siblings without partners still need \`mother\`/\`father\` to connect them to the family tree
3. Married-in spouses (spouse's parents not shown) use \`top_level: true\` - they connect via having children together

**Edge Cases:**
- **Half-siblings:** Same mother, different fathers: \`{"name":"s1","mother":"mom","father":"dad1"}\` and \`{"name":"s2","mother":"mom","father":"dad2"}\`
- **Unknown parent:** Omit parent field (don't use top_level): \`{"name":"child","mother":"mom"}\` (father unknown)
- **Multiple conditions:** Displays as pie slices (female) or quadrants (male): \`conditions:[{"name":"Breast cancer","age":42},{"name":"Ovarian cancer","age":55}]\`
- **Consanguinity:** Auto-detected from shared ancestors, or manually specify: \`consanguinity_degree:"1st cousins"\`

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
- \`terminated: true\` - Small triangle for PREGNANCY LOSS ONLY (stillbirth/miscarriage/termination). ⚠️ NEVER use for living individuals!
- \`divorced: true\` - Hash marks on partnership line

**Adoption:**
- \`noparents: true\` - Adopted IN (shows brackets [ ])
- \`adoption_type: "out"\` - Placed for adoption (arrow + "OUT" label)
- \`adoption_type: "foster"\` - Foster placement (dashed brackets)

**Gender Diversity (Bennett 2022):**
- \`gender\`: "M"|"F"|"NB"|"GNC"|"TM"|"TF" - Gender identity (shows marker if ≠ sex)
- \`sex_assigned_at_birth\`: "M"|"F"|"U" - For trans individuals

**ART Conception:**
- \`art_type: "egg_donor"\` - E marker (blue)
- \`art_type: "sperm_donor"\` - S marker (blue)
- \`art_type: "surrogate"\` - GC marker (gestational carrier, blue)
- \`art_type: "embryo_donor"\` - Em marker (blue)

**Additional Indicators:**
- \`birth_order: 1\` - Displays as Roman numeral (I, II, III)
- \`consultand: true\` - Person seeking counseling (double arrow, distinct from proband)
- \`obligate_carrier: true\` - Inferred carrier (outlined dot)
- \`anticipation: true\` - Genetic anticipation (asterisk *)
- \`infertility: true\` - Infertility (crossed lines X)
- \`no_children_by_choice: true\` - Intentional childlessness (line through offspring)
- \`ectopic: true\` - Ectopic pregnancy (triangle with diagonal slash)
- \`pregnancy_outcome\`: "miscarriage" (SAB label) | "stillbirth" (SB label) | "induced_termination" (TOP label)
- \`gene_copy_number\`: "heterozygous" (Het) | "homozygous" (Hom) | "compound_heterozygous" (CH)
- \`consanguinity_degree\`: "1st cousins" - Manual override for auto-detected consanguinity

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

Pattern: \`{gene}_gene_test: {type, result}\` - **ANY gene supported**

**Common genes:** brca1, brca2, palb2, atm, chek2, rad51d, rad51c, brip1
**Custom genes:** htt_gene_test, tp53_gene_test, apoe_gene_test, or ANY gene

Type: "-"=untested, "S"=screening, "T"=tested | Result: "-"=N/A, "P"=positive, "N"=negative

Labels shown as: "BRCA1+", "HTT-", "TP53+"

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
  {"name":"aunt","sex":"F","mother":"gm","father":"gf","age":58,"pregnant":true},
  {"name":"m","sex":"F","top_level":true,"conditions":[{"name":"Breast cancer","age":55}],"age":63,"brca1_gene_test":{"type":"T","result":"P"}},
  {"name":"ana","display_name":"Ana","sex":"F","mother":"m","father":"f","proband":true,"age":25,"yob":1996}
]
\`\`\`

Note: \`aunt\` has same parents as \`f\` (siblings) but no partner - she's still connected via \`mother\`/\`father\`.
\`m\` uses \`top_level:true\` because her parents aren't in the pedigree (married into family).

## Validation

- Parents must exist before children reference them
- Mother must be sex:"F", father must be sex:"M"
- Unique names required
- Founders need top_level:true
`;
