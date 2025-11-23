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
    dztwin?: string; // DZ twin group identifier
    ashkenazi?: number;
    noparents?: boolean;
    carrier?: boolean; // Carrier status (Bennett: dot in center)
    pregnant?: boolean; // Pregnancy (Bennett: P inside symbol)
    terminated?: boolean; // Stillbirth/SAB/termination (Bennett: small triangle)
    divorced?: boolean; // Divorced/separated from partner (Bennett: hash marks)

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
