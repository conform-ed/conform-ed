/**
 * Graphic primitives shared by the graphic interaction family and areaMapping scoring:
 * QTI shape/coords parsing and point-in-shape hit testing. Pure logic, no React.
 *
 * Shapes follow the QTI (HTML image-map) conventions:
 * - `circle`:  center-x, center-y, radius
 * - `rect`:    left-x, top-y, right-x, bottom-y
 * - `poly`:    x1, y1, ..., xn, yn
 * - `ellipse`: center-x, center-y, radius-x, radius-y
 * - `default`: the entire image
 */

export type QtiShape = "circle" | "rect" | "poly" | "ellipse" | "default";

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Parse a QTI coords attribute ("10,20,30") into numbers. */
export function parseCoords(coords: string): number[] {
  return coords
    .split(",")
    .map((entry) => Number(entry.trim()))
    .filter((value) => !Number.isNaN(value));
}

/** Parse a QTI point value ("x y") or null when malformed. */
export function parsePoint(value: string): Point | null {
  const [x, y, ...rest] = value.trim().split(/\s+/u).map(Number);

  if (x === undefined || y === undefined || rest.length > 0 || Number.isNaN(x) || Number.isNaN(y)) {
    return null;
  }

  return { x, y };
}

export function formatPoint(point: Point): string {
  return `${point.x} ${point.y}`;
}

function pointInPolygon(coords: readonly number[], point: Point): boolean {
  let inside = false;

  for (let i = 0, j = coords.length - 2; i < coords.length; j = i, i += 2) {
    const xi = coords[i]!;
    const yi = coords[i + 1]!;
    const xj = coords[j]!;
    const yj = coords[j + 1]!;
    const intersects = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

/** QTI hit test: is `point` inside the area described by (shape, coords)? */
export function pointInShape(shape: string, coords: readonly number[], point: Point): boolean {
  switch (shape) {
    case "default":
      return true;

    case "circle": {
      const [cx, cy, r] = coords;

      if (cx === undefined || cy === undefined || r === undefined) {
        return false;
      }

      return (point.x - cx) ** 2 + (point.y - cy) ** 2 <= r ** 2;
    }

    case "rect": {
      const [left, top, right, bottom] = coords;

      if (left === undefined || top === undefined || right === undefined || bottom === undefined) {
        return false;
      }

      return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom;
    }

    case "ellipse": {
      const [cx, cy, rx, ry] = coords;

      if (cx === undefined || cy === undefined || rx === undefined || ry === undefined || rx === 0 || ry === 0) {
        return false;
      }

      return (point.x - cx) ** 2 / rx ** 2 + (point.y - cy) ** 2 / ry ** 2 <= 1;
    }

    case "poly":
      return coords.length >= 6 && pointInPolygon(coords, point);

    default:
      return false;
  }
}
