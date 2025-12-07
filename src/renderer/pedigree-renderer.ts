/**
 * Pedigree tree renderer
 * Uses D3.js for SVG generation and sharp for PNG conversion
 */

import * as d3 from 'd3';
import { JSDOM } from 'jsdom';
import sharp from 'sharp';
import { DEFAULT_OPTIONS, COLOR_PALETTE } from '../types.js';
import type { Individual, PedigreeOptions, Condition } from '../types.js';
import { isConsanguineous, getTwins, getDzTwins } from './utils.js';
import { getGeneTestLabels } from './labels.js';

interface ConditionColor {
    name: string;
    colour: string;
}

import {
    drawMaleSymbol,
    drawFemaleSymbol,
    drawUnknownSymbol,
    drawDeceasedIndicator,
    drawProbandIndicator,
    drawAdoptionBrackets,
    drawAdoptedOutIndicator,
    drawFosterIndicator,
    drawPartnershipLine,
    drawLine,
    drawTwinBar,
    drawDzTwinLines,
    drawLabel,
    drawCarrierIndicator,
    drawPregnancyIndicator,
    drawAshkenaziIndicator,
    drawConsultandIndicator,
    drawAnticipationIndicator,
    drawObligateCarrierIndicator,
    drawInfertilityIndicator,
    drawPregnancyDurationLabel,
    drawPregnancyOutcomeLabel,
    drawConsanguinityDegreeLabel,
    drawNoChildrenByChoiceIndicator,
    drawBirthOrderLabel,
    drawARTIndicator,
    drawGeneCopyNumberLabel,
    drawGenderIdentityMarker,
    drawGenerationNumber,
    drawTerminationSymbol,
    drawDivorcedIndicator,
    drawLegend,
} from './drawing.js';

interface NodePosition {
    individual: Individual;
    x: number;
    y: number;
    generation: number;
}

interface Partnership {
    partner1: string;
    partner2: string;
    children: string[];
}

export class PedigreeRenderer {
    private options: Required<PedigreeOptions>;
    private individuals: Map<string, Individual>;
    private nodePositions: Map<string, NodePosition>;
    private partnerships: Partnership[];
    private conditionColorMap: Map<string, string>;

    constructor(
        private dataset: Individual[],
        options: PedigreeOptions = {},
    ) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.individuals = new Map();
        this.nodePositions = new Map();
        this.partnerships = [];
        this.conditionColorMap = new Map();

        for (const ind of dataset) {
            this.individuals.set(ind.name, ind);
        }

        // Build color map from all conditions in dataset
        this.buildConditionColorMap();
    }

    /**
     * Auto-assign colors to all unique conditions found in the dataset
     */
    private buildConditionColorMap(): void {
        const allConditions = new Set<string>();

        for (const ind of this.dataset) {
            if (ind.conditions) {
                for (const condition of ind.conditions) {
                    allConditions.add(condition.name);
                }
            }
        }

        let colorIndex = 0;
        for (const conditionName of allConditions) {
            this.conditionColorMap.set(
                conditionName,
                COLOR_PALETTE[colorIndex % COLOR_PALETTE.length],
            );
            colorIndex++;
        }
    }

    private validateDataset(): string[] {
        const errors: string[] = [];

        for (const ind of this.dataset) {
            if (ind.mother && !this.individuals.has(ind.mother)) {
                errors.push(
                    `Mother '${ind.mother}' not found for '${ind.name}'`,
                );
            }
            if (ind.father && !this.individuals.has(ind.father)) {
                errors.push(
                    `Father '${ind.father}' not found for '${ind.name}'`,
                );
            }
            if (ind.mother) {
                const mother = this.individuals.get(ind.mother);
                if (mother && mother.sex !== 'F') {
                    errors.push(`Mother '${ind.mother}' must be female`);
                }
            }
            if (ind.father) {
                const father = this.individuals.get(ind.father);
                if (father && father.sex !== 'M') {
                    errors.push(`Father '${ind.father}' must be male`);
                }
            }
        }

        return errors;
    }

    private calculateGenerations(): Map<string, number> {
        const generations = new Map<string, number>();

        // Pass 1: Assign founders (top_level or no parents) to generation 0
        for (const ind of this.dataset) {
            if (ind.top_level || (!ind.mother && !ind.father)) {
                generations.set(ind.name, 0);
            }
        }

        // Pass 2: Iteratively assign children based on parent generations
        let changed = true;
        let maxIterations = this.dataset.length; // Prevent infinite loop
        let iteration = 0;

        while (changed && iteration < maxIterations) {
            changed = false;
            iteration++;

            for (const ind of this.dataset) {
                if (generations.has(ind.name)) continue; // Already assigned

                const motherGen = ind.mother
                    ? generations.get(ind.mother)
                    : undefined;
                const fatherGen = ind.father
                    ? generations.get(ind.father)
                    : undefined;

                // Only assign if BOTH parents are known
                if (motherGen !== undefined && fatherGen !== undefined) {
                    const childGen = Math.max(motherGen, fatherGen) + 1;
                    generations.set(ind.name, childGen);
                    changed = true;
                } else if (
                    ind.mother &&
                    motherGen !== undefined &&
                    !ind.father
                ) {
                    // Single parent (mother only)
                    generations.set(ind.name, motherGen + 1);
                    changed = true;
                } else if (
                    ind.father &&
                    fatherGen !== undefined &&
                    !ind.mother
                ) {
                    // Single parent (father only)
                    generations.set(ind.name, fatherGen + 1);
                    changed = true;
                }
            }
        }

        // Validation: Ensure all individuals have generations
        for (const ind of this.dataset) {
            if (!generations.has(ind.name)) {
                throw new Error(
                    `Validation failed: Individual "${ind.name}" could not be assigned a generation. ` +
                        `Check for invalid parent references or circular relationships.`,
                );
            }
        }

        return generations;
    }

    private buildPartnerships(): void {
        const partnershipMap = new Map<string, Partnership>();

        for (const ind of this.dataset) {
            if (ind.mother && ind.father) {
                const key = [ind.mother, ind.father].sort().join('-');
                if (!partnershipMap.has(key)) {
                    partnershipMap.set(key, {
                        partner1: ind.father,
                        partner2: ind.mother,
                        children: [],
                    });
                }
                partnershipMap.get(key)!.children.push(ind.name);
            }
        }

        this.partnerships = Array.from(partnershipMap.values());
    }

    private alignPartnerGenerations(
        generations: Map<string, number>,
    ): Map<string, number> {
        // Partners must be at same generation level for horizontal partnership lines
        // Strategy: Move the partner with FEWER ancestors up/down to match the other
        // This preserves the generational structure better

        for (const partnership of this.partnerships) {
            const p1Gen = generations.get(partnership.partner1)!;
            const p2Gen = generations.get(partnership.partner2)!;

            if (p1Gen !== p2Gen) {
                const p1 = this.individuals.get(partnership.partner1)!;
                const p2 = this.individuals.get(partnership.partner2)!;

                // Count how many ancestors each partner has
                const p1HasParent = !!(p1.mother || p1.father);
                const p2HasParent = !!(p2.mother || p2.father);

                // Check if either partner has children from OTHER partnerships (not this one)
                // If both have other children, this is a cross-generational marriage and shouldn't be aligned
                const p1OtherChildren =
                    this.dataset.filter(
                        ind =>
                            (ind.mother === p1.name ||
                                ind.father === p1.name) &&
                            !partnership.children.includes(ind.name),
                    ).length > 0;

                const p2OtherChildren =
                    this.dataset.filter(
                        ind =>
                            (ind.mother === p2.name ||
                                ind.father === p2.name) &&
                            !partnership.children.includes(ind.name),
                    ).length > 0;

                // Check if adjusting either partner would violate parent-child constraints
                // (i.e., would place them at same generation or below their parents/above their children)
                const p1ParentGen = Math.max(
                    p1.mother ? generations.get(p1.mother)! : -1,
                    p1.father ? generations.get(p1.father)! : -1,
                );
                const p2ParentGen = Math.max(
                    p2.mother ? generations.get(p2.mother)! : -1,
                    p2.father ? generations.get(p2.father)! : -1,
                );

                // If adjusting p1 to match p2 would place p1 at/above its parents, skip
                const p1CanAdjust = p1ParentGen < 0 || p2Gen > p1ParentGen;
                // If adjusting p2 to match p1 would place p2 at/above its parents, skip
                const p2CanAdjust = p2ParentGen < 0 || p1Gen > p2ParentGen;

                // If neither can adjust without violating constraints, skip alignment
                // This handles cross-generational marriages (e.g., first cousins once removed)
                if (!p1CanAdjust && !p2CanAdjust) {
                    continue; // Allow diagonal partnership line (Bennett standard)
                }

                let targetGen: number;
                let adjustedPartner: string;

                // CRITICAL: Respect parent-child constraints when choosing which partner to adjust
                if (!p1CanAdjust && p2CanAdjust) {
                    // p1 cannot be adjusted (would violate parent-child), so adjust p2
                    targetGen = p1Gen;
                    adjustedPartner = partnership.partner2;
                } else if (!p2CanAdjust && p1CanAdjust) {
                    // p2 cannot be adjusted (would violate parent-child), so adjust p1
                    targetGen = p2Gen;
                    adjustedPartner = partnership.partner1;
                } else if (p1HasParent && !p2HasParent) {
                    // p2 is a founder, p1 has parents - move p2 UP to match p1
                    // This keeps the parent-child structure intact (GP above Père)
                    targetGen = p1Gen;
                    adjustedPartner = partnership.partner2;
                } else if (p2HasParent && !p1HasParent) {
                    // p1 is a founder, p2 has parents - move p1 UP to match p2
                    // This keeps the parent-child structure intact
                    targetGen = p2Gen;
                    adjustedPartner = partnership.partner1;
                } else if (p1OtherChildren && !p2OtherChildren) {
                    // p1 has other children - rooted in this generation, adjust p2 instead
                    targetGen = p1Gen;
                    adjustedPartner = partnership.partner2;
                } else if (p2OtherChildren && !p1OtherChildren) {
                    // p2 has other children - rooted in this generation, adjust p1 instead
                    targetGen = p2Gen;
                    adjustedPartner = partnership.partner1;
                } else {
                    // Both have parents or both are founders - use older generation
                    targetGen = Math.min(p1Gen, p2Gen);
                    adjustedPartner =
                        p1Gen > p2Gen
                            ? partnership.partner1
                            : partnership.partner2;
                }

                // Adjust partner to target generation
                generations.set(adjustedPartner, targetGen);

                // Recursively adjust all descendants
                this.adjustDescendantsGeneration(
                    adjustedPartner,
                    targetGen,
                    generations,
                );
            }
        }

        return generations;
    }

    private adjustDescendantsGeneration(
        parentName: string,
        parentGen: number,
        generations: Map<string, number>,
    ): void {
        for (const ind of this.dataset) {
            if (ind.mother === parentName || ind.father === parentName) {
                const currentGen = generations.get(ind.name)!;
                const expectedGen = parentGen + 1;

                if (currentGen !== expectedGen) {
                    generations.set(ind.name, expectedGen);
                    // Recursively adjust this individual's children
                    this.adjustDescendantsGeneration(
                        ind.name,
                        expectedGen,
                        generations,
                    );
                }
            }
        }
    }

    private calculatePositions(): void {
        let generations = this.calculateGenerations();
        this.buildPartnerships();
        generations = this.alignPartnerGenerations(generations);

        const { width, height, symbol_size } = this.options;
        const padding = symbol_size * 2;
        const minNodeSpacing = symbol_size * 4;

        const genGroups = new Map<number, Individual[]>();
        for (const ind of this.dataset) {
            const gen = generations.get(ind.name)!;
            if (!genGroups.has(gen)) {
                genGroups.set(gen, []);
            }
            genGroups.get(gen)!.push(ind);
        }

        const numGenerations =
            Math.max(...Array.from(generations.values())) + 1;

        // Adaptive vertical spacing: cap at 200px per generation to avoid excessive spacing in simple pedigrees
        const maxVerticalSpacing = 200;
        const calculatedSpacing =
            (height - padding * 2) / Math.max(numGenerations - 1, 1);
        const verticalSpacing = Math.min(calculatedSpacing, maxVerticalSpacing);

        this.generationGroups = genGroups;

        // BOTTOM-UP POSITIONING: Position children first, then parents centered above them
        const sortedGens = Array.from(genGroups.keys()).sort((a, b) => b - a);
        const positioned = new Set<string>();

        for (const gen of sortedGens) {
            const y = padding + gen * verticalSpacing;
            const individuals = genGroups.get(gen)!;
            let currentX = padding;

            // Phase 1: Position partnerships with children (centered above children)
            // CRITICAL: Process partnerships in spatial order (left to right) to avoid conflicts
            const partnershipsWithChildren = this.partnerships
                .filter(p => p.children.length > 0)
                .map(partnership => {
                    const childPositions = partnership.children
                        .map(c => this.nodePositions.get(c))
                        .filter(p => p !== undefined);
                    const childMidX =
                        childPositions.length > 0
                            ? childPositions.reduce((sum, p) => sum + p.x, 0) /
                              childPositions.length
                            : Infinity;
                    return { partnership, childMidX, childPositions };
                })
                .sort((a, b) => a.childMidX - b.childMidX); // Sort left to right

            for (const {
                partnership,
                childMidX,
                childPositions,
            } of partnershipsWithChildren) {
                const p1 = individuals.find(
                    i => i.name === partnership.partner1,
                );
                const p2 = individuals.find(
                    i => i.name === partnership.partner2,
                );

                if (!p1 || !p2) continue;

                // Skip if BOTH partners already positioned
                if (positioned.has(p1.name) && positioned.has(p2.name))
                    continue;

                if (childPositions.length > 0) {
                    // childMidX already calculated above in sort

                    // Position partners symmetrically around midpoint
                    // If one partner already positioned (serial marriage), use their position as constraint
                    let p1X: number, p2X: number;

                    if (positioned.has(p1.name)) {
                        // p1 already positioned (serial marriage), calculate p2 to maintain centering
                        const existingP1 = this.nodePositions.get(p1.name)!;
                        p1X = existingP1.x;
                        // CRITICAL: Use ideal symmetric position even if it violates minNodeSpacing
                        // This is necessary for serial marriages where child is far from the existing partner
                        p2X = 2 * childMidX - p1X;
                    } else if (positioned.has(p2.name)) {
                        // p2 already positioned (serial marriage), calculate p1 to maintain centering
                        const existingP2 = this.nodePositions.get(p2.name)!;
                        p2X = existingP2.x;
                        // CRITICAL: Use ideal symmetric position even if it violates minNodeSpacing
                        p1X = 2 * childMidX - p2X;
                    } else {
                        // Neither positioned yet - normal case
                        p1X = childMidX - minNodeSpacing / 2;
                        p2X = childMidX + minNodeSpacing / 2;
                    }

                    // Check for exact overlaps (same position) and shift partnership + children together
                    // This handles the case where children are exactly minNodeSpacing apart
                    // causing parent partnerships to overlap at the boundary
                    const overlapTolerance = 0.1; // Less than 1px
                    for (const [existingName, existingPos] of this
                        .nodePositions) {
                        if (existingPos.generation !== gen) continue;

                        // Check if p1X or p2X would overlap with existing position
                        if (
                            !positioned.has(p1.name) &&
                            Math.abs(p1X - existingPos.x) < overlapTolerance
                        ) {
                            // Shift partnership + children to maintain centering
                            const shift = minNodeSpacing / 2;
                            p1X += shift;
                            p2X += shift;
                            // CRITICAL: Also shift all children to maintain centering
                            for (const childName of partnership.children) {
                                const childPos =
                                    this.nodePositions.get(childName);
                                if (childPos) {
                                    childPos.x += shift;
                                }
                            }
                            break; // Only fix one overlap at a time
                        }
                        if (
                            !positioned.has(p2.name) &&
                            Math.abs(p2X - existingPos.x) < overlapTolerance
                        ) {
                            // Shift partnership + children to maintain centering
                            const shift = minNodeSpacing / 2;
                            p1X += shift;
                            p2X += shift;
                            // CRITICAL: Also shift all children to maintain centering
                            for (const childName of partnership.children) {
                                const childPos =
                                    this.nodePositions.get(childName);
                                if (childPos) {
                                    childPos.x += shift;
                                }
                            }
                            break; // Only fix one overlap at a time
                        }
                    }

                    // CRITICAL: For partnerships with children, DO NOT shift away from centering
                    // Even if there are conflicts, maintaining centering above children is more important
                    // Overlaps will be handled by adjusting child spacing in Phase 4
                    // TODO: Remove conflict detection or handle it by adjusting child positions
                    const SKIP_CONFLICT_DETECTION_FOR_CHILDREN = true;

                    if (!SKIP_CONFLICT_DETECTION_FOR_CHILDREN) {
                        // Check for conflicts with already positioned individuals in this generation
                        // If conflict detected, shift the entire partnership (maintaining spacing)
                        const existingPositions = Array.from(
                            this.nodePositions.values(),
                        ).filter(pos => pos.generation === gen);

                        let needsShift = true;
                        while (needsShift) {
                            needsShift = false;

                            for (const existing of existingPositions) {
                                // Skip self-checking for already positioned partners
                                if (
                                    (positioned.has(p1.name) &&
                                        existing.individual.name === p1.name) ||
                                    (positioned.has(p2.name) &&
                                        existing.individual.name === p2.name)
                                ) {
                                    continue;
                                }

                                const distToP1 = Math.abs(existing.x - p1X);
                                const distToP2 = Math.abs(existing.x - p2X);

                                // Check conflicts
                                const p1Conflict = distToP1 < minNodeSpacing;
                                const p2Conflict = distToP2 < minNodeSpacing;

                                if (p1Conflict || p2Conflict) {
                                    // Calculate shift amount needed
                                    let shiftAmount = 0;

                                    if (positioned.has(p1.name)) {
                                        // p1 is fixed, shift p2 only
                                        if (p2Conflict) {
                                            let newP2X =
                                                existing.x + minNodeSpacing;
                                            // Ensure we don't shift p2 onto p1
                                            if (
                                                Math.abs(newP2X - p1X) <
                                                minNodeSpacing
                                            ) {
                                                // Try shifting in the other direction
                                                newP2X =
                                                    existing.x - minNodeSpacing;
                                                // If that also conflicts with p1, shift further right
                                                if (
                                                    Math.abs(newP2X - p1X) <
                                                    minNodeSpacing
                                                ) {
                                                    newP2X =
                                                        p1X + minNodeSpacing;
                                                }
                                            }
                                            shiftAmount = newP2X - p2X;
                                            p2X = newP2X;
                                        }
                                    } else if (positioned.has(p2.name)) {
                                        // p2 is fixed, shift p1 only
                                        if (p1Conflict) {
                                            // Try shifting right first (preferred to maintain ideal spacing from p2)
                                            let newP1X =
                                                existing.x + minNodeSpacing;
                                            // If that creates conflict with p2, shift further right past p2
                                            if (
                                                Math.abs(newP1X - p2X) <
                                                minNodeSpacing
                                            ) {
                                                newP1X = Math.max(
                                                    newP1X,
                                                    p2X + minNodeSpacing,
                                                );
                                            }
                                            shiftAmount = newP1X - p1X;
                                            p1X = newP1X;
                                        }
                                    } else {
                                        // Neither fixed, shift entire partnership together
                                        const minP1X =
                                            existing.x + minNodeSpacing;
                                        const minP2X =
                                            existing.x + minNodeSpacing;
                                        const targetP1X = Math.max(
                                            p1X,
                                            minP1X,
                                            minP2X - minNodeSpacing,
                                        );
                                        shiftAmount = targetP1X - p1X;
                                        p1X += shiftAmount;
                                        p2X += shiftAmount;
                                    }

                                    needsShift = true;
                                    break;
                                }
                            }
                        }
                    } // End of SKIP_CONFLICT_DETECTION_FOR_CHILDREN check

                    // Set positions (only if not already set)
                    if (!positioned.has(p1.name)) {
                        this.nodePositions.set(p1.name, {
                            individual: p1,
                            x: p1X,
                            y,
                            generation: gen,
                        });
                        positioned.add(p1.name);
                    }
                    if (!positioned.has(p2.name)) {
                        this.nodePositions.set(p2.name, {
                            individual: p2,
                            x: p2X,
                            y,
                            generation: gen,
                        });
                        positioned.add(p2.name);
                    }

                    currentX = Math.max(
                        currentX,
                        Math.max(p1X, p2X) + minNodeSpacing,
                    );
                }
            }

            // Phase 2: Position single parents with children (centered above children)
            for (const ind of individuals) {
                if (positioned.has(ind.name)) continue;

                // Find children
                const children: string[] = [];
                for (const child of this.dataset) {
                    if (
                        child.mother === ind.name ||
                        child.father === ind.name
                    ) {
                        children.push(child.name);
                    }
                }

                if (children.length > 0) {
                    // Get child positions
                    const childPositions = children
                        .map(c => this.nodePositions.get(c))
                        .filter(
                            (
                                p,
                            ): p is {
                                individual: Individual;
                                x: number;
                                y: number;
                                generation: number;
                            } => p !== undefined,
                        );

                    if (childPositions.length > 0) {
                        // Position centered above children
                        const childMidX =
                            childPositions.reduce((sum, p) => sum + p.x, 0) /
                            childPositions.length;
                        this.nodePositions.set(ind.name, {
                            individual: ind,
                            x: childMidX,
                            y,
                            generation: gen,
                        });
                        positioned.add(ind.name);
                        currentX = Math.max(
                            currentX,
                            childMidX + minNodeSpacing,
                        );
                    }
                }
            }

            // Phase 3: Position partnerships without children (left-to-right)
            for (const partnership of this.partnerships) {
                const p1 = individuals.find(
                    i => i.name === partnership.partner1,
                );
                const p2 = individuals.find(
                    i => i.name === partnership.partner2,
                );

                if (!p1 || !p2) continue;
                if (positioned.has(p1.name) || positioned.has(p2.name))
                    continue;

                this.nodePositions.set(p1.name, {
                    individual: p1,
                    x: currentX,
                    y,
                    generation: gen,
                });
                currentX += minNodeSpacing;
                this.nodePositions.set(p2.name, {
                    individual: p2,
                    x: currentX,
                    y,
                    generation: gen,
                });
                currentX += minNodeSpacing;
                positioned.add(p1.name);
                positioned.add(p2.name);
            }

            // Phase 4: Position children of partnerships (grouped by partnership)
            // Process children in partnership order to keep family units together
            for (const partnership of this.partnerships) {
                const childrenInThisGen = partnership.children.filter(c => {
                    const child = this.individuals.get(c);
                    return (
                        child &&
                        individuals.includes(child) &&
                        !positioned.has(c)
                    );
                });

                if (childrenInThisGen.length > 0) {
                    // Check if both parents are already positioned
                    const p1Pos = this.nodePositions.get(partnership.partner1);
                    const p2Pos = this.nodePositions.get(partnership.partner2);

                    let groupStartX: number;

                    if (p1Pos && p2Pos) {
                        // Both parents positioned - center children below parents
                        const parentMidX = (p1Pos.x + p2Pos.x) / 2;
                        const groupWidth =
                            (childrenInThisGen.length - 1) * minNodeSpacing;
                        groupStartX = parentMidX - groupWidth / 2;
                        console.log(
                            `Phase 4 centering: ${childrenInThisGen.join(',')} below ${partnership.partner1}/${partnership.partner2} (gen ${p1Pos.generation}/${p2Pos.generation}) at ${parentMidX}`,
                        );
                    } else {
                        // Parents not positioned yet - use currentX
                        groupStartX = currentX;
                        console.log(
                            `Phase 4 NOT centering: ${childrenInThisGen.join(',')} - ${partnership.partner1} (${!!p1Pos}) / ${partnership.partner2} (${!!p2Pos})`,
                        );
                    }

                    // Position children left-to-right
                    const groupWidth =
                        (childrenInThisGen.length - 1) * minNodeSpacing;

                    for (let i = 0; i < childrenInThisGen.length; i++) {
                        const childName = childrenInThisGen[i];
                        const child = this.individuals.get(childName)!;
                        const childX = groupStartX + i * minNodeSpacing;
                        this.nodePositions.set(childName, {
                            individual: child,
                            x: childX,
                            y,
                            generation: gen,
                        });
                        positioned.add(childName);
                    }

                    // Move currentX past this family group + extra spacing for next partnership
                    currentX = Math.max(
                        currentX,
                        groupStartX + groupWidth + minNodeSpacing * 2,
                    );
                }
            }

            // Phase 5: Position remaining individuals (left-to-right)
            for (const ind of individuals) {
                if (positioned.has(ind.name)) continue;

                this.nodePositions.set(ind.name, {
                    individual: ind,
                    x: currentX,
                    y,
                    generation: gen,
                });
                currentX += minNodeSpacing;
                positioned.add(ind.name);
                console.log(
                    `Phase 5 positioned: ${ind.name} at ${currentX - minNodeSpacing}`,
                );
            }

            // Debug: Show what's positioned at end of this generation
            console.log(`\n=== End of Gen ${gen} ===`);
            const genPositioned = Array.from(this.nodePositions.values())
                .filter(p => p.generation === gen)
                .map(p => p.individual.name);
            console.log(
                `Positioned in Gen ${gen}: ${genPositioned.join(', ')}`,
            );
        }

        // Backward pass: Center children below partnerships
        // This handles cases where children were positioned before their parents (bottom-up algorithm)
        this.centerChildrenBelowPartnerships(minNodeSpacing);

        // Center entire diagram on canvas
        this.centerDiagramOnCanvas(width);

        // Validate: no two individuals should have the same position
        this.validateNoOverlappingPositions();
    }

    /**
     * Backward pass to center children below their parents
     * Runs after all positioning is complete to fix cases where Phase 4 couldn't center
     * because parents weren't positioned yet (bottom-up algorithm processes children first)
     */
    private centerChildrenBelowPartnerships(minNodeSpacing: number): void {
        for (const partnership of this.partnerships) {
            if (partnership.children.length === 0) continue;

            const p1Pos = this.nodePositions.get(partnership.partner1);
            const p2Pos = this.nodePositions.get(partnership.partner2);

            if (!p1Pos || !p2Pos) continue;

            // Get all positioned children
            const childPositions = partnership.children
                .map(c => this.nodePositions.get(c))
                .filter(
                    (
                        p,
                    ): p is {
                        individual: Individual;
                        x: number;
                        y: number;
                        generation: number;
                    } => p !== undefined,
                );

            if (childPositions.length === 0) continue;

            // Calculate partnership midpoint and children midpoint
            const partnershipMidX = (p1Pos.x + p2Pos.x) / 2;
            const childrenMidX =
                childPositions.reduce((sum, p) => sum + p.x, 0) /
                childPositions.length;

            // Calculate shift needed to center children below partnership
            const shift = partnershipMidX - childrenMidX;

            // Only apply shift if significant (> 1px) to avoid floating point noise
            if (Math.abs(shift) < 1) continue;

            // Apply shift to all children
            for (const childName of partnership.children) {
                const childPos = this.nodePositions.get(childName);
                if (childPos) {
                    childPos.x += shift;
                }
            }
        }
    }

    /**
     * Backward pass to center partnerships above their children
     * Processes generations in reverse order (bottom-up)
     * This ensures parents are centered even when children were positioned after them
     */
    private centerPartnershipsAboveChildren(minNodeSpacing: number): void {
        // Get all generations in reverse order
        const allGenerations = Array.from(this.nodePositions.values()).map(
            pos => pos.generation,
        );
        const maxGen = Math.max(...allGenerations);
        const minGen = Math.min(...allGenerations);

        // Process generations from bottom to top (children first, then parents)
        for (let gen = maxGen; gen >= minGen; gen--) {
            const genIndividuals = Array.from(
                this.nodePositions.values(),
            ).filter(pos => pos.generation === gen);

            // Find all partnerships where both partners are in this generation
            for (const partnership of this.partnerships) {
                const p1Pos = this.nodePositions.get(partnership.partner1);
                const p2Pos = this.nodePositions.get(partnership.partner2);

                if (!p1Pos || !p2Pos) continue;
                if (p1Pos.generation !== gen || p2Pos.generation !== gen)
                    continue;
                if (partnership.children.length === 0) continue;

                // Get child positions
                const childPositions = partnership.children
                    .map(c => this.nodePositions.get(c))
                    .filter(
                        (
                            p,
                        ): p is {
                            individual: Individual;
                            x: number;
                            y: number;
                            generation: number;
                        } => p !== undefined,
                    );

                if (childPositions.length === 0) continue;

                // Calculate ideal midpoint above children
                const childMidX =
                    childPositions.reduce((sum, p) => sum + p.x, 0) /
                    childPositions.length;
                const currentMidX = (p1Pos.x + p2Pos.x) / 2;

                // If already centered (within tolerance), skip
                if (Math.abs(currentMidX - childMidX) < 1) continue;

                // Calculate shift needed to center partnership
                const shiftNeeded = childMidX - currentMidX;
                const newP1X = p1Pos.x + shiftNeeded;
                const newP2X = p2Pos.x + shiftNeeded;

                // Check for collisions with other individuals in same generation
                let hasCollision = false;
                for (const otherPos of genIndividuals) {
                    // Skip self
                    if (
                        otherPos.individual.name === p1Pos.individual.name ||
                        otherPos.individual.name === p2Pos.individual.name
                    ) {
                        continue;
                    }

                    // Check if shift would cause collision
                    const distToP1 = Math.abs(otherPos.x - newP1X);
                    const distToP2 = Math.abs(otherPos.x - newP2X);

                    if (
                        distToP1 < minNodeSpacing ||
                        distToP2 < minNodeSpacing
                    ) {
                        hasCollision = true;
                        break;
                    }
                }

                // Only shift if no collisions
                if (!hasCollision) {
                    p1Pos.x = newP1X;
                    p2Pos.x = newP2X;
                }
            }
        }
    }

    /**
     * Validate that no two individuals occupy the same position
     * This prevents rendering bugs where symbols overlap
     */
    private validateNoOverlappingPositions(): void {
        const positions = Array.from(this.nodePositions.values());

        for (let i = 0; i < positions.length; i++) {
            for (let j = i + 1; j < positions.length; j++) {
                const pos1 = positions[i];
                const pos2 = positions[j];

                if (pos1.x === pos2.x && pos1.y === pos2.y) {
                    throw new Error(
                        `Position overlap detected: "${pos1.individual.name}" and "${pos2.individual.name}" ` +
                            `are both positioned at (${pos1.x}, ${pos1.y}). ` +
                            `This indicates a bug in the positioning algorithm.`,
                    );
                }
            }
        }
    }

    /**
     * Center the entire diagram horizontally on the canvas
     */
    private centerDiagramOnCanvas(canvasWidth: number): void {
        const positions = Array.from(this.nodePositions.values());
        if (positions.length === 0) return;

        const minX = Math.min(...positions.map(p => p.x));
        const maxX = Math.max(...positions.map(p => p.x));
        const diagramWidth = maxX - minX;

        // Calculate offset to center diagram
        const offset = (canvasWidth - diagramWidth) / 2 - minX;

        // Apply offset to all positions
        for (const pos of positions) {
            pos.x += offset;
        }
    }

    private generationGroups: Map<number, Individual[]> = new Map();

    private sortByPartnership(individuals: Individual[]): Individual[] {
        const sorted: Individual[] = [];
        const used = new Set<string>();
        const individualNames = new Set(individuals.map(i => i.name));

        for (const ind of individuals) {
            if (used.has(ind.name)) continue;

            const partnership = this.partnerships.find(
                p => p.partner1 === ind.name || p.partner2 === ind.name,
            );

            if (partnership) {
                const partner1 = this.individuals.get(partnership.partner1)!;
                const partner2 = this.individuals.get(partnership.partner2)!;

                // Only add partners that are in the current generation
                if (partner1.sex === 'M') {
                    if (
                        !used.has(partner1.name) &&
                        individualNames.has(partner1.name)
                    ) {
                        sorted.push(partner1);
                        used.add(partner1.name);
                    }
                    if (
                        !used.has(partner2.name) &&
                        individualNames.has(partner2.name)
                    ) {
                        sorted.push(partner2);
                        used.add(partner2.name);
                    }
                } else {
                    if (
                        !used.has(partner2.name) &&
                        individualNames.has(partner2.name)
                    ) {
                        sorted.push(partner2);
                        used.add(partner2.name);
                    }
                    if (
                        !used.has(partner1.name) &&
                        individualNames.has(partner1.name)
                    ) {
                        sorted.push(partner1);
                        used.add(partner1.name);
                    }
                }
            } else {
                sorted.push(ind);
                used.add(ind.name);
            }
        }

        return sorted;
    }

    private adjustChildPositions(minSpacing: number): void {
        for (const partnership of this.partnerships) {
            const p1Pos = this.nodePositions.get(partnership.partner1);
            const p2Pos = this.nodePositions.get(partnership.partner2);

            if (p1Pos && p2Pos && partnership.children.length > 0) {
                const parentCenterX = (p1Pos.x + p2Pos.x) / 2;
                const childPositions = partnership.children
                    .map(c => this.nodePositions.get(c)!)
                    .filter(Boolean);

                if (childPositions.length > 0) {
                    const currentCenterX =
                        childPositions.reduce((sum, p) => sum + p.x, 0) /
                        childPositions.length;
                    const offset = parentCenterX - currentCenterX;

                    // Apply partial offset to move children towards parents
                    for (const childName of partnership.children) {
                        const pos = this.nodePositions.get(childName);
                        if (pos) {
                            pos.x += offset * 0.3; // Reduced from 0.5 to minimize overlap risk
                        }
                    }
                }
            }
        }

        // Post-adjustment: enforce minimum spacing within each generation
        this.enforceMinimumSpacing(minSpacing);
    }

    private enforceMinimumSpacing(minSpacing: number): void {
        for (const [gen, individuals] of this.generationGroups) {
            if (individuals.length < 2) continue;

            // Get references to the actual position objects (not copies)
            const positionRefs: { name: string; pos: NodePosition }[] = [];
            for (const ind of individuals) {
                const pos = this.nodePositions.get(ind.name);
                if (pos) {
                    positionRefs.push({ name: ind.name, pos });
                }
            }

            if (positionRefs.length < 2) continue;

            // Multiple passes to ensure all spacing is correct
            for (let pass = 0; pass < positionRefs.length; pass++) {
                // Sort by x coordinate
                positionRefs.sort((a, b) => a.pos.x - b.pos.x);

                for (let i = 1; i < positionRefs.length; i++) {
                    const prev = positionRefs[i - 1].pos;
                    const curr = positionRefs[i].pos;
                    const gap = curr.x - prev.x;

                    if (gap < minSpacing) {
                        // Push the current node to the right
                        curr.x = prev.x + minSpacing;
                    }
                }
            }
        }
    }

    /**
     * Get condition colors for an individual
     */
    private getConditionColors(individual: Individual): ConditionColor[] {
        if (!individual.conditions || individual.conditions.length === 0) {
            return [];
        }

        return individual.conditions.map(condition => ({
            name: condition.name,
            colour:
                this.conditionColorMap.get(condition.name) || COLOR_PALETTE[0],
        }));
    }

    /**
     * Get condition labels for display (abbreviated per Bennett: "dx. Condition Age")
     */
    private getConditionLabels(individual: Individual): string[] {
        if (!individual.conditions || individual.conditions.length === 0) {
            return [];
        }

        return individual.conditions.map(condition => {
            // Abbreviate long condition names
            let name = condition.name;
            if (name.length > 15) {
                // Take first word or abbreviate
                const words = name.split(/\s+/);
                if (words.length > 1) {
                    name = words.map(w => w[0]).join('');
                } else {
                    name = name.substring(0, 12) + '...';
                }
            }

            if (condition.age !== undefined) {
                return `${name}: ${condition.age}`;
            }
            return name;
        });
    }

    /**
     * Count label lines for bounds calculation
     */
    private countLabelLines(individual: Individual): number {
        let lines = 1; // name

        // Age/YOB
        const showAge =
            this.options.labels.includes('age') && individual.age !== undefined;
        const showYob =
            this.options.labels.includes('yob') && individual.yob !== undefined;
        if (showAge || showYob) lines++;

        // Conditions
        if (individual.conditions) {
            lines += individual.conditions.length;
        }

        // Gene tests
        const geneTestLabels = getGeneTestLabels(individual);
        if (geneTestLabels.length > 0) lines++;

        return lines;
    }

    private calculateBounds(): {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
        legendY: number;
    } {
        const { symbol_size } = this.options;
        const lineHeight = 14;
        const labelPadding = 15;
        const textWidthEstimate = 100;

        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;

        for (const [, pos] of this.nodePositions) {
            const ind = pos.individual;

            minX = Math.min(minX, pos.x - symbol_size / 2 - 20);
            maxX = Math.max(
                maxX,
                pos.x + symbol_size / 2 + textWidthEstimate / 2,
            );
            minY = Math.min(minY, pos.y - symbol_size / 2 - 10);

            const labelLines = this.countLabelLines(ind);
            const bottomY =
                pos.y +
                symbol_size / 2 +
                labelPadding +
                labelLines * lineHeight;
            maxY = Math.max(maxY, bottomY);
        }

        const padding = 20;
        const pedigreeMaxY = maxY + padding;

        const legendMargin = 30;
        let legendY = pedigreeMaxY + legendMargin;
        let finalMaxY = pedigreeMaxY;

        if (this.conditionColorMap.size > 0) {
            const legendHeight = this.calculateLegendHeight(
                maxX - minX + padding * 2,
            );
            finalMaxY = legendY + legendHeight + padding;
        }

        return {
            minX: minX - padding,
            minY: minY - padding,
            maxX: maxX + padding,
            maxY: finalMaxY,
            legendY,
        };
    }

    private calculateLegendHeight(availableWidth: number): number {
        if (this.conditionColorMap.size === 0) return 0;

        const { font_size, symbol_size } = this.options;
        const fontSizeNum = parseInt(font_size, 10) || 12;
        const swatchSize = symbol_size * 0.5;
        const textGap = 6;
        const itemGap = 20;
        const rowHeight = Math.max(swatchSize, fontSizeNum) + 10;
        const maxWidth = availableWidth - 40;

        let currentRowWidth = 0;
        let rowCount = 1;

        for (const [conditionName] of this.conditionColorMap) {
            const textWidth = conditionName.length * fontSizeNum * 0.55;
            const itemWidth = swatchSize + textGap + textWidth;
            const itemTotalWidth =
                itemWidth + (currentRowWidth > 0 ? itemGap : 0);

            if (
                currentRowWidth + itemTotalWidth > maxWidth &&
                currentRowWidth > 0
            ) {
                rowCount++;
                currentRowWidth = itemWidth;
            } else {
                currentRowWidth += itemTotalWidth;
            }
        }

        return rowCount * rowHeight;
    }

    /**
     * Render to SVG string (for testing and validation)
     */
    renderSvg(): string {
        const errors = this.validateDataset();
        if (errors.length > 0) {
            throw new Error(`Validation errors: ${errors.join('; ')}`);
        }

        // Only calculate positions if not already done
        if (this.nodePositions.size === 0) {
            this.calculatePositions();
        }

        const {
            width,
            height,
            symbol_size,
            background,
            node_background,
            font_size,
            font_family,
        } = this.options;

        const bounds = this.calculateBounds();
        const contentWidth = bounds.maxX - bounds.minX;
        const contentHeight = bounds.maxY - bounds.minY;
        const finalWidth = Math.max(width, contentWidth);
        const finalHeight = Math.max(height, contentHeight);

        const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
        const document = dom.window.document;

        const svg = d3
            .select(document.body)
            .append('svg')
            .attr('xmlns', 'http://www.w3.org/2000/svg')
            .attr('width', finalWidth)
            .attr('height', finalHeight)
            .attr(
                'viewBox',
                `${bounds.minX} ${bounds.minY} ${contentWidth} ${contentHeight}`,
            )
            .style('background', background);

        // Draw partnerships and family lines
        this.drawFamilyLines(svg as any, symbol_size, font_family);

        // Draw individuals
        this.drawIndividuals(
            svg as any,
            symbol_size,
            node_background,
            font_family,
            font_size,
        );

        // Draw generation numbers (Bennett numbering system)
        this.drawGenerationNumbers(svg as any, font_family, bounds.minX);

        // Draw legend if conditions exist
        if (this.conditionColorMap.size > 0) {
            const centerX = (bounds.minX + bounds.maxX) / 2;
            drawLegend(
                svg as any,
                this.conditionColorMap,
                centerX,
                bounds.legendY,
                font_family,
                font_size,
                symbol_size * 0.5,
                contentWidth - 40,
            );
        }

        return document.body.innerHTML;
    }

    /**
     * Render to PNG buffer
     */
    async render(): Promise<Buffer> {
        const svgString = this.renderSvg();
        const pngBuffer = await sharp(Buffer.from(svgString))
            .flatten({ background: '#ffffff' })
            .png()
            .toBuffer();

        return pngBuffer;
    }

    private drawFamilyLines(
        svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
        symbolSize: number,
        fontFamily: string,
    ): void {
        // Draw partnership lines (both parents exist)
        for (const partnership of this.partnerships) {
            const p1 = this.nodePositions.get(partnership.partner1);
            const p2 = this.nodePositions.get(partnership.partner2);

            if (!p1 || !p2) continue;

            const ind1 = this.individuals.get(partnership.partner1)!;
            const ind2 = this.individuals.get(partnership.partner2)!;
            const consanguineous = isConsanguineous(
                ind1,
                ind2,
                this.individuals,
            );

            // Bennett standard: unmarried partnership (dashed line)
            const isUnmarried =
                ind1.relationship_type === 'unmarried' ||
                ind2.relationship_type === 'unmarried' ||
                ind1.relationship_type === 'common_law' ||
                ind2.relationship_type === 'common_law' ||
                ind1.relationship_type === 'consensual' ||
                ind2.relationship_type === 'consensual';

            drawPartnershipLine(
                svg,
                p1.x,
                p1.y,
                p2.x,
                p2.y,
                consanguineous,
                isUnmarried,
            );

            // Bennett standard: consanguinity degree label (e.g., "1st cousins")
            // Note: This requires a 'consanguinity_degree' property on one of the individuals
            const consanguinityDegree =
                (ind1 as any).consanguinity_degree ||
                (ind2 as any).consanguinity_degree;
            if (consanguineous && consanguinityDegree) {
                const midX = (p1.x + p2.x) / 2;
                drawConsanguinityDegreeLabel(
                    svg,
                    midX,
                    p1.y,
                    consanguinityDegree,
                    fontFamily,
                );
            }

            // Divorced indicator (Bennett: double hash marks on partnership line)
            if (ind1.divorced || ind2.divorced) {
                const midX = (p1.x + p2.x) / 2;
                drawDivorcedIndicator(svg, midX, p1.y);
            }

            // Bennett standard: no children by choice indicator (line through offspring connection)
            if (
                partnership.children.length === 0 &&
                (ind1.no_children_by_choice || ind2.no_children_by_choice)
            ) {
                const midX = (p1.x + p2.x) / 2;
                const offspringY = p1.y + symbolSize * 1.5; // Position below partnership line
                drawNoChildrenByChoiceIndicator(svg, midX, offspringY);
            }

            if (partnership.children.length > 0) {
                const midX = (p1.x + p2.x) / 2;
                const childPositions = partnership.children
                    .map(c => this.nodePositions.get(c))
                    .filter(Boolean) as NodePosition[];

                if (childPositions.length === 0) continue;

                const childrenY = childPositions[0].y;
                const sibshipY = (p1.y + childrenY) / 2;

                // Line from partnership to sibship
                drawLine(svg, midX, p1.y, midX, sibshipY);

                // Sibship line
                const minX = Math.min(...childPositions.map(c => c.x));
                const maxX = Math.max(...childPositions.map(c => c.x));

                if (childPositions.length > 1) {
                    drawLine(svg, minX, sibshipY, maxX, sibshipY);
                }

                // Lines to children
                for (const childPos of childPositions) {
                    const lineX =
                        childPositions.length === 1 ? midX : childPos.x;
                    drawLine(
                        svg,
                        lineX,
                        sibshipY,
                        childPos.x,
                        childPos.y - symbolSize / 2,
                    );
                }

                // Twin bars (MZ) and diagonal lines (DZ)
                const processedTwins = new Set<string>();
                const processedDzTwins = new Set<string>();

                for (const childPos of childPositions) {
                    const child = childPos.individual;

                    // MZ twins: horizontal bar
                    if (child.mztwin && !processedTwins.has(child.mztwin)) {
                        processedTwins.add(child.mztwin);
                        const twins = getTwins(child, this.dataset);
                        if (twins.length > 0) {
                            const allTwinPositions = [
                                childPos,
                                ...twins
                                    .map(t => this.nodePositions.get(t.name)!)
                                    .filter(Boolean),
                            ];
                            const twinMinX = Math.min(
                                ...allTwinPositions.map(p => p.x),
                            );
                            const twinMaxX = Math.max(
                                ...allTwinPositions.map(p => p.x),
                            );
                            const twinBarY =
                                (sibshipY + (childPos.y - symbolSize / 2)) / 2;
                            drawTwinBar(svg, twinMinX, twinMaxX, twinBarY);
                        }
                    }

                    // DZ twins: diagonal diverging lines
                    if (child.dztwin && !processedDzTwins.has(child.dztwin)) {
                        processedDzTwins.add(child.dztwin);
                        const dzTwins = getDzTwins(child, this.dataset);
                        if (dzTwins.length > 0) {
                            const allDzTwinPositions = [
                                childPos,
                                ...dzTwins
                                    .map(t => this.nodePositions.get(t.name)!)
                                    .filter(Boolean),
                            ];

                            // Draw diagonal lines for each pair of DZ twins
                            // Bennett standard: diagonal lines from sibship line to each twin
                            for (
                                let i = 0;
                                i < allDzTwinPositions.length;
                                i++
                            ) {
                                for (
                                    let j = i + 1;
                                    j < allDzTwinPositions.length;
                                    j++
                                ) {
                                    const twin1 = allDzTwinPositions[i];
                                    const twin2 = allDzTwinPositions[j];

                                    // Connection point between sibship line and twins
                                    const connectionY =
                                        sibshipY +
                                        (twin1.y - symbolSize / 2 - sibshipY) /
                                            3;

                                    drawDzTwinLines(
                                        svg,
                                        twin1.x,
                                        twin1.y - symbolSize / 2, // Top of symbol
                                        twin2.x,
                                        twin2.y - symbolSize / 2, // Top of symbol
                                        connectionY, // Point on path between sibship and symbols
                                    );
                                }
                            }
                        }
                    }
                }
            }
        }

        // Draw single-parent lines (only mother OR only father)
        // Use Bennett 2008 standard: vertical drop from parent, horizontal sibship line, vertical to children
        const childrenInPartnerships = new Set(
            this.partnerships.flatMap(p => p.children),
        );

        // Group children by single parent
        const singleParentGroups = new Map<string, string[]>();

        for (const ind of this.dataset) {
            if (childrenInPartnerships.has(ind.name)) continue;

            if (ind.mother && !ind.father) {
                if (!singleParentGroups.has(ind.mother)) {
                    singleParentGroups.set(ind.mother, []);
                }
                singleParentGroups.get(ind.mother)!.push(ind.name);
            } else if (ind.father && !ind.mother) {
                if (!singleParentGroups.has(ind.father)) {
                    singleParentGroups.set(ind.father, []);
                }
                singleParentGroups.get(ind.father)!.push(ind.name);
            }
        }

        // Draw lines for each single-parent group
        for (const [parentName, childNames] of singleParentGroups) {
            const parentPos = this.nodePositions.get(parentName);
            if (!parentPos) continue;

            const childPositions = childNames
                .map(name => this.nodePositions.get(name))
                .filter(Boolean) as NodePosition[];

            if (childPositions.length === 0) continue;

            const childrenY = childPositions[0].y;
            const sibshipY = (parentPos.y + childrenY) / 2;

            if (childPositions.length === 1) {
                // Single child: check if parent is directly above (same X coordinate)
                const childPos = childPositions[0];

                if (Math.abs(parentPos.x - childPos.x) < 1) {
                    // Parent directly above child - single vertical line
                    drawLine(
                        svg,
                        parentPos.x,
                        parentPos.y,
                        childPos.x,
                        childPos.y - symbolSize / 2,
                    );
                } else {
                    // Parent offset from child - use 3-line pattern
                    drawLine(
                        svg,
                        parentPos.x,
                        parentPos.y,
                        parentPos.x,
                        sibshipY,
                    );
                    drawLine(svg, parentPos.x, sibshipY, childPos.x, sibshipY);
                    drawLine(
                        svg,
                        childPos.x,
                        sibshipY,
                        childPos.x,
                        childPos.y - symbolSize / 2,
                    );
                }
            } else {
                // Multiple children: horizontal sibship line
                const minX = Math.min(...childPositions.map(c => c.x));
                const maxX = Math.max(...childPositions.map(c => c.x));

                // Vertical drop from parent to sibship line (parent should be centered above children)
                drawLine(svg, parentPos.x, parentPos.y, parentPos.x, sibshipY);

                // Horizontal sibship line spanning all children
                drawLine(svg, minX, sibshipY, maxX, sibshipY);

                // Vertical drops to each child
                for (const childPos of childPositions) {
                    drawLine(
                        svg,
                        childPos.x,
                        sibshipY,
                        childPos.x,
                        childPos.y - symbolSize / 2,
                    );
                }
            }
        }
    }

    private drawIndividuals(
        svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
        symbolSize: number,
        nodeBackground: string,
        fontFamily: string,
        fontSize: string,
    ): void {
        const lineHeight = 14;

        for (const [, pos] of this.nodePositions) {
            const ind = pos.individual;
            const conditionColors = this.getConditionColors(ind);
            const g = svg
                .append('g')
                .attr('transform', `translate(${pos.x}, ${pos.y})`);

            // Draw symbol based on sex (or termination triangle per Bennett standard)
            if (ind.terminated) {
                // Bennett standard: triangle size varies by gestational age
                // Ectopic pregnancies shown with forward slash through triangle
                drawTerminationSymbol(
                    g as any,
                    symbolSize,
                    nodeBackground,
                    ind.terminated_age,
                    ind.ectopic,
                );
            } else if (ind.sex === 'M') {
                drawMaleSymbol(
                    g as any,
                    symbolSize,
                    conditionColors,
                    nodeBackground,
                );
            } else if (ind.sex === 'F') {
                drawFemaleSymbol(
                    g as any,
                    symbolSize,
                    conditionColors,
                    nodeBackground,
                );
            } else {
                drawUnknownSymbol(
                    g as any,
                    symbolSize,
                    conditionColors,
                    nodeBackground,
                );
            }

            // Indicators
            if (ind.status === 1) {
                drawDeceasedIndicator(g as any, symbolSize);
            }
            if (ind.proband) {
                drawProbandIndicator(g as any, symbolSize);
            }
            if (ind.consultand) {
                // Bennett standard: consultand (double arrow) - person seeking counseling
                // If both proband and consultand, offset consultand to bottom-right
                drawConsultandIndicator(g as any, symbolSize, ind.proband);
            }
            // Bennett standard: adoption indicators
            if (ind.noparents || ind.adoption_type === 'in') {
                drawAdoptionBrackets(g as any, symbolSize);
            } else if (ind.adoption_type === 'out') {
                drawAdoptedOutIndicator(g as any, symbolSize);
            } else if (ind.adoption_type === 'foster') {
                drawFosterIndicator(g as any, symbolSize);
            }
            // Bennett standard: birth order notation (Roman numerals)
            if (ind.birth_order) {
                drawBirthOrderLabel(
                    g as any,
                    ind.birth_order,
                    symbolSize,
                    fontFamily,
                );
            }
            // Bennett standard: carrier status (dot in center)
            if (ind.carrier) {
                drawCarrierIndicator(g as any);
            }
            // Bennett standard: gene copy number notation
            if (ind.gene_copy_number) {
                drawGeneCopyNumberLabel(
                    g as any,
                    ind.gene_copy_number,
                    symbolSize,
                    fontFamily,
                );
            }
            // Bennett standard: obligate carrier (outlined dot)
            if (ind.obligate_carrier) {
                drawObligateCarrierIndicator(g as any);
            }
            // Bennett standard: pregnancy indicator (P inside symbol)
            if (ind.pregnant) {
                drawPregnancyIndicator(g as any, fontFamily, fontSize);
            }
            // Bennett standard: pregnancy outcome label (SAB, TOP, SB)
            // Note: Ectopic is shown via slash through triangle symbol, not text label
            if (
                ind.pregnancy_outcome &&
                ind.pregnancy_outcome !== 'unknown' &&
                ind.pregnancy_outcome !== 'ectopic'
            ) {
                drawPregnancyOutcomeLabel(
                    g as any,
                    ind.pregnancy_outcome,
                    symbolSize,
                    fontFamily,
                );
            }
            // Bennett standard: ART (Assisted Reproductive Technology) indicator
            if (ind.art_type) {
                drawARTIndicator(
                    g as any,
                    ind.art_type,
                    symbolSize,
                    fontFamily,
                );
            }
            // Bennett 2022: Gender identity marker (when different from sex assigned at birth)
            if (ind.gender && ind.gender !== ind.sex) {
                drawGenderIdentityMarker(
                    g as any,
                    ind.gender,
                    symbolSize,
                    fontFamily,
                );
            }
            // Bennett standard: Ashkenazi ancestry indicator (A marker)
            if (ind.ashkenazi === 1) {
                drawAshkenaziIndicator(
                    g as any,
                    symbolSize,
                    fontFamily,
                    fontSize,
                );
            }
            // Bennett standard: genetic anticipation (asterisk marker)
            if (ind.anticipation) {
                drawAnticipationIndicator(g as any, symbolSize, fontFamily);
            }
            // Note: Ectopic pregnancy is now shown as slash through termination triangle (see drawTerminationSymbol)
            // Bennett standard: infertility (crossed lines)
            if (ind.infertility) {
                drawInfertilityIndicator(g as any, symbolSize);
            }
            // Bennett standard: pregnancy duration (weeks label)
            if (ind.pregnant && ind.terminated_age) {
                drawPregnancyDurationLabel(
                    g as any,
                    ind.terminated_age,
                    symbolSize,
                    fontFamily,
                );
            }

            // Labels
            let labelY = symbolSize / 2 + 15;

            // Name
            const labelText = ind.display_name || ind.name;
            drawLabel(
                g as any,
                labelText,
                labelY,
                fontFamily,
                fontSize,
                '#333',
            );
            labelY += lineHeight;

            // Age/YOB/Age at death
            const showAge =
                this.options.labels.includes('age') && ind.age !== undefined;
            const showYob =
                this.options.labels.includes('yob') && ind.yob !== undefined;
            const showAgeAtDeath =
                ind.status === 1 &&
                ind.yob !== undefined &&
                ind.yod !== undefined;
            if (showAge || showYob || showAgeAtDeath) {
                const parts: string[] = [];
                if (showAge) parts.push(`${ind.age}y`);
                if (showYob) parts.push(`${ind.yob}`);
                // Bennett standard: show age at death for deceased individuals
                if (showAgeAtDeath && ind.yob && ind.yod) {
                    const ageAtDeath = ind.yod - ind.yob;
                    parts.push(`d. ${ageAtDeath}y`);
                }
                drawLabel(
                    g as any,
                    parts.join(' '),
                    labelY,
                    fontFamily,
                    fontSize,
                );
                labelY += lineHeight;
            }

            // Condition labels (free text per Bennett standard)
            const conditionLabels = this.getConditionLabels(ind);
            for (const conditionLabel of conditionLabels) {
                drawLabel(
                    g as any,
                    conditionLabel,
                    labelY,
                    fontFamily,
                    fontSize,
                );
                labelY += lineHeight;
            }

            // Gene test labels
            const geneTestLabels = getGeneTestLabels(ind);
            if (geneTestLabels.length > 0) {
                drawLabel(
                    g as any,
                    geneTestLabels.join(' '),
                    labelY,
                    fontFamily,
                    fontSize,
                );
            }
        }
    }

    /**
     * Draw generation numbers (Bennett numbering system)
     * Roman numerals I, II, III, IV, etc. positioned to the left of each generation
     */
    private drawGenerationNumbers(
        svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
        fontFamily: string,
        minX: number,
    ): void {
        // Group positions by generation to find the Y coordinate for each generation
        const generationYPositions = new Map<number, number>();

        for (const pos of this.nodePositions.values()) {
            if (!generationYPositions.has(pos.generation)) {
                generationYPositions.set(pos.generation, pos.y);
            }
        }

        // Draw generation number for each unique generation
        for (const [generation, y] of generationYPositions.entries()) {
            // Only draw if the generation number is explicitly set on at least one individual
            const hasExplicitGenNumber = Array.from(
                this.nodePositions.values(),
            ).some(
                pos =>
                    pos.generation === generation &&
                    pos.individual.generation !== undefined,
            );

            if (
                hasExplicitGenNumber ||
                this.options.labels?.includes('generation')
            ) {
                drawGenerationNumber(
                    svg as any,
                    generation + 1,
                    y,
                    minX,
                    fontFamily,
                ); // +1 because generations are 0-indexed
            }
        }
    }
}
