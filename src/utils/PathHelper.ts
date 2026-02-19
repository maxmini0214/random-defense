import Phaser from 'phaser';

/**
 * Creates an S-shaped path that fits within the given bounds.
 * The path snakes down the map area in horizontal passes.
 */
export function createSPath(
  x: number,
  y: number,
  width: number,
  height: number,
  rows: number = 4
): Phaser.Curves.Path {
  const path = new Phaser.Curves.Path(x + 20, y);
  const rowHeight = height / rows;
  const margin = 20;

  for (let i = 0; i < rows; i++) {
    const rowY = y + rowHeight * i + rowHeight / 2;

    if (i % 2 === 0) {
      // Left to right
      path.lineTo(x + width - margin, rowY);
      if (i < rows - 1) {
        // Curve down to next row
        path.ellipseTo(margin, rowHeight / 2, 0, 180, false, 0);
      }
    } else {
      // Right to left
      path.lineTo(x + margin, rowY);
      if (i < rows - 1) {
        // Curve down to next row
        path.ellipseTo(margin, rowHeight / 2, 180, 0, false, 0);
      }
    }
  }

  return path;
}

/**
 * Creates a simpler S-path with explicit waypoints for reliable movement.
 */
export function createWaypointPath(
  mapX: number,
  mapY: number,
  mapW: number,
  mapH: number
): { path: Phaser.Curves.Path; waypoints: Phaser.Math.Vector2[] } {
  const margin = 30;
  const rows = 4;
  const rowH = mapH / rows;
  const left = mapX + margin;
  const right = mapX + mapW - margin;

  const waypoints: Phaser.Math.Vector2[] = [];

  // Start from top-left
  waypoints.push(new Phaser.Math.Vector2(left, mapY + 10));

  for (let i = 0; i < rows; i++) {
    const centerY = mapY + rowH * i + rowH / 2;

    if (i % 2 === 0) {
      // Go right
      waypoints.push(new Phaser.Math.Vector2(right, centerY));
      if (i < rows - 1) {
        waypoints.push(new Phaser.Math.Vector2(right, centerY + rowH));
      }
    } else {
      // Go left
      waypoints.push(new Phaser.Math.Vector2(left, centerY));
      if (i < rows - 1) {
        waypoints.push(new Phaser.Math.Vector2(left, centerY + rowH));
      }
    }
  }

  // End point at bottom
  const lastRow = rows - 1;
  const lastY = mapY + mapH - 10;
  if (lastRow % 2 === 0) {
    waypoints.push(new Phaser.Math.Vector2(right, lastY));
  } else {
    waypoints.push(new Phaser.Math.Vector2(left, lastY));
  }

  // Build spline path
  const path = new Phaser.Curves.Path(waypoints[0].x, waypoints[0].y);
  for (let i = 1; i < waypoints.length; i++) {
    path.lineTo(waypoints[i].x, waypoints[i].y);
  }

  return { path, waypoints };
}

/**
 * Draw the path onto a Graphics object.
 */
export function drawPath(
  graphics: Phaser.GameObjects.Graphics,
  path: Phaser.Curves.Path,
  color: number = 0xe8d5b7,
  lineWidth: number = 24
): void {
  graphics.lineStyle(lineWidth, color, 0.8);
  path.draw(graphics, 128);

  // Draw subtle border
  graphics.lineStyle(lineWidth + 4, color, 0.2);
  path.draw(graphics, 128);
}
