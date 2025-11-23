# Pedigree MCP Server

<p align="center">
  <img src="logo.png" alt="Pedigree Generator" width="128">
</p>

<p align="center">
  An MCP (Model Context Protocol) server for generating family pedigree tree diagrams as PNG images using standard genetic notation per <a href="https://onlinelibrary.wiley.com/doi/full/10.1007/s10897-008-9169-9">Bennett 2008 NSGC guidelines</a>.
</p>

<p align="center">
  <img src="example.png" alt="Example Pedigree" width="700">
</p>

## Installation

### Prerequisites
- Node.js 18+
- npm or pnpm

### Build from Source

```bash
# Clone and navigate to the directory
cd pedigree-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

### MCP Client Configuration

Add to your MCP client configuration (e.g., Claude Desktop, GPT Workbench):

**Using stdio transport:**
```json
{
  "mcpServers": {
    "pedigree": {
      "command": "node",
      "args": ["/path/to/pedigree-mcp/dist/index.js"],
      "env": {}
    }
  }
}
```

**Using npx (if published to npm):**
```json
{
  "mcpServers": {
    "pedigree": {
      "command": "npx",
      "args": ["pedigree-mcp"],
      "env": {}
    }
  }
}
```

## Features

### Bennett 2008 Standard Compliance

This implementation follows the [NSGC Standardized Human Pedigree Nomenclature](https://pubmed.ncbi.nlm.nih.gov/18792771/):

| Symbol | Description | Property |
|--------|-------------|----------|
| Square | Male | `sex: "M"` |
| Circle | Female | `sex: "F"` |
| Diamond | Unknown sex | `sex: "U"` |
| Filled shape | Affected individual | Disease properties |
| Diagonal line | Deceased | `status: 1` |
| Arrow (lower-left) | Proband | `proband: true` |
| Brackets [ ] | Adopted | `noparents: true` |
| Double line | Consanguinity | Auto-detected from shared ancestors |
| Horizontal bar | MZ (identical) twins | `mztwin: "group_id"` |
| Diagonal lines | DZ (fraternal) twins | `dztwin: "group_id"` |
| Dot in center | Carrier status | `carrier: true` |
| "P" inside symbol | Pregnancy | `pregnant: true` |
| Small triangle | Stillbirth/SAB/termination | `terminated: true` |
| Hash marks on line | Divorced/separated | `divorced: true` |

### Disease/Condition Markers

Supports **any hereditary condition** - not limited to cancer. Configure diseases per your use case:

```typescript
// Pass diseases config when generating pedigree
diseases: [
  { type: 'huntington', colour: '#6A5ACD' },
  { type: 'cardiomyopathy', colour: '#DC143C' },
  { type: 'cystic_fibrosis', colour: '#228B22' },
]
```

**Built-in presets available:**

| Preset | Conditions |
|--------|------------|
| `cancer` | breast, ovarian, colorectal, pancreatic, prostate |
| `cardiac` | cardiomyopathy, long_qt, marfan, sudden_death |
| `neurological` | huntington, alzheimer, parkinson, als |
| `hematological` | sickle_cell, hemophilia, thalassemia |

**Property patterns:**
- `{condition}_diagnosis_age: number` - Age at diagnosis (e.g., `huntington_diagnosis_age: 45`)
- `{condition}_affected: boolean` - Affected status without age (e.g., `cystic_fibrosis_affected: true`)

Multiple diseases show as quadrants (male) or pie slices (female).

### Genetic Testing Results

Supports **any gene** - use pattern `{gene}_gene_test`:

```json
{
  "brca1_gene_test": { "type": "T", "result": "P" },
  "htt_gene_test": { "type": "T", "result": "P" },
  "apoe_gene_test": { "type": "S", "result": "N" }
}
```

Gene test result codes:
- **type**: `T` (tested), `S` (screening), `-` (unknown)
- **result**: `P` (positive), `N` (negative), `-` (unknown/VUS)

Labels appear as: `BRCA1+` (positive), `HTT-` (negative), `APOE?` (unknown)

## Tools

### `get_pedigree_documentation`

Returns comprehensive documentation about the pedigree data format. **Always call this first** before generating a pedigree.

### `generate_pedigree`

Generates a PNG image of a family pedigree tree.

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `dataset` | `Individual[]` | required | Array of family members |
| `width` | `number` | 800 | Image width in pixels |
| `height` | `number` | 600 | Image height in pixels |
| `symbol_size` | `number` | 35 | Node diameter in pixels |
| `background` | `string` | #ffffff | Background color |
| `labels` | `string[]` | ['age'] | Attributes to display |

## Data Format

### Individual Object

```typescript
interface Individual {
  // Required
  name: string;           // Unique ID (max 13 chars recommended)
  sex: "M" | "F" | "U";   // Male, Female, Unknown

  // Identity
  display_name?: string;  // Human-readable name for display
  top_level?: boolean;    // Founding individual (no parents)
  proband?: boolean;      // Index case

  // Relationships
  mother?: string;        // Mother's name (must exist in dataset)
  father?: string;        // Father's name (must exist in dataset)

  // Demographics
  age?: number;           // Current age
  yob?: number;           // Year of birth
  status?: number;        // 0 = alive, 1 = deceased

  // Twins (Bennett standard)
  mztwin?: string;        // MZ twin group ID (identical)
  dztwin?: string;        // DZ twin group ID (fraternal)

  // Special indicators (Bennett standard)
  carrier?: boolean;      // Carrier status (dot in center)
  pregnant?: boolean;     // Current pregnancy (P inside symbol)
  terminated?: boolean;   // Stillbirth/SAB (small triangle)
  divorced?: boolean;     // Divorced from partner (hash marks)
  noparents?: boolean;    // Adopted (brackets around symbol)

  // Diseases (prefix_diagnosis_age pattern)
  breast_cancer_diagnosis_age?: number;
  ovarian_cancer_diagnosis_age?: number;
  // ... any disease matching configured patterns

  // Genetic tests
  brca1_gene_test?: { type: "-"|"S"|"T", result: "-"|"P"|"N" };
  brca2_gene_test?: { type: "-"|"S"|"T", result: "-"|"P"|"N" };
  // ... other gene tests
}
```

## Examples

### Basic Three-Generation Pedigree

```json
[
  {"name": "MGF", "sex": "M", "top_level": true},
  {"name": "MGM", "sex": "F", "top_level": true, "breast_cancer_diagnosis_age": 55},
  {"name": "Mother", "sex": "F", "mother": "MGM", "father": "MGF", "breast_cancer_diagnosis_age": 42},
  {"name": "Father", "sex": "M", "top_level": true},
  {"name": "Proband", "display_name": "Sarah", "sex": "F", "mother": "Mother", "father": "Father", "proband": true, "age": 25, "brca1_gene_test": {"type": "T", "result": "P"}}
]
```

### Twins Example

```json
[
  {"name": "Dad", "sex": "M", "top_level": true},
  {"name": "Mom", "sex": "F", "top_level": true},
  {"name": "Twin1", "sex": "M", "mother": "Mom", "father": "Dad", "mztwin": "mz1"},
  {"name": "Twin2", "sex": "M", "mother": "Mom", "father": "Dad", "mztwin": "mz1"},
  {"name": "DZTwin1", "sex": "M", "mother": "Mom", "father": "Dad", "dztwin": "dz1"},
  {"name": "DZTwin2", "sex": "F", "mother": "Mom", "father": "Dad", "dztwin": "dz1"}
]
```

### Complex Family with Bennett Features

```json
[
  {"name": "GF", "sex": "M", "top_level": true, "status": 1},
  {"name": "GM", "sex": "F", "top_level": true, "carrier": true},
  {"name": "Father", "sex": "M", "mother": "GM", "father": "GF", "divorced": true},
  {"name": "Mother", "sex": "F", "top_level": true},
  {"name": "Child1", "sex": "F", "mother": "Mother", "father": "Father", "proband": true, "noparents": true},
  {"name": "Loss", "sex": "U", "mother": "Mother", "father": "Father", "terminated": true}
]
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode (watch)
npm run dev

# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Build for production
npm run build

# Type check
npx tsc --noEmit
```

## Testing

- **101 tests total** covering:
  - Validation (parent references, gender constraints)
  - SVG rendering (all symbol types, indicators)
  - Disease markers and multi-disease quadrants
  - Gene test formatting
  - Twin rendering (MZ with bar, DZ without)
  - Consanguinity detection
  - Bennett 2008 compliance (carrier, pregnancy, termination, divorced)
  - Edge cases (deep pedigrees, wide generations, half-siblings)

## References

- [Bennett et al. 2008 - Standardized Human Pedigree Nomenclature](https://pubmed.ncbi.nlm.nih.gov/18792771/)
- [Bennett et al. 2022 - Sex and Gender Inclusivity Update](https://pubmed.ncbi.nlm.nih.gov/36106433/)
- [Iowa Human Genetics - How to Draw a Pedigree](https://humangenetics.medicine.uiowa.edu/resources/how-draw-pedigree)

## License

MIT License - see [LICENSE](LICENSE)
