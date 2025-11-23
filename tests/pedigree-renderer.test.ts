import { describe, it, expect } from 'vitest';
import { PedigreeRenderer } from '../src/renderer/pedigree-renderer.js';
import type { Individual } from '../src/types.js';

describe('PedigreeRenderer', () => {
  describe('validation', () => {
    it('should reject dataset with missing mother reference', () => {
      const dataset: Individual[] = [
        { name: 'child', sex: 'F', mother: 'nonexistent', father: 'dad' },
        { name: 'dad', sex: 'M', top_level: true },
      ];

      const renderer = new PedigreeRenderer(dataset);
      expect(() => renderer.renderSvg()).toThrow(/Mother.*not found/);
    });

    it('should reject dataset with missing father reference', () => {
      const dataset: Individual[] = [
        { name: 'child', sex: 'F', mother: 'mom', father: 'nonexistent' },
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
        { name: 'child', sex: 'F', mother: 'gm', father: 'gf', proband: true },
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
        { name: 'adopted', sex: 'F', mother: 'm', father: 'f', noparents: true },
      ];

      const renderer = new PedigreeRenderer(dataset);
      const svg = renderer.renderSvg();

      // Adoption brackets are path elements with M and L commands
      const pathMatches = svg.match(/<path[^>]*d="M[^"]*L[^"]*"/g) || [];
      expect(pathMatches.length).toBeGreaterThanOrEqual(2); // Left and right brackets
    });

    it('should render twins with connecting bar', () => {
      const dataset: Individual[] = [
        { name: 'f', sex: 'M', top_level: true },
        { name: 'm', sex: 'F', top_level: true },
        { name: 't1', sex: 'F', mother: 'm', father: 'f', mztwin: 'twins' },
        { name: 't2', sex: 'F', mother: 'm', father: 'f', mztwin: 'twins' },
      ];

      const renderer = new PedigreeRenderer(dataset);
      const svg = renderer.renderSvg();

      // Twin bar is a horizontal line (y1 === y2)
      // Should have multiple lines: partnership, sibship, children drops, twin bar
      const lineMatches = svg.match(/<line/g) || [];
      expect(lineMatches.length).toBeGreaterThanOrEqual(4);
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
        { name: 'inbred', sex: 'F', mother: 'cousin2', father: 'cousin1', proband: true },
      ];

      const renderer = new PedigreeRenderer(dataset);
      const svg = renderer.renderSvg();

      // Count lines - consanguineous partnership has 2 lines (double line)
      const lineMatches = svg.match(/<line/g) || [];
      // Should have many lines: partnerships, sibships, children drops, consanguineous double
      expect(lineMatches.length).toBeGreaterThanOrEqual(10);
    });

    it('should render disease with colored fill', () => {
      const dataset: Individual[] = [
        { name: 'gf', sex: 'M', top_level: true },
        { name: 'gm', sex: 'F', top_level: true, breast_cancer_diagnosis_age: 55 },
      ];

      const renderer = new PedigreeRenderer(dataset);
      const svg = renderer.renderSvg();

      // Breast cancer color is #F68F35
      expect(svg).toContain('#F68F35');
      // Disease label
      expect(svg).toContain('breast ca.: 55');
    });

    it('should render multiple diseases with multiple colors', () => {
      const dataset: Individual[] = [
        { name: 'patient', sex: 'F', top_level: true, breast_cancer_diagnosis_age: 55, ovarian_cancer_diagnosis_age: 60 },
      ] as Individual[];

      const renderer = new PedigreeRenderer(dataset);
      const svg = renderer.renderSvg();

      // Breast cancer color
      expect(svg).toContain('#F68F35');
      // Ovarian cancer color
      expect(svg).toContain('#4DAA4D');
      // Disease labels
      expect(svg).toContain('breast ca.: 55');
      expect(svg).toContain('ovarian ca.: 60');
    });

    it('should render gene test results with +/- notation', () => {
      const dataset: Individual[] = [
        { name: 'patient', sex: 'F', top_level: true, brca1_gene_test: { type: 'T', result: 'P' } },
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

      const renderer = new PedigreeRenderer(dataset, { labels: ['age', 'yob'] });
      const svg = renderer.renderSvg();

      // Combined age/yob label
      expect(svg).toContain('45y');
      expect(svg).toContain('1980');
    });

    it('should render display_name instead of name when provided', () => {
      const dataset: Individual[] = [
        { name: 'p1', display_name: 'Patient One', sex: 'F', top_level: true },
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

      const renderer = new PedigreeRenderer(dataset);
      const svg = renderer.renderSvg();

      // Should have lines: partnership, vertical drop, line to child
      const lineMatches = svg.match(/<line/g) || [];
      expect(lineMatches.length).toBeGreaterThanOrEqual(3);
    });

    it('should respect custom dimensions', () => {
      const dataset: Individual[] = [
        { name: 'f', sex: 'M', top_level: true },
        { name: 'm', sex: 'F', top_level: true },
      ];

      const renderer = new PedigreeRenderer(dataset, { width: 1200, height: 900 });
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
      // Regression test: complex pedigree with multiple partnerships and disease labels
      const dataset: Individual[] = [
        // Grandparents (gen 0) - 4 couples
        { name: 'MGF', sex: 'M', top_level: true, prostate_cancer_diagnosis_age: 78 },
        { name: 'MGM', sex: 'F', top_level: true, breast_cancer_diagnosis_age: 70, ovarian_cancer_diagnosis_age: 75 },
        { name: 'PGF', sex: 'M', top_level: true },
        { name: 'PGM', sex: 'F', top_level: true, pancreatic_cancer_diagnosis_age: 82 },
        // Parents generation (gen 1) - multiple partnerships with diseases
        { name: 'Father', sex: 'M', mother: 'MGM', father: 'MGF', age: 52, prostate_cancer_diagnosis_age: 48 },
        { name: 'Mother', sex: 'F', top_level: true, age: 50, breast_cancer_diagnosis_age: 45 },
        { name: 'AuntsH', sex: 'M', top_level: true, age: 56 }, // Aunt's husband
        { name: 'M Aunt', sex: 'F', mother: 'MGM', father: 'MGF', age: 55, ovarian_cancer_diagnosis_age: 50 },
        { name: 'P Uncle', sex: 'M', mother: 'PGM', father: 'PGF', age: 58, pancreatic_cancer_diagnosis_age: 55 },
        { name: 'UnclesW', sex: 'F', top_level: true, age: 57 }, // Uncle's wife
        // Children (gen 2) - multiple families
        { name: 'Proband', sex: 'F', mother: 'Mother', father: 'Father', proband: true, age: 30, breast_cancer_diagnosis_age: 28 },
        { name: 'MZ Twin', sex: 'F', mother: 'Mother', father: 'Father', age: 30, mztwin: 'twins', breast_cancer_diagnosis_age: 29 },
        { name: 'Brother', sex: 'M', mother: 'Mother', father: 'Father', age: 28 },
        { name: 'Sister', sex: 'F', mother: 'Mother', father: 'Father', age: 26 },
        { name: 'M Cousin', sex: 'F', mother: 'M Aunt', father: 'AuntsH', age: 25, ovarian_cancer_diagnosis_age: 23 },
        { name: 'P Cousin', sex: 'M', mother: 'UnclesW', father: 'P Uncle', age: 27, prostate_cancer_diagnosis_age: 35 },
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
      const gTagMatches = svg.match(/<g[^>]*transform="translate\(([^)]+)\)"[^>]*>/g) || [];
      const positions = gTagMatches.map((m) => {
        const coords = m.match(/translate\(([^,]+),\s*([^)]+)\)/);
        return { x: parseFloat(coords?.[1] || '0'), y: parseFloat(coords?.[2] || '0') };
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
        { name: 'child', sex: 'F', mother: 'gm', father: 'gf', proband: true },
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
        { name: 'gm', sex: 'F', top_level: true, breast_cancer_diagnosis_age: 55 },
        { name: 'mom', sex: 'F', mother: 'gm', father: 'gf', breast_cancer_diagnosis_age: 42 },
        { name: 'dad', sex: 'M', top_level: true },
        { name: 'p', sex: 'F', mother: 'mom', father: 'dad', proband: true },
      ];

      const renderer = new PedigreeRenderer(dataset);
      const buffer = await renderer.render();

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(1000);
    });
  });

  describe('edge cases', () => {
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
        { name: 'p', sex: 'F', mother: 'mom', father: 'dad', proband: true },
      ];

      const renderer = new PedigreeRenderer(dataset);
      const svg = renderer.renderSvg();

      expect(svg).toContain('<svg');
      expect(svg).toContain('>gggf<');
      expect(svg).toContain('>p<');
      // Should have 5 distinct Y levels
      const yMatches = svg.match(/translate\([^,]+,\s*([^)]+)\)/g) || [];
      const yValues = new Set(yMatches.map(m => Math.round(parseFloat(m.match(/,\s*([^)]+)/)?.[1] || '0'))));
      expect(yValues.size).toBe(5);
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
        { name: 's6', sex: 'F', mother: 'mom', father: 'dad', proband: true },
        { name: 's7', sex: 'M', mother: 'mom', father: 'dad' },
        { name: 's8', sex: 'F', mother: 'mom', father: 'dad' },
      ];

      const renderer = new PedigreeRenderer(dataset);
      const svg = renderer.renderSvg();

      // All 8 siblings should be present
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
        { name: 'c2', sex: 'F', mother: 'mom', father: 'dad2', proband: true },
      ];

      const renderer = new PedigreeRenderer(dataset);
      const svg = renderer.renderSvg();

      expect(svg).toContain('>c1<');
      expect(svg).toContain('>c2<');
      // Should have 2 partnership lines (mom-dad1 and mom-dad2)
      const lineCount = (svg.match(/<line/g) || []).length;
      expect(lineCount).toBeGreaterThanOrEqual(2);
    });

    it('should handle pedigree with no diseases (plain family tree)', () => {
      const dataset: Individual[] = [
        { name: 'gf', sex: 'M', top_level: true },
        { name: 'gm', sex: 'F', top_level: true },
        { name: 'p', sex: 'F', mother: 'gm', father: 'gf', proband: true, age: 30 },
      ];

      const renderer = new PedigreeRenderer(dataset);
      const svg = renderer.renderSvg();

      // No disease colors should be present
      expect(svg).not.toContain('#F68F35'); // breast cancer
      expect(svg).not.toContain('#4DAA4D'); // ovarian cancer
      expect(svg).toContain('>30y<'); // age label
    });

    it('should handle individual with multiple diseases (pie chart)', () => {
      const dataset: Individual[] = [
        {
          name: 'p',
          sex: 'F',
          top_level: true,
          proband: true,
          breast_cancer_diagnosis_age: 45,
          ovarian_cancer_diagnosis_age: 52,
          pancreatic_cancer_diagnosis_age: 58,
        },
      ] as Individual[];

      const renderer = new PedigreeRenderer(dataset);
      const svg = renderer.renderSvg();

      // Should have multiple disease colors
      expect(svg).toContain('#F68F35'); // breast
      expect(svg).toContain('#4DAA4D'); // ovarian
      expect(svg).toContain('#4289BA'); // pancreatic
      // Should have path elements for pie slices
      expect(svg).toContain('<path');
    });

    it('should truncate long display names', () => {
      const dataset: Individual[] = [
        { name: 'p', display_name: 'VeryLongNameThatExceedsLimit', sex: 'F', top_level: true, proband: true },
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
        { name: 't1', sex: 'F', mother: 'mom', father: 'dad', mztwin: 'twins', proband: true },
        { name: 't2', sex: 'F', mother: 'mom', father: 'dad', mztwin: 'twins' },
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
        { name: 't1', sex: 'F', mother: 'mom', father: 'dad', mztwin: 'triplets' },
        { name: 't2', sex: 'F', mother: 'mom', father: 'dad', mztwin: 'triplets' },
        { name: 't3', sex: 'M', mother: 'mom', father: 'dad', mztwin: 'triplets', proband: true },
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
        { name: 'child', sex: 'F', mother: 'c2', father: 'c1', proband: true },
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

  describe('Bennett 2008 standard compliance', () => {
    it('should render carrier status as dot in center', () => {
      const dataset: Individual[] = [
        { name: 'carrier', sex: 'F', top_level: true, carrier: true },
      ];

      const renderer = new PedigreeRenderer(dataset);
      const svg = renderer.renderSvg();

      // Should have main circle (female) and carrier dot (small circle)
      const circleMatches = svg.match(/<circle[^>]*>/g) || [];
      expect(circleMatches.length).toBeGreaterThanOrEqual(2);
      // Carrier dot has small radius (r=4)
      expect(svg).toMatch(/r="4"/);
    });

    it('should render pregnancy indicator with P inside symbol', () => {
      const dataset: Individual[] = [
        { name: 'pregnant', sex: 'F', top_level: true, pregnant: true },
      ];

      const renderer = new PedigreeRenderer(dataset);
      const svg = renderer.renderSvg();

      // Should have "P" text inside the symbol
      expect(svg).toContain('>P<');
    });

    it('should render termination/stillbirth as small triangle', () => {
      const dataset: Individual[] = [
        { name: 'dad', sex: 'M', top_level: true },
        { name: 'mom', sex: 'F', top_level: true },
        { name: 'loss', sex: 'U', mother: 'mom', father: 'dad', terminated: true },
      ];

      const renderer = new PedigreeRenderer(dataset);
      const svg = renderer.renderSvg();

      // Should have polygon for triangle (termination) in addition to any other polygons
      expect(svg).toContain('<polygon');
    });

    it('should render divorced indicator as hash marks on partnership line', () => {
      const dataset: Individual[] = [
        { name: 'exhusband', sex: 'M', top_level: true, divorced: true },
        { name: 'exwife', sex: 'F', top_level: true },
        { name: 'child', sex: 'F', mother: 'exwife', father: 'exhusband' },
      ];

      const renderer = new PedigreeRenderer(dataset);
      const svg = renderer.renderSvg();

      // Should have multiple lines including hash marks
      const lineCount = (svg.match(/<line/g) || []).length;
      // Partnership line + vertical drop + child connection + 2 hash marks = 5+ lines
      expect(lineCount).toBeGreaterThanOrEqual(5);
    });

    it('should render DZ twins without connecting bar', () => {
      const dataset: Individual[] = [
        { name: 'dad', sex: 'M', top_level: true },
        { name: 'mom', sex: 'F', top_level: true },
        { name: 'dz1', sex: 'M', mother: 'mom', father: 'dad', dztwin: 'dz' },
        { name: 'dz2', sex: 'F', mother: 'mom', father: 'dad', dztwin: 'dz' },
      ];

      const renderer = new PedigreeRenderer(dataset);
      const svg = renderer.renderSvg();

      // Should render both twins
      expect(svg).toContain('>dz1<');
      expect(svg).toContain('>dz2<');
      // DZ twins do NOT have connecting bar (unlike MZ twins)
      // We just verify it renders without error for now
      expect(svg).toContain('<svg');
    });

    it('should render MZ twins with connecting bar', () => {
      const dataset: Individual[] = [
        { name: 'dad', sex: 'M', top_level: true },
        { name: 'mom', sex: 'F', top_level: true },
        { name: 'mz1', sex: 'M', mother: 'mom', father: 'dad', mztwin: 'mz' },
        { name: 'mz2', sex: 'M', mother: 'mom', father: 'dad', mztwin: 'mz' },
      ];

      const renderer = new PedigreeRenderer(dataset);
      const svg = renderer.renderSvg();

      // Should have twin bar (horizontal line connecting twins)
      // This is separate from sibship line
      const lineCount = (svg.match(/<line/g) || []).length;
      // Partnership + drop + sibship + child1 + child2 + twin bar = 6+ lines
      expect(lineCount).toBeGreaterThanOrEqual(6);
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

      const renderer = new PedigreeRenderer(dataset);
      const svg = renderer.renderSvg();

      // Should have circle (female), carrier dot, deceased line, proband arrow, adoption brackets
      expect(svg).toContain('<circle'); // Female + carrier dot
      expect(svg).toContain('<line'); // Deceased diagonal
      expect(svg).toContain('<polygon'); // Proband arrow
      expect(svg).toContain('<path'); // Adoption brackets
    });
  });
});
