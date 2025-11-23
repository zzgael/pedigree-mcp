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
    .attr('fill', conditions.length > 0 ? conditions[0].colour : nodeBackground)
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
    .attr('fill', conditions.length > 0 ? conditions[0].colour : nodeBackground)
    .attr('stroke', '#333')
    .attr('stroke-width', 2);

  // Add condition pie slices if multiple conditions
  if (conditions.length > 1) {
    const arc = d3.arc<d3.PieArcDatum<ColorItem>>();
    const pie = d3.pie<ColorItem>().value(1);
    const arcs = pie(conditions.slice(0, 4));

    arcs.forEach((arcData) => {
      g.append('path')
        .attr('d', arc.innerRadius(0).outerRadius(symbolSize / 2 - 1)(arcData) || '')
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
    .attr('fill', conditions.length > 0 ? conditions[0].colour : nodeBackground)
    .attr('stroke', '#333')
    .attr('stroke-width', 2);
}

/**
 * Draw deceased indicator (diagonal line)
 */
export function drawDeceasedIndicator(g: GroupSelection, symbolSize: number): void {
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
 */
export function drawProbandIndicator(g: GroupSelection, symbolSize: number): void {
  const arrowSize = 10;
  const offset = symbolSize / 2 + 15;
  g.append('polygon')
    .attr(
      'points',
      `${-offset},${offset} ${-offset + arrowSize},${offset - arrowSize / 2} ${-offset + arrowSize / 2},${offset - arrowSize}`,
    )
    .attr('fill', '#333');
  g.append('line')
    .attr('x1', -offset)
    .attr('y1', offset)
    .attr('x2', -symbolSize / 2 - 3)
    .attr('y2', symbolSize / 2 + 3)
    .attr('stroke', '#333')
    .attr('stroke-width', 2);
}

/**
 * Draw adoption brackets [ ] around symbol
 * Ported from pedigreejs pedigree.js get_bracket()
 */
export function drawAdoptionBrackets(g: GroupSelection, symbolSize: number): void {
  const dx = symbolSize * 0.66;
  const dy = symbolSize * 0.64;
  const indent = symbolSize / 4;

  // Left bracket [
  g.append('path')
    .attr('d', `M${-dx + indent},${-dy} L${-dx},${-dy} L${-dx},${dy} L${-dx + indent},${dy}`)
    .attr('stroke', '#333')
    .attr('stroke-width', 1.5)
    .attr('fill', 'none');

  // Right bracket ]
  g.append('path')
    .attr('d', `M${dx - indent},${-dy} L${dx},${-dy} L${dx},${dy} L${dx - indent},${dy}`)
    .attr('stroke', '#333')
    .attr('stroke-width', 1.5)
    .attr('fill', 'none');
}

/**
 * Draw partnership line between two partners
 * Supports consanguineous (double line) partnerships
 */
export function drawPartnershipLine(
  svg: SVGSelection,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  isConsanguineous: boolean,
): void {
  const cshift = 3; // Offset for double lines (from pedigreejs)

  // Main line
  svg
    .append('line')
    .attr('x1', x1)
    .attr('y1', y1)
    .attr('x2', x2)
    .attr('y2', y2)
    .attr('stroke', '#333')
    .attr('stroke-width', 2);

  // Second line for consanguineous partnerships
  if (isConsanguineous) {
    svg
      .append('line')
      .attr('x1', x1)
      .attr('y1', y1 - cshift)
      .attr('x2', x2)
      .attr('y2', y2 - cshift)
      .attr('stroke', '#333')
      .attr('stroke-width', 2);
  }
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
  svg
    .append('line')
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
export function drawTwinBar(svg: SVGSelection, x1: number, x2: number, y: number): void {
  svg
    .append('line')
    .attr('x1', x1)
    .attr('y1', y)
    .attr('x2', x2)
    .attr('y2', y)
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
 * Draw stillbirth/SAB/termination symbol (small triangle)
 * Bennett standard: small triangle for pregnancy not carried to term
 */
export function drawTerminationSymbol(
  g: GroupSelection,
  symbolSize: number,
  nodeBackground: string,
): void {
  const half = symbolSize / 3; // Smaller than regular symbols
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
export function drawDivorcedIndicator(svg: SVGSelection, x: number, y: number): void {
  const hashSize = 6;
  const spacing = 4;

  // First hash mark
  svg
    .append('line')
    .attr('x1', x - spacing - hashSize / 2)
    .attr('y1', y - hashSize)
    .attr('x2', x - spacing + hashSize / 2)
    .attr('y2', y + hashSize)
    .attr('stroke', '#333')
    .attr('stroke-width', 2);

  // Second hash mark
  svg
    .append('line')
    .attr('x1', x + spacing - hashSize / 2)
    .attr('y1', y - hashSize)
    .attr('x2', x + spacing + hashSize / 2)
    .attr('y2', y + hashSize)
    .attr('stroke', '#333')
    .attr('stroke-width', 2);
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
    .text(text);
}
