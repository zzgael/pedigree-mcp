/**
 * SVG drawing helper functions
 * Ported from pedigreejs pedigree.js
 */

import * as d3 from 'd3';

type SVGSelection = d3.Selection<SVGSVGElement, unknown, null, undefined>;
type GroupSelection = d3.Selection<SVGGElement, unknown, null, undefined>;

// Generic color item for conditions
interface ColorItem {
    colour: string;
}

/**
 * Draw a male symbol (square)
 */
export function drawMaleSymbol(
    g: GroupSelection,
    symbolSize: number,
    conditions: ColorItem[],
    nodeBackground: string,
): void {
    g.append('rect')
        .attr('x', -symbolSize / 2)
        .attr('y', -symbolSize / 2)
        .attr('width', symbolSize)
        .attr('height', symbolSize)
        .attr(
            'fill',
            conditions.length > 0 ? conditions[0].colour : nodeBackground,
        )
        .attr('stroke', '#333')
        .attr('stroke-width', 2);

    // Add additional condition quarters if multiple conditions
    if (conditions.length > 1) {
        const quadrantSize = symbolSize / 2;
        conditions.slice(1, 4).forEach((condition, idx) => {
            const qx = idx === 0 ? 0 : idx === 1 ? -quadrantSize : 0;
            const qy = idx === 0 ? -quadrantSize : idx === 1 ? 0 : 0;
            g.append('rect')
                .attr('x', qx)
                .attr('y', qy)
                .attr('width', quadrantSize)
                .attr('height', quadrantSize)
                .attr('fill', condition.colour)
                .attr('stroke', 'none');
        });
    }
}

/**
 * Draw a female symbol (circle) with condition pie chart
 */
export function drawFemaleSymbol(
    g: GroupSelection,
    symbolSize: number,
    conditions: ColorItem[],
    nodeBackground: string,
): void {
    g.append('circle')
        .attr('r', symbolSize / 2)
        .attr(
            'fill',
            conditions.length > 0 ? conditions[0].colour : nodeBackground,
        )
        .attr('stroke', '#333')
        .attr('stroke-width', 2);

    // Add condition pie slices if multiple conditions
    if (conditions.length > 1) {
        const arc = d3.arc<d3.PieArcDatum<ColorItem>>();
        const pie = d3.pie<ColorItem>().value(1);
        const arcs = pie(conditions.slice(0, 4));

        arcs.forEach(arcData => {
            g.append('path')
                .attr(
                    'd',
                    arc.innerRadius(0).outerRadius(symbolSize / 2 - 1)(
                        arcData,
                    ) || '',
                )
                .attr('fill', arcData.data.colour);
        });
    }
}

/**
 * Draw an unknown sex symbol (diamond)
 */
export function drawUnknownSymbol(
    g: GroupSelection,
    symbolSize: number,
    conditions: ColorItem[],
    nodeBackground: string,
): void {
    const half = symbolSize / 2;
    g.append('polygon')
        .attr('points', `0,${-half} ${half},0 0,${half} ${-half},0`)
        .attr(
            'fill',
            conditions.length > 0 ? conditions[0].colour : nodeBackground,
        )
        .attr('stroke', '#333')
        .attr('stroke-width', 2);
}

/**
 * Draw deceased indicator (diagonal line)
 */
export function drawDeceasedIndicator(
    g: GroupSelection,
    symbolSize: number,
): void {
    const offset = symbolSize / 2 + 5;
    g.append('line')
        .attr('x1', -offset)
        .attr('y1', offset)
        .attr('x2', offset)
        .attr('y2', -offset)
        .attr('stroke', '#333')
        .attr('stroke-width', 2);
}

/**
 * Draw proband indicator (arrow pointing to symbol)
 * Bennett standard: arrow pointing to the proband from bottom-left
 */
export function drawProbandIndicator(
    g: GroupSelection,
    symbolSize: number,
): void {
    // Arrow starts from bottom-left, points toward symbol
    const startX = -symbolSize / 2 - 20;
    const startY = symbolSize / 2 + 20;
    const endX = -symbolSize / 2 - 3;
    const endY = symbolSize / 2 + 3;

    // Draw the line first
    g.append('line')
        .attr('x1', startX)
        .attr('y1', startY)
        .attr('x2', endX)
        .attr('y2', endY)
        .attr('stroke', '#333')
        .attr('stroke-width', 2);

    // Arrowhead at the end (pointing toward symbol)
    const angle = Math.atan2(endY - startY, endX - startX);
    const arrowLength = 8;
    const arrowWidth = 6;

    // Calculate arrowhead points
    const tip = { x: endX, y: endY };
    const left = {
        x: endX - arrowLength * Math.cos(angle) - arrowWidth * Math.sin(angle),
        y: endY - arrowLength * Math.sin(angle) + arrowWidth * Math.cos(angle),
    };
    const right = {
        x: endX - arrowLength * Math.cos(angle) + arrowWidth * Math.sin(angle),
        y: endY - arrowLength * Math.sin(angle) - arrowWidth * Math.cos(angle),
    };

    g.append('polygon')
        .attr(
            'points',
            `${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`,
        )
        .attr('fill', '#333');
}

/**
 * Draw adoption brackets [ ] around symbol
 * Ported from pedigreejs pedigree.js get_bracket()
 */
export function drawAdoptionBrackets(
    g: GroupSelection,
    symbolSize: number,
): void {
    const dx = symbolSize * 0.66;
    const dy = symbolSize * 0.64;
    const indent = symbolSize / 4;

    // Left bracket [
    g.append('path')
        .attr(
            'd',
            `M${-dx + indent},${-dy} L${-dx},${-dy} L${-dx},${dy} L${-dx + indent},${dy}`,
        )
        .attr('stroke', '#333')
        .attr('stroke-width', 1.5)
        .attr('fill', 'none');

    // Right bracket ]
    g.append('path')
        .attr(
            'd',
            `M${dx - indent},${-dy} L${dx},${-dy} L${dx},${dy} L${dx - indent},${dy}`,
        )
        .attr('stroke', '#333')
        .attr('stroke-width', 1.5)
        .attr('fill', 'none');
}

/**
 * Draw adoption OUT indicator (arrow pointing away from symbol)
 * Bennett standard: child placed for adoption (vs adopted IN with brackets)
 * Positioned in upper-right to avoid label collision
 */
export function drawAdoptedOutIndicator(g: GroupSelection, symbolSize: number): void {
    const xOffset = symbolSize * 0.6;
    const yOffset = -symbolSize * 0.5; // Move to upper area
    const arrowSize = symbolSize / 4;

    // Arrow pointing right (away from symbol)
    g.append('polygon')
        .attr(
            'points',
            `${xOffset},${yOffset} ${xOffset + arrowSize},${yOffset + arrowSize / 2} ${xOffset},${yOffset + arrowSize}`,
        )
        .attr('fill', '#333');

    // Label "OUT" - positioned to the right of arrow
    g.append('text')
        .attr('x', xOffset + arrowSize + 2)
        .attr('y', yOffset + arrowSize / 2 + 3)
        .attr('font-size', '8px')
        .attr('font-weight', 'bold')
        .attr('fill', '#333')
        .text('OUT');
}

/**
 * Draw foster placement indicator (dashed brackets)
 * Bennett standard: temporary foster placement (vs permanent adoption)
 */
export function drawFosterIndicator(g: GroupSelection, symbolSize: number): void {
    const dx = symbolSize * 0.66;
    const dy = symbolSize * 0.64;
    const indent = symbolSize / 4;

    // Dashed left bracket [
    g.append('path')
        .attr(
            'd',
            `M${-dx + indent},${-dy} L${-dx},${-dy} L${-dx},${dy} L${-dx + indent},${dy}`,
        )
        .attr('stroke', '#333')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '3,2')
        .attr('fill', 'none');

    // Dashed right bracket ]
    g.append('path')
        .attr(
            'd',
            `M${dx - indent},${-dy} L${dx},${-dy} L${dx},${dy} L${dx - indent},${dy}`,
        )
        .attr('stroke', '#333')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '3,2')
        .attr('fill', 'none');
}

/**
 * Draw birth order notation (Roman numerals)
 * Bennett standard: birth order in sibling group (I, II, III, IV, etc.)
 */
export function drawBirthOrderLabel(
    g: GroupSelection,
    birthOrder: number,
    symbolSize: number,
    fontFamily: string,
): void {
    const romanNumerals = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    const label = birthOrder <= 10 ? romanNumerals[birthOrder] : String(birthOrder);

    g.append('text')
        .attr('x', -symbolSize * 0.5 - 5)
        .attr('y', 5)
        .attr('text-anchor', 'end')
        .attr('font-family', fontFamily)
        .attr('font-size', '10px')
        .attr('font-weight', 'bold')
        .attr('fill', '#666')
        .text(label);
}

/**
 * Draw ART (Assisted Reproductive Technology) indicator
 * Bennett standard: symbols for egg/sperm/embryo donation and surrogacy
 * Positioned in upper-right quadrant
 */
export function drawARTIndicator(
    g: GroupSelection,
    artType: 'egg_donor' | 'sperm_donor' | 'embryo_donor' | 'surrogate',
    symbolSize: number,
    fontFamily: string,
): void {
    const labels = {
        egg_donor: 'E',
        sperm_donor: 'S',
        embryo_donor: 'Em',
        surrogate: 'GC', // GC = Gestational Carrier
    };

    const xOffset = symbolSize * 0.5 + 5; // Extra 5px to the right
    const yOffset = -symbolSize * 0.5 + 4;
    g.append('text')
        .attr('x', xOffset)
        .attr('y', yOffset)
        .attr('text-anchor', 'middle')
        .attr('font-family', fontFamily)
        .attr('font-size', '9px')
        .attr('font-weight', 'bold')
        .attr('fill', '#4289BA') // Blue for ART
        .text(labels[artType]);
}

/**
 * Draw pregnancy outcome label
 * Bennett standard: SAB (spontaneous abortion), TOP (termination of pregnancy), etc.
 * Positioned below triangle symbol to avoid label collision
 */
export function drawPregnancyOutcomeLabel(
    g: GroupSelection,
    outcome: 'miscarriage' | 'induced_termination' | 'ectopic' | 'stillbirth',
    symbolSize: number,
    fontFamily: string,
): void {
    const labels = {
        miscarriage: 'SAB', // Spontaneous abortion
        induced_termination: 'TOP', // Termination of pregnancy
        ectopic: 'ECT',
        stillbirth: 'SB',
    };

    // Position ABOVE the triangle symbol to avoid name and dynamic legend collision below
    // White stroke for better visibility on any background
    const text = g.append('text')
        .attr('x', 0)
        .attr('y', -symbolSize * 0.8) // Above symbol to avoid legend collision
        .attr('text-anchor', 'middle')
        .attr('font-family', fontFamily)
        .attr('font-size', '8px')
        .attr('font-weight', 'bold')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 2)
        .attr('paint-order', 'stroke')
        .attr('fill', '#666')
        .text(labels[outcome]);
}

/**
 * Draw gene copy number notation
 * Bennett standard: Het (heterozygous), Hom (homozygous), CH (compound heterozygous)
 */
export function drawGeneCopyNumberLabel(
    g: GroupSelection,
    copyNumber: 'heterozygous' | 'homozygous' | 'compound_heterozygous',
    symbolSize: number,
    fontFamily: string,
): void {
    const labels = {
        heterozygous: 'Het',
        homozygous: 'Hom',
        compound_heterozygous: 'CH',
    };

    g.append('text')
        .attr('x', 0)
        .attr('y', -symbolSize * 0.7)
        .attr('text-anchor', 'middle')
        .attr('font-family', fontFamily)
        .attr('font-size', '8px')
        .attr('font-weight', 'bold')
        .attr('fill', '#4DAA4D') // Green for genetic notation
        .text(labels[copyNumber]);
}

/**
 * Draw gender identity marker (Bennett 2022)
 * Shows gender identity when different from sex assigned at birth
 * Positioned in upper-left quadrant to avoid label collision
 */
export function drawGenderIdentityMarker(
    g: GroupSelection,
    gender: 'M' | 'F' | 'NB' | 'GNC' | 'TM' | 'TF',
    symbolSize: number,
    fontFamily: string,
): void {
    const labels = {
        M: '♂', // Male symbol (when SAAB is F)
        F: '♀', // Female symbol (when SAAB is M)
        NB: 'NB', // Non-binary
        GNC: 'GNC', // Gender non-conforming
        TM: 'TM', // Trans male
        TF: 'TF', // Trans female
    };

    // Position in upper-left quadrant (like Ashkenazi marker is upper-right)
    const xOffset = -symbolSize * 0.75 - 5; // Extra 5px to the left
    const yOffset = -symbolSize * 0.4;

    g.append('text')
        .attr('x', xOffset)
        .attr('y', yOffset)
        .attr('text-anchor', 'start')
        .attr('font-family', fontFamily)
        .attr('font-size', '9px')
        .attr('font-weight', 'bold')
        .attr('fill', '#9370DB') // Purple for gender identity
        .text(labels[gender]);
}

/**
 * Draw generation number (Bennett numbering system)
 * Roman numerals I, II, III, IV, etc. for generation levels
 */
export function drawGenerationNumber(
    svg: SVGSelection,
    generation: number,
    y: number,
    minX: number,
    fontFamily: string,
): void {
    const romanNumerals = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    const label = generation <= 10 ? romanNumerals[generation] : String(generation);

    svg.append('text')
        .attr('x', minX - 40) // Position to left of pedigree
        .attr('y', y + 5) // Vertically align with generation
        .attr('text-anchor', 'end')
        .attr('font-family', fontFamily)
        .attr('font-size', '14px')
        .attr('font-weight', 'bold')
        .attr('fill', '#666')
        .text(label);
}

/**
 * Draw partnership line between two partners
 * Supports consanguineous (double line) and unmarried (dashed line) partnerships
 */
export function drawPartnershipLine(
    svg: SVGSelection,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    isConsanguineous: boolean,
    isUnmarried?: boolean,
): void {
    const cshift = 3; // Offset for double lines (from pedigreejs)

    // Main line (solid for married, dashed for unmarried)
    const mainLine = svg
        .append('line')
        .attr('x1', x1)
        .attr('y1', y1)
        .attr('x2', x2)
        .attr('y2', y2)
        .attr('stroke', '#333')
        .attr('stroke-width', 2);

    // Bennett standard: dashed line for unmarried partnerships
    if (isUnmarried) {
        mainLine.attr('stroke-dasharray', '5,3');
    }

    // Second line for consanguineous partnerships
    if (isConsanguineous) {
        const secondLine = svg
            .append('line')
            .attr('x1', x1)
            .attr('y1', y1 - cshift)
            .attr('x2', x2)
            .attr('y2', y2 - cshift)
            .attr('stroke', '#333')
            .attr('stroke-width', 2);

        // Also dashed if unmarried
        if (isUnmarried) {
            secondLine.attr('stroke-dasharray', '5,3');
        }
    }
}

/**
 * Draw consanguinity degree label on partnership line
 * Bennett standard: text label (e.g., "1st cousins") on consanguineous partnerships
 */
export function drawConsanguinityDegreeLabel(
    svg: SVGSelection,
    x: number,
    y: number,
    degree: string,
    fontFamily: string,
): void {
    svg.append('text')
        .attr('x', x)
        .attr('y', y - 10) // Position above partnership line
        .attr('text-anchor', 'middle')
        .attr('font-family', fontFamily)
        .attr('font-size', '9px')
        .attr('fill', '#666')
        .text(degree);
}

/**
 * Draw no children by choice indicator (line through offspring connection)
 * Bennett standard: perpendicular line through the offspring line
 */
export function drawNoChildrenByChoiceIndicator(
    svg: SVGSelection,
    x: number,
    y: number,
): void {
    const lineLength = 10;
    svg.append('line')
        .attr('x1', x - lineLength / 2)
        .attr('y1', y)
        .attr('x2', x + lineLength / 2)
        .attr('y2', y)
        .attr('stroke', '#D5494A')
        .attr('stroke-width', 2);
}

/**
 * Draw a simple line
 */
export function drawLine(
    svg: SVGSelection,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
): void {
    svg.append('line')
        .attr('x1', x1)
        .attr('y1', y1)
        .attr('x2', x2)
        .attr('y2', y2)
        .attr('stroke', '#333')
        .attr('stroke-width', 2);
}

/**
 * Draw MZ twin bar (horizontal line connecting identical twins)
 * Bennett standard: MZ twins connected by horizontal bar
 */
export function drawTwinBar(
    svg: SVGSelection,
    x1: number,
    x2: number,
    y: number,
): void {
    svg.append('line')
        .attr('x1', x1)
        .attr('y1', y)
        .attr('x2', x2)
        .attr('y2', y)
        .attr('stroke', '#333')
        .attr('stroke-width', 2);
}

/**
 * Draw DZ twin diagonal lines (inverted V from sibship line to twins)
 * Bennett standard: DZ twins have diagonal lines converging to a point on sibship line
 */
export function drawDzTwinLines(
    svg: SVGSelection,
    twin1X: number,
    twin1Y: number,
    twin2X: number,
    twin2Y: number,
    sibshipY: number,
): void {
    // Calculate the convergence point (midpoint between twins on sibship line)
    const convergenceX = (twin1X + twin2X) / 2;
    const convergenceY = sibshipY;

    // Draw diagonal line from convergence point to twin1
    svg.append('line')
        .attr('x1', convergenceX)
        .attr('y1', convergenceY)
        .attr('x2', twin1X)
        .attr('y2', twin1Y)
        .attr('stroke', '#333')
        .attr('stroke-width', 2);

    // Draw diagonal line from convergence point to twin2
    svg.append('line')
        .attr('x1', convergenceX)
        .attr('y1', convergenceY)
        .attr('x2', twin2X)
        .attr('y2', twin2Y)
        .attr('stroke', '#333')
        .attr('stroke-width', 2);
}

/**
 * Draw carrier indicator (dot in center of symbol)
 * Bennett standard: small filled dot in center indicates carrier status
 */
export function drawCarrierIndicator(g: GroupSelection): void {
    g.append('circle').attr('r', 4).attr('fill', '#333');
}

/**
 * Draw pregnancy indicator (P inside symbol)
 * Bennett standard: "P" inside diamond/square/circle for pregnancy
 */
export function drawPregnancyIndicator(
    g: GroupSelection,
    fontFamily: string,
    fontSize: string,
): void {
    g.append('text')
        .attr('x', 0)
        .attr('y', 5)
        .attr('text-anchor', 'middle')
        .attr('font-family', fontFamily)
        .attr('font-size', fontSize)
        .attr('font-weight', 'bold')
        .attr('fill', '#333')
        .text('P');
}

/**
 * Draw Ashkenazi ancestry indicator (A marker in upper right)
 * Bennett standard: "A" marker for Ashkenazi Jewish ancestry
 */
export function drawAshkenaziIndicator(
    g: GroupSelection,
    symbolSize: number,
    fontFamily: string,
    fontSize: string,
): void {
    const xOffset = symbolSize * 0.6 + 3; // Further right with extra spacing
    const yOffset = -symbolSize * 0.6; // Higher up
    g.append('text')
        .attr('x', xOffset)
        .attr('y', yOffset + 4) // Adjust for text baseline
        .attr('text-anchor', 'middle')
        .attr('font-family', fontFamily)
        .attr('font-size', '10px') // Slightly smaller than default
        .attr('font-weight', 'bold')
        .attr('fill', '#333')
        .text('A');
}

/**
 * Draw stillbirth/SAB/termination symbol (triangle with size based on gestational age)
 * Bennett standard: small triangle for early loss, larger for stillbirth (>20 weeks)
 */
export function drawTerminationSymbol(
    g: GroupSelection,
    symbolSize: number,
    nodeBackground: string,
    gestationalWeeks?: number,
): void {
    // Size varies based on gestational age
    // Early loss (<20 weeks): small triangle
    // Stillbirth (>=20 weeks): larger triangle
    const isStillbirth = gestationalWeeks !== undefined && gestationalWeeks >= 20;
    const half = isStillbirth ? symbolSize / 2.5 : symbolSize / 3;

    g.append('polygon')
        .attr('points', `0,${-half} ${half},${half} ${-half},${half}`)
        .attr('fill', nodeBackground)
        .attr('stroke', '#333')
        .attr('stroke-width', 2);
}

/**
 * Draw divorced indicator (double hash marks on partnership line)
 * Bennett standard: two diagonal hash marks indicate divorce/separation
 */
export function drawDivorcedIndicator(
    svg: SVGSelection,
    x: number,
    y: number,
): void {
    const hashSize = 6;
    const spacing = 4;

    // First hash mark
    svg.append('line')
        .attr('x1', x - spacing - hashSize / 2)
        .attr('y1', y - hashSize)
        .attr('x2', x - spacing + hashSize / 2)
        .attr('y2', y + hashSize)
        .attr('stroke', '#333')
        .attr('stroke-width', 2);

    // Second hash mark
    svg.append('line')
        .attr('x1', x + spacing - hashSize / 2)
        .attr('y1', y - hashSize)
        .attr('x2', x + spacing + hashSize / 2)
        .attr('y2', y + hashSize)
        .attr('stroke', '#333')
        .attr('stroke-width', 2);
}

/**
 * Draw consultand indicator (double arrow pointing to individual)
 * Bennett standard: consultand is the person seeking genetic counseling (different from proband)
 */
export function drawConsultandIndicator(g: GroupSelection, symbolSize: number): void {
    const arrowSize = symbolSize / 3;
    const offset = symbolSize * 0.7;

    // First arrow
    g.append('polygon')
        .attr(
            'points',
            `${-offset - arrowSize},${offset} ${-offset},${offset + arrowSize} ${-offset - arrowSize / 2},${offset}`,
        )
        .attr('fill', '#333');

    // Second arrow (closer to symbol)
    g.append('polygon')
        .attr(
            'points',
            `${-offset - arrowSize * 1.7},${offset} ${-offset - arrowSize * 0.7},${offset + arrowSize} ${-offset - arrowSize * 1.2},${offset}`,
        )
        .attr('fill', '#333');
}

/**
 * Draw genetic anticipation indicator (asterisk marker)
 * Bennett standard: asterisk (*) indicates genetic anticipation phenomenon
 */
export function drawAnticipationIndicator(
    g: GroupSelection,
    symbolSize: number,
    fontFamily: string,
): void {
    const xOffset = -symbolSize * 0.6 - 3; // Further left with extra spacing
    const yOffset = -symbolSize * 0.6; // Higher up
    g.append('text')
        .attr('x', xOffset)
        .attr('y', yOffset + 4)
        .attr('text-anchor', 'middle')
        .attr('font-family', fontFamily)
        .attr('font-size', '14px')
        .attr('font-weight', 'bold')
        .attr('fill', '#D5494A') // Red color for visibility
        .text('*');
}

/**
 * Draw obligate carrier indicator (outlined dot)
 * Bennett standard: obligate carrier inferred from pedigree structure
 */
export function drawObligateCarrierIndicator(g: GroupSelection): void {
    g.append('circle')
        .attr('r', 4)
        .attr('fill', 'none')
        .attr('stroke', '#333')
        .attr('stroke-width', 2);
}

/**
 * Draw ectopic pregnancy indicator (EP marker)
 * Bennett standard: "EP" text marker for ectopic pregnancy
 */
export function drawEctopicIndicator(
    g: GroupSelection,
    symbolSize: number,
    fontFamily: string,
): void {
    const yOffset = symbolSize * 1.5 + 5; // Well below symbol and labels
    g.append('text')
        .attr('x', 0)
        .attr('y', yOffset)
        .attr('text-anchor', 'middle')
        .attr('font-family', fontFamily)
        .attr('font-size', '9px')
        .attr('font-weight', 'bold')
        .attr('fill', '#D5494A') // Red for medical condition
        .text('EP');
}

/**
 * Draw infertility indicator (crossed lines through symbol)
 * Bennett standard: X through symbol indicates infertility
 */
export function drawInfertilityIndicator(g: GroupSelection, symbolSize: number): void {
    const size = symbolSize * 0.6;

    // Diagonal line from top-left to bottom-right
    g.append('line')
        .attr('x1', -size)
        .attr('y1', -size)
        .attr('x2', size)
        .attr('y2', size)
        .attr('stroke', '#D5494A')
        .attr('stroke-width', 2);

    // Diagonal line from top-right to bottom-left
    g.append('line')
        .attr('x1', size)
        .attr('y1', -size)
        .attr('x2', -size)
        .attr('y2', size)
        .attr('stroke', '#D5494A')
        .attr('stroke-width', 2);
}

/**
 * Draw pregnancy duration label (gestational weeks near P marker)
 * Bennett standard: show gestational age in weeks for pregnancy/termination
 */
export function drawPregnancyDurationLabel(
    g: GroupSelection,
    weeks: number,
    symbolSize: number,
    fontFamily: string,
): void {
    const offset = symbolSize * 0.5;
    g.append('text')
        .attr('x', offset + 5)
        .attr('y', 5)
        .attr('text-anchor', 'start')
        .attr('font-family', fontFamily)
        .attr('font-size', '8px')
        .attr('fill', '#666')
        .text(`${weeks}w`);
}

/**
 * Draw text label
 */
export function drawLabel(
    g: GroupSelection,
    text: string,
    y: number,
    fontFamily: string,
    fontSize: string,
    color: string = '#666',
): void {
    g.append('text')
        .attr('x', 0)
        .attr('y', y)
        .attr('text-anchor', 'middle')
        .attr('font-family', fontFamily)
        .attr('font-size', fontSize)
        .attr('fill', color)
        .attr('stroke', 'white')
        .attr('stroke-width', '3')
        .attr('paint-order', 'stroke')
        .text(text);
}

/**
 * Draw condition color legend below the pedigree
 * Shows color swatches with condition names, centered horizontally
 */
export function drawLegend(
    svg: SVGSelection,
    conditions: Map<string, string>,
    centerX: number,
    startY: number,
    fontFamily: string,
    fontSize: string,
    swatchSize: number,
    maxWidth: number,
): { width: number; height: number } {
    if (conditions.size === 0) {
        return { width: 0, height: 0 };
    }

    const fontSizeNum = parseInt(fontSize, 10) || 12;
    const textGap = 6;
    const itemGap = 20;
    const rowHeight = Math.max(swatchSize, fontSizeNum) + 10;

    const items: Array<{ name: string; color: string; width: number }> = [];
    for (const [name, color] of conditions) {
        const textWidth = name.length * fontSizeNum * 0.55;
        const itemWidth = swatchSize + textGap + textWidth;
        items.push({ name, color, width: itemWidth });
    }

    const rows: Array<Array<{ name: string; color: string; width: number }>> =
        [];
    let currentRow: typeof items = [];
    let currentRowWidth = 0;

    for (const item of items) {
        const itemTotalWidth =
            item.width + (currentRow.length > 0 ? itemGap : 0);

        if (
            currentRowWidth + itemTotalWidth > maxWidth &&
            currentRow.length > 0
        ) {
            rows.push(currentRow);
            currentRow = [item];
            currentRowWidth = item.width;
        } else {
            currentRow.push(item);
            currentRowWidth += itemTotalWidth;
        }
    }
    if (currentRow.length > 0) {
        rows.push(currentRow);
    }

    let y = startY;
    for (const row of rows) {
        const rowWidth = row.reduce(
            (sum, item, i) => sum + item.width + (i > 0 ? itemGap : 0),
            0,
        );
        let x = centerX - rowWidth / 2;

        for (let i = 0; i < row.length; i++) {
            const item = row[i];
            if (i > 0) x += itemGap;

            svg.append('rect')
                .attr('x', x)
                .attr('y', y)
                .attr('width', swatchSize)
                .attr('height', swatchSize)
                .attr('fill', item.color)
                .attr('stroke', '#333')
                .attr('stroke-width', 1);

            svg.append('text')
                .attr('x', x + swatchSize + textGap)
                .attr('y', y + swatchSize / 2 + fontSizeNum * 0.35)
                .attr('font-family', fontFamily)
                .attr('font-size', fontSize)
                .attr('fill', '#333')
                .attr('text-anchor', 'start')
                .text(item.name);

            x += item.width;
        }
        y += rowHeight;
    }

    const maxRowWidth = Math.max(
        ...rows.map(row =>
            row.reduce(
                (sum, item, i) => sum + item.width + (i > 0 ? itemGap : 0),
                0,
            ),
        ),
    );
    const totalHeight = rows.length * rowHeight;

    return { width: maxRowWidth, height: totalHeight };
}
