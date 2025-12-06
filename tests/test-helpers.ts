/**
 * Test helper utilities for validating pedigree SVG geometry
 * These utilities extract and validate coordinates from rendered SVG strings
 */

export interface Line {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

export interface Symbol {
    type: 'rect' | 'circle' | 'polygon';
    x: number;
    y: number;
    width?: number;
    height?: number;
    r?: number;
}

export interface TextElement {
    x: number;
    y: number;
    content: string;
}

export interface Path {
    d: string;
}

export interface Group {
    transform: string;
    x: number;
    y: number;
}

/**
 * Extract all line elements from SVG string
 */
export function extractLines(svg: string): Line[] {
    const lineRegex = /<line[^>]*x1="([^"]*)"[^>]*y1="([^"]*)"[^>]*x2="([^"]*)"[^>]*y2="([^"]*)"[^>]*>/g;
    const lines: Line[] = [];
    let match;
    while ((match = lineRegex.exec(svg)) !== null) {
        lines.push({
            x1: parseFloat(match[1]),
            y1: parseFloat(match[2]),
            x2: parseFloat(match[3]),
            y2: parseFloat(match[4]),
        });
    }
    return lines;
}

/**
 * Extract all symbols (rect, circle, polygon) from SVG string
 */
export function extractSymbols(svg: string): Symbol[] {
    const symbols: Symbol[] = [];

    // Extract rectangles
    const rectRegex = /<rect[^>]*x="([^"]*)"[^>]*y="([^"]*)"[^>]*width="([^"]*)"[^>]*height="([^"]*)"[^>]*>/g;
    let match;
    while ((match = rectRegex.exec(svg)) !== null) {
        symbols.push({
            type: 'rect',
            x: parseFloat(match[1]),
            y: parseFloat(match[2]),
            width: parseFloat(match[3]),
            height: parseFloat(match[4]),
        });
    }

    // Extract circles
    const circleRegex = /<circle[^>]*cx="([^"]*)"[^>]*cy="([^"]*)"[^>]*r="([^"]*)"[^>]*>/g;
    while ((match = circleRegex.exec(svg)) !== null) {
        symbols.push({
            type: 'circle',
            x: parseFloat(match[1]),
            y: parseFloat(match[2]),
            r: parseFloat(match[3]),
        });
    }

    // Extract polygons (diamonds)
    const polygonRegex = /<polygon[^>]*points="([^"]*)"[^>]*>/g;
    while ((match = polygonRegex.exec(svg)) !== null) {
        const points = match[1].split(' ');
        const coords = points.map(p => {
            const [x, y] = p.split(',');
            return { x: parseFloat(x), y: parseFloat(y) };
        });
        // Use center point as position
        const avgX = coords.reduce((sum, c) => sum + c.x, 0) / coords.length;
        const avgY = coords.reduce((sum, c) => sum + c.y, 0) / coords.length;
        symbols.push({
            type: 'polygon',
            x: avgX,
            y: avgY,
        });
    }

    return symbols;
}

/**
 * Extract all text elements from SVG string
 */
export function extractText(svg: string): TextElement[] {
    const textRegex = /<text[^>]*x="([^"]*)"[^>]*y="([^"]*)"[^>]*>(.*?)<\/text>/g;
    const texts: TextElement[] = [];
    let match;
    while ((match = textRegex.exec(svg)) !== null) {
        texts.push({
            x: parseFloat(match[1]),
            y: parseFloat(match[2]),
            content: match[3],
        });
    }
    return texts;
}

/**
 * Extract all path elements from SVG string
 */
export function extractPaths(svg: string): Path[] {
    const pathRegex = /<path[^>]*d="([^"]*)"[^>]*>/g;
    const paths: Path[] = [];
    let match;
    while ((match = pathRegex.exec(svg)) !== null) {
        paths.push({
            d: match[1],
        });
    }
    return paths;
}

/**
 * Extract all group transforms from SVG string
 */
export function extractGroups(svg: string): Group[] {
    const groupRegex = /<g[^>]*transform="translate\(([^,]+),([^)]+)\)"[^>]*>/g;
    const groups: Group[] = [];
    let match;
    while ((match = groupRegex.exec(svg)) !== null) {
        groups.push({
            transform: `translate(${match[1]},${match[2]})`,
            x: parseFloat(match[1]),
            y: parseFloat(match[2]),
        });
    }
    return groups;
}

/**
 * Extract all SVG elements
 */
export function extractSvgElements(svg: string) {
    return {
        symbols: extractSymbols(svg),
        lines: extractLines(svg),
        paths: extractPaths(svg),
        text: extractText(svg),
        groups: extractGroups(svg),
    };
}

/**
 * Assert that a line is vertical (x1 ≈ x2)
 */
export function assertVerticalLine(line: Line, tolerance = 1) {
    const deltaX = Math.abs(line.x1 - line.x2);
    if (deltaX >= tolerance) {
        throw new Error(
            `Expected vertical line but found diagonal: (${line.x1}, ${line.y1}) -> (${line.x2}, ${line.y2}). ` +
            `ΔX = ${deltaX}, tolerance = ${tolerance}`
        );
    }
}

/**
 * Assert that a line is horizontal (y1 ≈ y2)
 */
export function assertHorizontalLine(line: Line, tolerance = 1) {
    const deltaY = Math.abs(line.y1 - line.y2);
    if (deltaY >= tolerance) {
        throw new Error(
            `Expected horizontal line but found diagonal: (${line.x1}, ${line.y1}) -> (${line.x2}, ${line.y2}). ` +
            `ΔY = ${deltaY}, tolerance = ${tolerance}`
        );
    }
}

/**
 * Assert that two parallel lines exist with exact spacing (for consanguineous double lines)
 */
export function assertDoubleLine(lines: Line[], spacing = 3, tolerance = 1) {
    if (lines.length !== 2) {
        throw new Error(`Expected 2 parallel lines but found ${lines.length}`);
    }

    const [line1, line2] = lines;

    // Check if lines are parallel (same slope)
    const slope1 = (line1.y2 - line1.y1) / (line1.x2 - line1.x1);
    const slope2 = (line2.y2 - line2.y1) / (line2.x2 - line2.x1);

    if (Math.abs(slope1 - slope2) > 0.1) {
        throw new Error(`Lines are not parallel. Slopes: ${slope1}, ${slope2}`);
    }

    // Calculate perpendicular distance between lines
    // For horizontal lines, use Y offset
    if (Math.abs(slope1) < 0.1) {
        const offset = Math.abs(line1.y1 - line2.y1);
        if (Math.abs(offset - spacing) > tolerance) {
            throw new Error(
                `Expected spacing ${spacing}px between parallel horizontal lines, but found ${offset}px`
            );
        }
    } else {
        // For other lines, calculate perpendicular distance
        const offset = Math.abs(line1.y1 - line2.y1);
        if (Math.abs(offset - spacing) > tolerance) {
            throw new Error(
                `Expected spacing ~${spacing}px between parallel lines, but found ${offset}px`
            );
        }
    }
}

/**
 * Assert that an element is centered on a symbol
 */
export function assertCentered(element: { x: number }, symbol: { x: number }, tolerance = 1) {
    const offset = Math.abs(element.x - symbol.x);
    if (offset >= tolerance) {
        throw new Error(
            `Expected element at x=${element.x} to be centered on symbol at x=${symbol.x}. ` +
            `Offset = ${offset}, tolerance = ${tolerance}`
        );
    }
}

/**
 * Find line connecting two positions
 */
export function findLineBetween(
    lines: Line[],
    from: { x: number; y: number },
    to: { x: number; y: number },
    tolerance = 5
): Line | undefined {
    return lines.find(
        line =>
            (Math.abs(line.x1 - from.x) < tolerance && Math.abs(line.y1 - from.y) < tolerance &&
             Math.abs(line.x2 - to.x) < tolerance && Math.abs(line.y2 - to.y) < tolerance) ||
            (Math.abs(line.x1 - to.x) < tolerance && Math.abs(line.y1 - to.y) < tolerance &&
             Math.abs(line.x2 - from.x) < tolerance && Math.abs(line.y2 - from.y) < tolerance)
    );
}

/**
 * Find all lines starting from a position
 */
export function findLinesFrom(
    lines: Line[],
    from: { x: number; y: number },
    tolerance = 1
): Line[] {
    return lines.filter(
        line =>
            Math.abs(line.x1 - from.x) < tolerance &&
            Math.abs(line.y1 - from.y) < tolerance
    );
}

/**
 * Calculate minimum spacing between X positions
 */
export function getMinimumXSpacing(positions: Array<{ x: number }>): number {
    const sorted = positions.map(p => p.x).sort((a, b) => a - b);
    let minSpacing = Infinity;

    for (let i = 1; i < sorted.length; i++) {
        const spacing = sorted[i] - sorted[i - 1];
        if (spacing < minSpacing) {
            minSpacing = spacing;
        }
    }

    return minSpacing;
}

/**
 * Group positions by Y coordinate (generation)
 */
export function groupByGeneration(
    positions: Array<{ x: number; y: number }>,
    tolerance = 1
): Map<number, Array<{ x: number; y: number }>> {
    const groups = new Map<number, Array<{ x: number; y: number }>>();

    for (const pos of positions) {
        // Find existing group with similar Y
        let foundGroup = false;
        for (const [y, group] of groups.entries()) {
            if (Math.abs(y - pos.y) < tolerance) {
                group.push(pos);
                foundGroup = true;
                break;
            }
        }

        if (!foundGroup) {
            groups.set(pos.y, [pos]);
        }
    }

    return groups;
}
