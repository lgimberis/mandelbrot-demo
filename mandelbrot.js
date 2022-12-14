const X_MIN_MIN = -2.05;
const X_MAX_MAX = 0.47;
const Y_MIN_MIN = -1.12;
const Y_MAX_MAX = 1.12;
const MAX_ITERATIONS = 100;

let x_min = X_MIN_MIN;
let x_max = X_MAX_MAX;
let y_min = Y_MIN_MIN;
let y_max = Y_MAX_MAX;

const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');

const width = canvas.width;
const height = canvas.height;
const complexArrays = new Float64Array(3 * width * height).fill(0.0);
const iterationCountArray = new Int16Array(width * height).fill(0);
const finishedArray = new Uint8Array(width * height).fill(0);

const imageArray = new Uint8ClampedArray(4 * width * height).fill(0);
const bufferedImageArray = new Uint8ClampedArray(4 * width * height).fill(0);

for (let index = 0; index < width * height; index++) {
  imageArray[4 * index] = 255;
  bufferedImageArray[4 * index] = 255;
}
let isBuffering = false;
let sequence = 0;

async function paintMandelbrot() {
  let our_sequence = sequence;
  for (let iterations = 0; iterations < MAX_ITERATIONS; iterations++) {
    if (our_sequence != sequence) {
      return;
    }
    let limiter = new Promise(r => setTimeout(r, 100));
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (finishedArray[y * width + x] == 0) {
          let x_value = x_min + (x_max - x_min) * x / width;
          let y_value = y_min + (y_max - y_min) * (height - y) / height;

          iterationCountArray[y * width + x] += 1;
          let x2 = complexArrays[3 * (y * width + x)];
          let y2 = complexArrays[3 * (y * width + x) + 1];
          let w = complexArrays[3 * (y * width + x) + 2];

          if (x2 + y2 > 4.0 || iterations == MAX_ITERATIONS - 1) {
            finishedArray[y * width + x] = 1;
            maxIterationCount = iterationCountArray[y * width + x];
            if (x2 + y2 <= 4.0) {
              // Make sure it's blank
              let index = 4 * (y * width + x);
              imageArray[index + 3] = 0;
            }
          }


          let x_new = x2 - y2 + x_value;
          let y_new = w - x2 - y2 + y_value;

          complexArrays[3 * (y * width + x)] = x_new * x_new;
          complexArrays[3 * (y * width + x) + 1] = y_new * y_new;
          complexArrays[3 * (y * width + x) + 2] = (x_new + y_new) * (x_new + y_new);
        } else {
          let index = 4 * (y * width + x);
          imageArray[index + 3] = 255 * (iterations + 1 - iterationCountArray[y * width + x]) / (iterations + 1);
        }
      }
    }
    ctx.putImageData(new ImageData(imageArray, width, height), 0, 0);
    await limiter;
  }
}

window.addEventListener('DOMContentLoaded', function() {
  paintMandelbrot();
});

window.addEventListener('wheel', function(event) {
  // Determine scroll point epicenter
  let scrollX = window.scrollX + event.clientX;
  let epicenterX = x_min + (x_max - x_min) * scrollX / width;
  let scrollY = window.scrollY + event.clientY;
  let epicenterY = y_max - (y_max - y_min) * scrollY / height;
  if (event.deltaY < 0) {
    // Zoom in
    const zoomFactor = 8;
    let new_x_min = epicenterX - 0.5 / zoomFactor * (x_max - x_min);
    let new_x_max = epicenterX + 0.5 / zoomFactor * (x_max - x_min);
    if (new_x_min < X_MIN_MIN) {
      new_x_min = X_MIN_MIN;
      new_x_max = X_MIN_MIN + (x_max - x_min) / zoomFactor;
    } else if (new_x_max > X_MAX_MAX) {
      new_x_max = X_MAX_MAX;
      new_x_min = X_MAX_MAX - (x_max - x_min) / zoomFactor;
    }

    let new_y_min = epicenterY - 0.5 / zoomFactor * (y_max - y_min);
    let new_y_max = epicenterY + 0.5 / zoomFactor * (y_max - y_min);
    if (new_y_min < Y_MIN_MIN) {
      new_y_min = Y_MIN_MIN;
      new_y_max = Y_MIN_MIN + (y_max - y_min) / zoomFactor;
    } else if (new_y_max > Y_MAX_MAX) {
      new_y_max = Y_MAX_MAX;
      new_y_min = Y_MAX_MAX - (y_max - y_min) / zoomFactor;
    }

    // Rather than entirely clearing the image, and since it takes increasingly long times to update the drawing as we zoom in,
    // Provide an initial zoomed sample of the previous image of this region

    // Get the starting index of our copied region

    const regionXOffset = Math.floor((new_x_min - x_min) / (x_max - x_min) * width);
    const regionYOffset = Math.floor((y_max - new_y_max) / (y_max - y_min) * height);
    let sourceIndex = regionYOffset * width + regionXOffset;
    let bufferIndex = 0;
    isBuffering = true;
    for (let sourceY = 0; sourceY < Math.floor(height / zoomFactor); sourceY++) {
      for (let sourceX = 0; sourceX < Math.floor(width / zoomFactor); sourceX++) {
        for (let horizontalRepeat = 0; horizontalRepeat < zoomFactor; horizontalRepeat++) {
          for (let verticalRepeat = 0; verticalRepeat < zoomFactor; verticalRepeat++) {
            bufferedImageArray[4 * (bufferIndex + verticalRepeat * width) + 3] = imageArray[4 * sourceIndex + 3];
          }
          bufferIndex++;
        }
        sourceIndex++;
      }
      bufferIndex += (zoomFactor - 1) * width;
      sourceIndex += width - Math.floor(width / zoomFactor);
    }

    for (let i = 3; i < 4 * width * height; i += 4) {
      imageArray[i] = bufferedImageArray[i];
    }

    x_min = new_x_min;
    x_max = new_x_max;
    y_min = new_y_min;
    y_max = new_y_max;
  } else {
    // Zoom out
    isBuffering = false;
    for (let i = 3; i < 4 * width * height; i += 4) {
      imageArray[i] = 0;
    }

    // Reset zoom level entirely
    x_min = X_MIN_MIN;
    x_max = X_MAX_MAX;
    y_min = Y_MIN_MIN;
    y_max = Y_MAX_MAX;
  }
  iterations = 0;
  complexArrays.fill(0.0);
  iterationCountArray.fill(0);
  finishedArray.fill(0);
  sequence += 1;
  paintMandelbrot();
});
