/**
 * Genetic test result per Bennett standard
 */
export interface GeneTest {
    type: '-' | 'S' | 'T'; // - = unknown, S = screening, T = tested
    result: '-' | 'P' | 'N'; // - = unknown/VUS, P = positive, N = negative
}

/**
 * Condition/disease affecting an individual
 * Per Bennett standard: free text condition name with optional age at diagnosis
 */
export interface Condition {
    name: string; // Free text: "Huntington's disease", "Breast cancer", "Type 2 diabetes"
    age?: number; // Age at diagnosis/onset
}

/**
 * Individual in the pedigree
 */
export interface Individual {
    name: string;
    sex: 'M' | 'F' | 'U'; // Sex assigned at birth (Bennett 2008)
    gender?: 'M' | 'F' | 'NB' | 'GNC' | 'TM' | 'TF'; // Gender identity (Bennett 2022): NB=non-binary, GNC=gender non-conforming, TM=trans male, TF=trans female
    sex_assigned_at_birth?: 'M' | 'F' | 'U'; // Explicit SAAB when gender differs (Bennett 2022)
    display_name?: string;
    top_level?: boolean;
    proband?: boolean;
    mother?: string;
    father?: string;
    age?: number;
    yob?: number;
    generation?: number; // Generation number (I, II, III, etc.) - Bennett numbering system
    status?: number; // 0 = alive, 1 = deceased
    mztwin?: string; // MZ twin group identifier
    dztwin?: string; // DZ twin group identifier
    ashkenazi?: number; // 0=no, 1=yes (Bennett: A marker)
    noparents?: boolean;
    adoption_type?: 'in' | 'out' | 'foster'; // Bennett: adoption direction (in=adopted into family, out=placed for adoption, foster=temporary)
    birth_order?: number; // Bennett: birth order in sibling group (1, 2, 3, etc.) - displayed as Roman numerals
    carrier?: boolean; // Carrier status (Bennett: dot in center)
    gene_copy_number?: 'heterozygous' | 'homozygous' | 'compound_heterozygous'; // Bennett: gene copy number for carrier testing
    pregnant?: boolean; // Pregnancy (Bennett: P inside symbol)
    terminated?: boolean; // Stillbirth/SAB/termination (Bennett: small/large triangle)
    terminated_age?: number; // Gestational age in weeks (affects triangle size)
    pregnancy_outcome?:
        | 'miscarriage'
        | 'induced_termination'
        | 'ectopic'
        | 'stillbirth'
        | 'unknown'; // Bennett: specific pregnancy outcome type
    divorced?: boolean; // Divorced/separated from partner (Bennett: hash marks)
    anticipation?: boolean; // Genetic anticipation (Bennett: special marker)
    ectopic?: boolean; // Ectopic pregnancy (Bennett: distinct marker)
    consultand?: boolean; // Consultand (vs proband - person seeking counseling)
    infertility?: boolean; // Infertility (Bennett: crossed-out symbol or marker)
    no_children_by_choice?: boolean; // No children by choice (Bennett: line through offspring line)
    yod?: number; // Year of death (to calculate age at death)
    obligate_carrier?: boolean; // Obligate carrier (inferred from pedigree)
    art_type?: 'egg_donor' | 'sperm_donor' | 'embryo_donor' | 'surrogate'; // Bennett: Assisted Reproductive Technology conception type
    relationship_type?: 'married' | 'unmarried' | 'common_law' | 'consensual'; // Bennett: partnership type (applied to one partner)

    // Conditions/diseases - FREE TEXT per Bennett standard
    // Examples:
    //   conditions: [{ name: "Huntington's disease", age: 45 }]
    //   conditions: [{ name: "Breast cancer", age: 42 }, { name: "Ovarian cancer", age: 55 }]
    //   conditions: [{ name: "Cystic fibrosis" }]  // no age = affected status only
    conditions?: Condition[];

    // Genetic tests - use pattern: {gene}_gene_test
    // Examples: brca1_gene_test, htt_gene_test, apoe_gene_test
    [key: string]:
        | string
        | number
        | boolean
        | GeneTest
        | Condition[]
        | undefined;
}

/**
 * Color palette for auto-assigning colors to conditions
 */
export const COLOR_PALETTE = [
    '#F68F35', // Orange
    '#4DAA4D', // Green
    '#4289BA', // Blue
    '#D5494A', // Red
    '#9370DB', // Purple
    '#20B2AA', // Teal
    '#FF6347', // Tomato
    '#6A5ACD', // Slate blue
    '#CD853F', // Peru
    '#708090', // Slate gray
];

export interface PedigreeOptions {
    width?: number;
    height?: number;
    symbol_size?: number;
    background?: string;
    node_background?: string;
    font_size?: string;
    font_family?: string;
    labels?: string[];
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
