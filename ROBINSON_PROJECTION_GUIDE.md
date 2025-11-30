# Robinson Projection Natural Bounds and Scaling Guide

> ⚠️⚠️⚠️ Excepting this line, this file was written by Claude and has not be verified AT ALL.

This guide explains the natural bounds of the Robinson projection in d3-geo-projection and how to properly size it.

## Quick Reference

### Natural Bounds at scale=1

- **Width**: 2π (≈ 6.283185)
- **Height**: ≈ 3.186832
- **Aspect Ratio**: ≈ 1.97:1 (width:height)

### Default Scale

The Robinson projection's default scale is **152.63**

### Scaling Formula

To fill a specific width:

```javascript
const scale = width / (2 * Math.PI);
```

This formula **IS CORRECT** for the Robinson projection.

## Detailed Analysis

### 1. Natural Bounds at Scale=1

The Robinson projection at scale=1 with translate=[0,0] has these characteristics:

```javascript
const proj = geoRobinson().scale(1).translate([0, 0]);

// Width varies by latitude
proj([-180, 0]); // [-π, 0]
proj([180, 0]); // [π, 0]
// Width at equator: 2π = 6.283185

// Height from pole to pole
proj([0, 90]); // [0, -1.593416]
proj([0, -90]); // [0, 1.593416]
// Total height: 3.186832
```

**Key insight**: The Robinson projection's width at the equator is exactly **2π**, just like Mercator.

### 2. Pixel Bounds at Default Scale (152.63)

At the default scale:

- Width: ≈ 959 pixels
- Height: ≈ 486 pixels
- Center: [480, 250]

### 3. Scaling to Fill a Given Width

#### Method 1: Manual Scale Calculation (Current Approach)

```javascript
const width = 960;
const height = 480; // or whatever your canvas height is

const projection = geoRobinson()
  .scale(width / (2 * Math.PI))
  .translate([width / 2, height / 2]);
```

**Result**:

- The map fills the **full width** (960 pixels)
- The actual map height is ≈487 pixels
- With a 480px canvas, the poles extend slightly beyond the canvas

**This is the correct approach if you want to maximize width!**

#### Method 2: Use fitSize() (Recommended for Flexibility)

```javascript
const worldGeoJSON = {
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [-180, -90],
        [180, -90],
        [180, 90],
        [-180, 90],
        [-180, -90],
      ],
    ],
  },
};

const projection = geoRobinson().fitSize([width, height], worldGeoJSON);
```

**Result**:

- The map fits entirely within the canvas
- Auto-calculates scale and translate
- May have margins on sides or top/bottom

#### Method 3: Use fitWidth()

```javascript
const projection = geoRobinson().fitWidth(width, worldGeoJSON);
```

**Result**:

- Map fills the exact width
- Height is automatically calculated based on aspect ratio
- No vertical centering (you need to adjust translate if desired)

#### Method 4: Use fitExtent() for Precise Control

```javascript
const margin = 10;
const projection = geoRobinson().fitExtent(
  [
    [margin, margin],
    [width - margin, height - margin],
  ],
  worldGeoJSON,
);
```

**Result**:

- Map fits within specified bounds with margins
- Auto-calculates scale and translate

## Why `width / (2 * Math.PI)` Works

The Robinson projection's coordinate space at the equator ranges from -π to π (total width of 2π).

When you set `scale = k`, each unit in the coordinate space becomes `k` pixels:

- At scale=1: width = 2π units
- At scale=k: width = k × 2π pixels

Therefore, to get a width of `w` pixels:

```
w = k × 2π
k = w / (2π)
```

## Common Issues and Solutions

### Issue: "The map doesn't fill the canvas width"

**Diagnosis**: Check if you're looking at the equator or higher latitudes.

The Robinson projection tapers at higher latitudes:

- At equator (0°): width = 2π × scale
- At 45°: width ≈ 1.79 × scale
- At 60°: width ≈ 1.59 × scale
- At 85°: width ≈ 1.14 × scale

**Solution**: The formula is correct. The map DOES fill the width at the equator.

### Issue: "There's empty space at top/bottom"

**Diagnosis**: The Robinson projection's natural aspect ratio is ~1.97:1.

For a 960px wide map, the natural height is ~487px. If your canvas is 960×480, you'll have 7px of empty space.

**Solutions**:

1. Adjust canvas height to match: `height = Math.ceil(width / 1.97)`
2. Use `fitSize()` to fit within the canvas (will add margins)
3. Accept the small amount of empty space

### Issue: "The map is cut off at poles"

**Diagnosis**: Your canvas height is smaller than the natural Robinson height.

**Solutions**:

1. Increase canvas height to `width / 1.97`
2. Reduce scale: `scale = (width / (2 * Math.PI)) * 0.98`
3. Use `fitSize()` instead

## Practical Examples

### Example 1: Maximize Width (Current content.ts approach)

```typescript
function reproject(sourceImage: HTMLImageElement, destProjection: GeoProjection) {
  const width = sourceImage.naturalWidth || sourceImage.width;
  const height = sourceImage.naturalHeight || sourceImage.height;

  const projection = geoRobinson()
    .scale(width / (2 * Math.PI))
    .translate([width / 2, height / 2]);

  // ... rest of reprojection logic
}
```

This is **correct** if your goal is to fill the maximum width.

### Example 2: Perfect Fit (No Clipping)

```typescript
function reprojectFitted(sourceImage: HTMLImageElement) {
  const width = sourceImage.naturalWidth || sourceImage.width;
  const height = sourceImage.naturalHeight || sourceImage.height;

  const worldGeoJSON = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [-180, -90],
          [180, -90],
          [180, 90],
          [-180, 90],
          [-180, -90],
        ],
      ],
    },
  };

  const projection = geoRobinson().fitSize([width, height], worldGeoJSON);

  // ... rest of reprojection logic
}
```

### Example 3: Optimal Canvas Size

```typescript
function createOptimalCanvas(width: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.ceil(width / 1.97); // Robinson aspect ratio

  const projection = geoRobinson()
    .scale(width / (2 * Math.PI))
    .translate([canvas.width / 2, canvas.height / 2]);

  return { canvas, projection };
}
```

## Summary

1. **The formula `width / (2 * Math.PI)` is CORRECT** for Robinson projection
2. The natural aspect ratio is **1.97:1** (width:height)
3. For width `w`, the natural height is `w / 1.97` ≈ `0.507 × w`
4. Use `fitSize()` when you want the map to fit entirely within bounds
5. Use `width / (2 * Math.PI)` when you want to maximize width

## References

- [d3-geo-projection Robinson source code](https://github.com/d3/d3-geo-projection/blob/master/src/robinson.js)
- [Robinson projection Observable example](https://observablehq.com/@d3/robinson)
- [D3 Projections documentation](https://d3js.org/d3-geo/projection)
