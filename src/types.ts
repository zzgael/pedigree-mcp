export interface GeneTest {
  type: '-' | 'S' | 'T';
  result: '-' | 'P' | 'N';
}

export interface Individual {
  name: string;
  sex: 'M' | 'F' | 'U';
  display_name?: string;
  top_level?: boolean;
  proband?: boolean;
  mother?: string;
  father?: string;
  age?: number;
  yob?: number;
  status?: number; // 0 = alive, 1 = deceased
  mztwin?: string; // MZ twin group identifier
  dztwin?: string; // DZ twin group identifier (Bennett: diagonal lines, no bar)
  ashkenazi?: number;
  noparents?: boolean;
  carrier?: boolean; // Carrier status (Bennett: dot in center)
  pregnant?: boolean; // Pregnancy (Bennett: P inside symbol)
  terminated?: boolean; // Stillbirth/SAB/termination (Bennett: small triangle)
  divorced?: boolean; // Divorced/separated from partner (Bennett: hash marks on line)

  // Common disease diagnosis ages (but any {disease_type}_* property works)
  // The library uses prefix matching: any key starting with "{disease_type}_" indicates affected status
  breast_cancer_diagnosis_age?: number;
  breast_cancer2_diagnosis_age?: number;
  ovarian_cancer_diagnosis_age?: number;
  pancreatic_cancer_diagnosis_age?: number;
  prostate_cancer_diagnosis_age?: number;

  // Genetic tests
  brca1_gene_test?: GeneTest;
  brca2_gene_test?: GeneTest;
  palb2_gene_test?: GeneTest;
  atm_gene_test?: GeneTest;
  chek2_gene_test?: GeneTest;

  // Allow arbitrary disease properties (e.g., custom_disease_diagnosis_age: 45)
  [key: string]: string | number | boolean | GeneTest | undefined;
}

export interface DiseaseConfig {
  type: string;
  colour: string;
}

export interface PedigreeOptions {
  width?: number;
  height?: number;
  symbol_size?: number;
  background?: string;
  node_background?: string;
  font_size?: string;
  font_family?: string;
  labels?: string[];
  diseases?: DiseaseConfig[];
}

export const DEFAULT_OPTIONS: Required<PedigreeOptions> = {
  width: 800,
  height: 600,
  symbol_size: 35,
  background: '#ffffff',
  node_background: '#ffffff',
  font_size: '12px',
  font_family: 'Arial, sans-serif',
  labels: ['age'],
  diseases: [
    { type: 'breast_cancer', colour: '#F68F35' },
    { type: 'breast_cancer2', colour: '#FFC0CB' },
    { type: 'ovarian_cancer', colour: '#4DAA4D' },
    { type: 'pancreatic_cancer', colour: '#4289BA' },
    { type: 'prostate_cancer', colour: '#D5494A' },
  ],
};

export interface RenderedNode {
  individual: Individual;
  x: number;
  y: number;
  generation: number;
}

export interface FamilyUnit {
  father: Individual;
  mother: Individual;
  children: Individual[];
}
