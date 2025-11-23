import { PedigreeRenderer } from '../renderer/pedigree-renderer.js';
import type { Individual, PedigreeOptions } from '../types.js';

export interface GeneratePedigreeInput {
  dataset: Individual[];
  width?: number;
  height?: number;
  symbol_size?: number;
  background?: string;
  labels?: string[];
}

export interface GeneratePedigreeOutput {
  success: boolean;
  image_base64?: string;
  error?: string;
  metadata?: {
    width: number;
    height: number;
    individual_count: number;
    generation_count: number;
  };
}

export async function generatePedigree(input: GeneratePedigreeInput): Promise<GeneratePedigreeOutput> {
  try {
    if (!input.dataset || !Array.isArray(input.dataset) || input.dataset.length === 0) {
      return {
        success: false,
        error: 'Dataset is required and must be a non-empty array of individuals',
      };
    }

    const options: PedigreeOptions = {
      ...(input.width !== undefined && { width: input.width }),
      ...(input.height !== undefined && { height: input.height }),
      ...(input.symbol_size !== undefined && { symbol_size: input.symbol_size }),
      ...(input.background !== undefined && { background: input.background }),
      ...(input.labels !== undefined && { labels: input.labels }),
    };

    const renderer = new PedigreeRenderer(input.dataset, options);
    const pngBuffer = await renderer.render();

    // Calculate generation count
    const generations = new Set<number>();
    const genMap = new Map<string, number>();

    // Simple generation calculation
    const founders = input.dataset.filter((ind) => !ind.mother && !ind.father);
    const queue = founders.map((f) => ({ name: f.name, gen: 0 }));
    const processed = new Set<string>();

    while (queue.length > 0) {
      const { name, gen } = queue.shift()!;
      if (processed.has(name)) continue;
      processed.add(name);
      genMap.set(name, gen);
      generations.add(gen);

      for (const ind of input.dataset) {
        if ((ind.mother === name || ind.father === name) && !processed.has(ind.name)) {
          queue.push({ name: ind.name, gen: gen + 1 });
        }
      }
    }

    return {
      success: true,
      image_base64: pngBuffer.toString('base64'),
      metadata: {
        width: options.width || 800,
        height: options.height || 600,
        individual_count: input.dataset.length,
        generation_count: generations.size,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
