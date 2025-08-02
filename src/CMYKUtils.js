/**
 * Converts RGB to CMYK (0-255 in, 0-255 out)
 */
export function rgbToCmyk(r, g, b) {
  let c = 1 - (r / 255);
  let m = 1 - (g / 255);
  let y = 1 - (b / 255);

  let k = Math.min(c, m, y);
  if (k === 1) return [0, 0, 0, 255];

  c = (c - k) / (1 - k);
  m = (m - k) / (1 - k);
  y = (y - k) / (1 - k);

  return [
    Math.round(c * 255),
    Math.round(m * 255),
    Math.round(y * 255),
    Math.round(k * 255)
  ];
}

/**
 * Converts CMYK (0-255) to RGB (0-255)
 */
export function cmykToRgb(c, m, y, k) {
  c /= 255; m /= 255; y /= 255; k /= 255;
  const r = 255 * (1 - c) * (1 - k);
  const g = 255 * (1 - m) * (1 - k);
  const b = 255 * (1 - y) * (1 - k);
  return [
    Math.round(r),
    Math.round(g),
    Math.round(b)
  ];
}

/**
 * Exclusive: Her piksel sadece en yüksek CMYK kanalına atanır (overlap olmaz)
 */
export function separateCMYKExclusive(imageData) {
  const { width, height, data } = imageData;
  const cData = new Uint8ClampedArray(data.length);
  const mData = new Uint8ClampedArray(data.length);
  const yData = new Uint8ClampedArray(data.length);
  const kData = new Uint8ClampedArray(data.length);

  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i], data[i+1], data[i+2]];
    const [c, m, y, k] = rgbToCmyk(r, g, b);

    const vals = [c, m, y, k];
    const maxVal = Math.max(...vals);

    if (maxVal === 0) {
      cData[i]=mData[i]=yData[i]=kData[i]=255;
      cData[i+1]=mData[i+1]=yData[i+1]=kData[i+1]=255;
      cData[i+2]=mData[i+2]=yData[i+2]=kData[i+2]=255;
      cData[i+3]=mData[i+3]=yData[i+3]=kData[i+3]=255;
      continue;
    }

    [cData, mData, yData, kData].forEach((arr, idx) => {
      const isMax = vals[idx] === maxVal && maxVal > 0;
      arr[i] = arr[i+1] = arr[i+2] = isMax ? 0 : 255;
      arr[i+3] = 255;
    });
  }

  return [
    new ImageData(cData, width, height),
    new ImageData(mData, width, height),
    new ImageData(yData, width, height),
    new ImageData(kData, width, height)
  ];
}

// 4x4 Bayer matrix
const bayer4x4 = [
  0,  8,  2, 10,
 12,  4, 14,  6,
  3, 11,  1,  9,
 15,  7, 13,  5
];
function bayerThreshold4x4(x, y, value) {
  const threshold = bayer4x4[(y % 4) * 4 + (x % 4)];
  return (value / 17) > threshold;
}

/**
 * Halftone (4x4 Bayer dither) + overlap engelleme
 */
export function separateCMYKHalftoneExclusive(imageData) {
  const { width, height, data } = imageData;
  const cData = new Uint8ClampedArray(data.length);
  const mData = new Uint8ClampedArray(data.length);
  const yData = new Uint8ClampedArray(data.length);
  const kData = new Uint8ClampedArray(data.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const [r, g, b] = [data[i], data[i+1], data[i+2]];
      const [c, m, yC, k] = rgbToCmyk(r, g, b);

      const cDot = bayerThreshold4x4(x, y, c);
      const mDot = bayerThreshold4x4(x, y, m);
      const yDot = bayerThreshold4x4(x, y, yC);
      const kDot = bayerThreshold4x4(x, y, k);

      let mark = [cDot, mDot, yDot, kDot];
      let found = false;
      for (let kdx = 0; kdx < 4; kdx++) {
        if (!found && mark[kdx]) {
          [cData, mData, yData, kData].forEach((arr, arrIdx) => {
            arr[i] = arr[i+1] = arr[i+2] = (arrIdx === kdx ? 0 : 255);
            arr[i+3] = 255;
          });
          found = true;
        }
      }
      if (!found) {
        cData[i]=mData[i]=yData[i]=kData[i]=255;
        cData[i+1]=mData[i+1]=yData[i+1]=kData[i+1]=255;
        cData[i+2]=mData[i+2]=yData[i+2]=kData[i+2]=255;
        cData[i+3]=mData[i+3]=yData[i+3]=kData[i+3]=255;
      }
    }
  }
  return [
    new ImageData(cData, width, height),
    new ImageData(mData, width, height),
    new ImageData(yData, width, height),
    new ImageData(kData, width, height)
  ];
}

// 8x8 Bayer matrix
const bayer8x8 = [
   0, 32,  8, 40,  2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44,  4, 36, 14, 46,  6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
   3, 35, 11, 43,  1, 33,  9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47,  7, 39, 13, 45,  5, 37,
  63, 31, 55, 23, 61, 29, 53, 21
];
function bayerThreshold8x8(x, y, value) {
  const threshold = bayer8x8[(y % 8) * 8 + (x % 8)];
  return (value / 4.031) > threshold;
}

/**
 * Halftone (8x8 Bayer dither) + overlap engelleme
 */
export function separateCMYKHalftone8x8Exclusive(imageData) {
  const { width, height, data } = imageData;
  const cData = new Uint8ClampedArray(data.length);
  const mData = new Uint8ClampedArray(data.length);
  const yData = new Uint8ClampedArray(data.length);
  const kData = new Uint8ClampedArray(data.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const [r, g, b] = [data[i], data[i+1], data[i+2]];
      const [c, m, yC, k] = rgbToCmyk(r, g, b);

      const cDot = bayerThreshold8x8(x, y, c);
      const mDot = bayerThreshold8x8(x, y, m);
      const yDot = bayerThreshold8x8(x, y, yC);
      const kDot = bayerThreshold8x8(x, y, k);

      let mark = [cDot, mDot, yDot, kDot];
      let found = false;
      for (let kdx = 0; kdx < 4; kdx++) {
        if (!found && mark[kdx]) {
          [cData, mData, yData, kData].forEach((arr, arrIdx) => {
            arr[i] = arr[i+1] = arr[i+2] = (arrIdx === kdx ? 0 : 255);
            arr[i+3] = 255;
          });
          found = true;
        }
      }
      if (!found) {
        cData[i]=mData[i]=yData[i]=kData[i]=255;
        cData[i+1]=mData[i+1]=yData[i+1]=kData[i+1]=255;
        cData[i+2]=mData[i+2]=yData[i+2]=kData[i+2]=255;
        cData[i+3]=mData[i+3]=yData[i+3]=kData[i+3]=255;
      }
    }
  }
  return [
    new ImageData(cData, width, height),
    new ImageData(mData, width, height),
    new ImageData(yData, width, height),
    new ImageData(kData, width, height)
  ];
}