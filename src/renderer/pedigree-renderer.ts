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
    drawPartnershipLine,
    drawLine,
    drawTwinBar,
    drawLabel,
    drawCarrierIndicator,
    drawPregnancyIndicator,
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

        // First pass: assign generations based on parent-child relationships
        const founders = this.dataset.filter(ind => !ind.mother && !ind.father);
        const queue: { name: string; gen: number }[] = founders.map(f => ({
            name: f.name,
            gen: 0,
        }));

        while (queue.length > 0) {
            const { name, gen } = queue.shift()!;
            if (generations.has(name)) continue;
            generations.set(name, gen);

            for (const ind of this.dataset) {
                if (ind.mother === name || ind.father === name) {
                    if (!generations.has(ind.name)) {
                        const motherGen = ind.mother
                            ? generations.get(ind.mother)
                            : gen;
                        const fatherGen = ind.father
                            ? generations.get(ind.father)
                            : gen;
                        if (
                            motherGen !== undefined &&
                            fatherGen !== undefined
                        ) {
                            queue.push({
                                name: ind.name,
                                gen: Math.max(motherGen, fatherGen) + 1,
                            });
                        }
                    }
                }
            }
        }

        // Assign remaining individuals to generation 0
        for (const ind of this.dataset) {
            if (!generations.has(ind.name)) {
                generations.set(ind.name, 0);
            }
        }

        // Second pass: ensure partners are in the same generation
        // Partners who are parents should be in the generation above their children
        for (const ind of this.dataset) {
            if (ind.mother && ind.father) {
                const childGen = generations.get(ind.name)!;
                const motherGen = generations.get(ind.mother)!;
                const fatherGen = generations.get(ind.father)!;
                const parentGen = childGen - 1;

                // If mother or father is in wrong generation (gen 0 but should be parentGen)
                if (motherGen < parentGen) {
                    generations.set(ind.mother, parentGen);
                }
                if (fatherGen < parentGen) {
                    generations.set(ind.father, parentGen);
                }
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

    private calculatePositions(): void {
        const generations = this.calculateGenerations();
        this.buildPartnerships();

        const { width, height, symbol_size } = this.options;
        const padding = symbol_size * 2;
        // Minimum spacing accounts for symbol + label text width
        // Labels can have: name (up to 13 chars) + disease labels + gene tests
        const minNodeSpacing = symbol_size * 4; // ~140px to prevent label overlap

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
        const verticalSpacing =
            (height - padding * 2) / Math.max(numGenerations - 1, 1);

        // Calculate required width based on largest generation
        const maxGenSize = Math.max(
            ...Array.from(genGroups.values()).map(g => g.length),
        );
        const requiredWidth = padding * 2 + maxGenSize * minNodeSpacing;
        const effectiveWidth = Math.max(width, requiredWidth);

        // Store generation info for collision detection
        this.generationGroups = genGroups;

        for (const [gen, individuals] of genGroups) {
            const y = padding + gen * verticalSpacing;
            const sorted = this.sortByPartnership(individuals);

            // Use minimum spacing or even distribution, whichever is larger
            const evenSpacing =
                (effectiveWidth - padding * 2) /
                Math.max(individuals.length, 1);
            const horizontalSpacing = Math.max(minNodeSpacing, evenSpacing);

            // Center the row if using minimum spacing
            const totalRowWidth = (sorted.length - 1) * horizontalSpacing;
            const startX = (effectiveWidth - totalRowWidth) / 2;

            sorted.forEach((ind, idx) => {
                const x = startX + idx * horizontalSpacing;
                this.nodePositions.set(ind.name, {
                    individual: ind,
                    x,
                    y,
                    generation: gen,
                });
            });
        }

        this.adjustChildPositions(minNodeSpacing);
    }

    private generationGroups: Map<number, Individual[]> = new Map();

    private sortByPartnership(individuals: Individual[]): Individual[] {
        const sorted: Individual[] = [];
        const used = new Set<string>();

        for (const ind of individuals) {
            if (used.has(ind.name)) continue;

            const partnership = this.partnerships.find(
                p => p.partner1 === ind.name || p.partner2 === ind.name,
            );

            if (partnership) {
                const partner1 = this.individuals.get(partnership.partner1)!;
                const partner2 = this.individuals.get(partnership.partner2)!;

                if (partner1.sex === 'M') {
                    if (!used.has(partner1.name)) {
                        sorted.push(partner1);
                        used.add(partner1.name);
                    }
                    if (!used.has(partner2.name)) {
                        sorted.push(partner2);
                        used.add(partner2.name);
                    }
                } else {
                    if (!used.has(partner2.name)) {
                        sorted.push(partner2);
                        used.add(partner2.name);
                    }
                    if (!used.has(partner1.name)) {
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

        this.calculatePositions();

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
        this.drawFamilyLines(svg as any, symbol_size);

        // Draw individuals
        this.drawIndividuals(
            svg as any,
            symbol_size,
            node_background,
            font_family,
            font_size,
        );

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
    ): void {
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

            drawPartnershipLine(svg, p1.x, p1.y, p2.x, p2.y, consanguineous);

            // Divorced indicator (Bennett: double hash marks on partnership line)
            if (ind1.divorced || ind2.divorced) {
                const midX = (p1.x + p2.x) / 2;
                drawDivorcedIndicator(svg, midX, p1.y);
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

                // Twin bars
                const processedTwins = new Set<string>();
                for (const childPos of childPositions) {
                    const child = childPos.individual;
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
                // Bennett standard: small triangle for stillbirth/SAB/termination
                drawTerminationSymbol(g as any, symbolSize, nodeBackground);
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
            if (ind.noparents) {
                drawAdoptionBrackets(g as any, symbolSize);
            }
            // Bennett standard: carrier status (dot in center)
            if (ind.carrier) {
                drawCarrierIndicator(g as any);
            }
            // Bennett standard: pregnancy indicator (P inside symbol)
            if (ind.pregnant) {
                drawPregnancyIndicator(g as any, fontFamily, fontSize);
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

            // Age/YOB
            const showAge =
                this.options.labels.includes('age') && ind.age !== undefined;
            const showYob =
                this.options.labels.includes('yob') && ind.yob !== undefined;
            if (showAge || showYob) {
                const parts: string[] = [];
                if (showAge) parts.push(`${ind.age}y`);
                if (showYob) parts.push(`${ind.yob}`);
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
}
