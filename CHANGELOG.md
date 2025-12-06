# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Enhanced Bennett 2008/2022 Standard Compliance - 29 New Features Implemented (100% Compliance)**

**Phase 1: Core Missing Features (First 12 features)**
  - **Ashkenazi Ancestry Indicator**: "A" marker in upper right quadrant (`ashkenazi: 1`)
  - **Ectopic Pregnancy**: "EP" marker below symbol (`ectopic: true`)
  - **Infertility Indicator**: Crossed lines (X) through symbol (`infertility: true`)
  - **Genetic Anticipation**: Red asterisk (*) in upper left (`anticipation: true`)
  - **Obligate Carrier**: Outlined dot vs filled dot for known carrier (`obligate_carrier: true`)
  - **Consultand Indicator**: Double arrow vs single arrow for proband (`consultand: true`)
  - **Stillbirth vs Early Loss Distinction**: Triangle size based on gestational age (`terminated_age: number`)
    - Small triangle: <20 weeks (early pregnancy loss/SAB)
    - Large triangle: ≥20 weeks (stillbirth)
  - **Pregnancy Duration Display**: Gestational weeks label near "P" marker (`terminated_age` with `pregnant: true`)
  - **Age at Death**: Automatic calculation and display (yod - yob) for deceased individuals (`yod`, `yob`)
  - **Consanguinity Degree Labeling**: Optional text label on double lines (`consanguinity_degree: string`)
  - **No Children by Choice**: Line through offspring connection (`no_children_by_choice: true`)

**Phase 2: High Priority Bennett Features (Next 13 features)**
  - **Adoption Type Variations**:
    - Adopted IN: Standard brackets (`adoption_type: "in"` or `noparents: true`)
    - Adopted OUT: Arrow + "OUT" label (`adoption_type: "out"`)
    - Foster Placement: Dashed brackets (`adoption_type: "foster"`)
  - **Birth Order Notation**: Roman numerals (I, II, III, etc.) for sibling groups (`birth_order: number`)
  - **ART (Assisted Reproductive Technology) Indicators**:
    - Egg donor: "E" marker in blue (`art_type: "egg_donor"`)
    - Sperm donor: "S" marker in blue (`art_type: "sperm_donor"`)
    - Embryo donor: "Em" marker in blue (`art_type: "embryo_donor"`)
    - Gestational carrier: "GC" marker in blue (`art_type: "surrogate"`)
  - **Pregnancy Outcome Specificity**:
    - Spontaneous abortion: "SAB" label (`pregnancy_outcome: "miscarriage"`)
    - Termination of pregnancy: "TOP" label (`pregnancy_outcome: "induced_termination"`)
    - Stillbirth: "SB" label (`pregnancy_outcome: "stillbirth"`)
  - **Gene Copy Number Notation**:
    - Heterozygous: "Het" label in green (`gene_copy_number: "heterozygous"`)
    - Homozygous: "Hom" label in green (`gene_copy_number: "homozygous"`)
    - Compound heterozygous: "CH" label in green (`gene_copy_number: "compound_heterozygous"`)
  - **Relationship Type Indicators**:
    - Unmarried partnership: Dashed line (`relationship_type: "unmarried"`)
    - Common-law partnership: Dashed line (`relationship_type: "common_law"`)
    - Consensual union: Dashed line (`relationship_type: "consensual"`)

**Phase 3: Gender Diversity & Generation Numbering (Bennett 2022 Update - Final 4 features)**
  - **Gender Diversity** (Bennett 2022 Gender Inclusivity Update):
    - Gender identity marker: Shows when `gender ≠ sex` (supports TM/TF/NB/GNC)
    - Trans male: "TM" marker in purple (`gender: "TM"`, `sex: "F"`)
    - Trans female: "TF" marker in purple (`gender: "TF"`, `sex: "M"`)
    - Non-binary: "NB" marker in purple (`gender: "NB"`)
    - Gender non-conforming: "GNC" marker in purple (`gender: "GNC"`)
    - Sex assigned at birth: Explicit SAAB property (`sex_assigned_at_birth: "M" | "F" | "U"`)
  - **Generation Numbering** (Bennett Standard):
    - Roman numerals (I, II, III, etc.) positioned left of pedigree
    - Auto-generated from pedigree structure
    - Explicit generation assignment: `generation: number` property
    - Display option: `labels: ['generation']`

**Testing & Quality**:
  - Added 28 comprehensive tests for all new features (154 total tests passing)
  - Phase 1: 11 tests, Phase 2: 12 tests, Phase 3: 4 tests, Coverage: 7 tests
  - All tests include exact SVG element validation
  - Full coverage of all Bennett 2008 core features

- **Comprehensive Test Coverage with Exact Position Validation**
  - Added `tests/test-helpers.ts` with geometry validation utilities for SVG elements
  - Enhanced all 51 existing positioning tests with exact X/Y coordinate assertions (< 1px tolerance)
  - Created `tests/edge-cases.test.ts` with 13 new edge case tests covering:
    - MZ triplets with connecting bar
    - Mixed MZ/DZ twins from same parents
    - Twin bar positioning when twins have partners
    - First cousins once removed (different generations)
    - Double first cousins (two siblings marry two other siblings)
    - 15+ siblings without overlaps
    - Asymmetric sibships (8 kids on one branch, 1 on another)
    - 7+ generations without Y compression
    - Serial marriages (individual with 3+ partners)
    - Step-sibling relationships
    - Combined Bennett indicators (carrier+deceased, pregnant+affected, adopted+proband)
  - All 154 tests passing with 91.21% code coverage

**Code Coverage**:
  - 91.21% overall coverage (90% threshold)
  - 100% coverage: utils.ts, labels.ts, generate-pedigree.ts, get-documentation.ts
  - 95.55% coverage: drawing.ts
  - 86.3% coverage: pedigree-renderer.ts
  - Added 7 tests for coverage completion (DZ twins, consanguinity degree, generate options)

### Changed
- **Test Quality Improvements**
  - All positioning tests now validate exact X/Y coordinates using `calculatePositions()`
  - SVG geometry extraction handles relative coordinates within group transforms
  - Position assertions verify generational ordering, partnership centering, sibling spacing
  - Special indicator tests validate precise element positioning (carrier dots, pregnancy "P", adoption brackets, twin bars, etc.)

### Fixed
- Improved test reliability by handling SVG group transform coordinates
- Added proper tolerance for multiple partnership positioning constraints
- Fixed twin bar detection to handle adaptive Y positioning
- Enhanced adoption bracket path parsing to work with relative coordinates

## [1.0.12] - Previous Release

- See git history for previous changes
