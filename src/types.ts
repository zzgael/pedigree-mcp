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

  // Disease/condition affected status
  // Use pattern: {condition}_diagnosis_age or {condition}_affected
  // The library uses prefix matching: any key starting with "{condition}_" indicates affected status
  // Examples for ANY hereditary condition:
  //
  // CANCERS:
  //   breast_cancer_diagnosis_age, ovarian_cancer_diagnosis_age, colorectal_cancer_diagnosis_age
  //   prostate_cancer_diagnosis_age, melanoma_diagnosis_age, thyroid_cancer_diagnosis_age
  //
  // CARDIAC:
  //   cardiomyopathy_diagnosis_age, long_qt_diagnosis_age, marfan_affected
  //
  // NEUROLOGICAL:
  //   huntington_diagnosis_age, alzheimer_diagnosis_age, als_diagnosis_age
  //   muscular_dystrophy_diagnosis_age, parkinson_diagnosis_age
  //
  // METABOLIC/GENETIC:
  //   cystic_fibrosis_affected, pku_affected, tay_sachs_affected
  //   sickle_cell_affected, hemophilia_affected, thalassemia_affected
  //
  // CONNECTIVE TISSUE:
  //   ehlers_danlos_affected, osteogenesis_imperfecta_affected
  //
  // MENTAL HEALTH:
  //   bipolar_diagnosis_age, schizophrenia_diagnosis_age
  //
  // Genetic tests (any gene, use pattern: {gene}_gene_test)
  // Examples: brca1_gene_test, brca2_gene_test, msh2_gene_test, apoe_gene_test, htt_gene_test

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

// Common disease presets for quick configuration
export const DISEASE_PRESETS = {
  // Hereditary cancer syndromes (HBOC, Lynch, etc.)
  cancer: [
    { type: 'breast_cancer', colour: '#F68F35' },
    { type: 'ovarian_cancer', colour: '#4DAA4D' },
    { type: 'colorectal_cancer', colour: '#8B4513' },
    { type: 'pancreatic_cancer', colour: '#4289BA' },
    { type: 'prostate_cancer', colour: '#D5494A' },
  ],
  // Cardiac conditions
  cardiac: [
    { type: 'cardiomyopathy', colour: '#DC143C' },
    { type: 'long_qt', colour: '#FF6347' },
    { type: 'marfan', colour: '#9370DB' },
    { type: 'sudden_death', colour: '#000000' },
  ],
  // Neurological conditions
  neurological: [
    { type: 'huntington', colour: '#6A5ACD' },
    { type: 'alzheimer', colour: '#708090' },
    { type: 'parkinson', colour: '#2F4F4F' },
    { type: 'als', colour: '#483D8B' },
  ],
  // Hematological conditions
  hematological: [
    { type: 'sickle_cell', colour: '#B22222' },
    { type: 'hemophilia', colour: '#8B0000' },
    { type: 'thalassemia', colour: '#CD5C5C' },
  ],
};

export const DEFAULT_OPTIONS: Required<PedigreeOptions> = {
  width: 800,
  height: 600,
  symbol_size: 35,
  background: '#ffffff',
  node_background: '#ffffff',
  font_size: '12px',
  font_family: 'Arial, sans-serif',
  labels: ['age'],
  diseases: [], // No default - user must specify diseases for their use case
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
