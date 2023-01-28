"use strict";
const X_MIN_MIN = -2.05;
const X_MAX_MAX = 0.47;
const Y_MIN_MIN = -1.12;
const Y_MAX_MAX = 1.12;
const MAX_ITERATIONS = 400;
const MIN_DELAY_BETWEEN_UPDATES = 50;  // milliseconds
const ZOOM_FACTOR = 8;

const EMPTY_COLOUR = [255, 255, 255];
const FULL_COLOUR = [255, 0, 0];

// Precompute our colour scheme
let colour_slider = new Uint8ClampedArray(3 * 256);
for (let i = 0; i < 256; i++) {
  for (let j = 0; j < 3; j++) {
    colour_slider[3 * i + j] = ((EMPTY_COLOUR[j] * (255 - i)) + (FULL_COLOUR[j] * i)) / 255;
  }
}

function iterate(_event) {
  if (this.iterations >= MAX_ITERATIONS) {
    if (this.iterations == MAX_ITERATIONS) {
      this.iterations++;
    }
    return;
  }
  let iterations = this.iterations;
  let height = this.height;
  let width = this.width;
  let x_min = this.x_min;
  let x_max = this.x_max;
  let y_min = this.y_min;
  let y_max = this.y_max;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (this.finishedArray[y * width + x] == 0) {
        let x_value = x_min + (x_max - x_min) * x / width;
        let y_value = y_min + (y_max - y_min) * (height - y) / height;

        this.iterationCountArray[y * width + x] += 1;
        let x2 = this.complexArrays[3 * (y * width + x)];
        let y2 = this.complexArrays[3 * (y * width + x) + 1];
        let w = this.complexArrays[3 * (y * width + x) + 2];

        if (x2 + y2 > 4.0 || iterations == MAX_ITERATIONS - 1) {
          this.finishedArray[y * width + x] = 1;
          let index = 4 * (y * width + x);
          let colour = Math.floor(255 * (iterations + 1 - this.iterationCountArray[y * width + x]) / (iterations + 1));
          for (let i = 0; i < 3; i++) {
            this.imageArray[index + i] = colour_slider[(colour * 3) + i];
          }
        }

        let x_new = x2 - y2 + x_value;
        let y_new = w - x2 - y2 + y_value;

        this.complexArrays[3 * (y * width + x)] = x_new * x_new;
        this.complexArrays[3 * (y * width + x) + 1] = y_new * y_new;
        this.complexArrays[3 * (y * width + x) + 2] = (x_new + y_new) * (x_new + y_new);
      } else {
        let index = 4 * (y * width + x);
        let colour = Math.floor(255 * (iterations + 1 - this.iterationCountArray[y * width + x]) / (iterations + 1));
        for (let i = 0; i < 3; i++) {
          this.imageArray[index + i] = colour_slider[(colour * 3) + i];
        }
      }
    }
  }
  this.iterations++;
  this.ctx.putImageData(new ImageData(this.imageArray, this.width, this.height), 0, 0);
}


function init(_event) {
  this.canvas = document.getElementById('mandelbrot-canvas');
  this.ctx = this.canvas.getContext('2d');
  this.width = Math.min(window.innerWidth, this.canvas.parentElement.clientWidth);
  this.height = Math.min(window.innerHeight, this.canvas.parentElement.clientHeight);
  this.ctx.canvas.width = this.width;
  this.ctx.canvas.height = this.height;
  this.complexArrays = new Float64Array(3 * this.width * this.height).fill(0.0);
  this.iterationCountArray = new Int16Array(this.width * this.height).fill(0);
  this.finishedArray = new Uint8Array(this.width * this.height).fill(0);
  this.rect = this.canvas.getBoundingClientRect();
  this.iterations = 0;

  this.imageArray = new Uint8ClampedArray(4 * this.width * this.height).fill(0);
  this.bufferedImageArray = new Uint8ClampedArray(4 * this.width * this.height).fill(0);

  for (let index = 0; index < this.width * this.height; index++) {
    for (let i = 0; i < 3; i++) {
      this.imageArray[4 * index + i] = colour_slider[i];
    }
    this.imageArray[4 * index + 3] = 255;
  }
  setInterval(this.iterate.bind(this), MIN_DELAY_BETWEEN_UPDATES);
}

function zoom(event) {
  // Determine scroll point epicenter
  let scrollX = window.scrollX + event.clientX - this.rect.left;
  let scrollY = window.scrollY + event.clientY - this.rect.top;

  if (scrollX < 0 || scrollX > this.width || scrollY < 0 || scrollY > this.height) {
    return;
  }
  let epicenterX = this.x_min + (this.x_max - this.x_min) * scrollX / this.width;
  let epicenterY = this.y_max - (this.y_max - this.y_min) * scrollY / this.height;
  if (event.deltaY < 0) {
    // Zoom in
    const zoomFactor = ZOOM_FACTOR;

    function adjustBounds(epicenter, max, min, factor, limit_max, limit_min) {
      let new_min = epicenter - 0.5 / factor * (max - min);
      let new_max = epicenter + 0.5 / factor * (max - min);
      if (new_min < limit_min) {
        new_min = limit_min;
        new_max = limit_min + (max - min) / factor;
      } else if (new_max > limit_max) {
        new_max = limit_max;
        new_min = limit_max - (max - min) / factor;
      }
      return [new_max, new_min];
    }

    let [new_x_max, new_x_min] = adjustBounds(epicenterX, this.x_max, this.x_min, zoomFactor, X_MAX_MAX, X_MIN_MIN);
    let [new_y_max, new_y_min] = adjustBounds(epicenterY, this.y_max, this.y_min, zoomFactor, Y_MAX_MAX, Y_MIN_MIN);

    // Rather than entirely clearing the image, and since it takes increasingly long times to update the drawing as we zoom in,
    // Provide an initial zoomed sample of the previous image of this region

    // Get the starting index of our copied region

    const regionXOffset = Math.floor((new_x_min - this.x_min) / (this.x_max - this.x_min) * this.width);
    const regionYOffset = Math.floor((this.y_max - new_y_max) / (this.y_max - this.y_min) * this.height);
    let sourceIndex = regionYOffset * this.width + regionXOffset;
    let bufferIndex = 0;
    for (let sourceY = 0; sourceY < Math.floor(this.height / zoomFactor); sourceY++) {
      for (let sourceX = 0; sourceX < Math.floor(this.width / zoomFactor); sourceX++) {
        for (let horizontalRepeat = 0; horizontalRepeat < zoomFactor; horizontalRepeat++) {
          for (let verticalRepeat = 0; verticalRepeat < zoomFactor; verticalRepeat++) {
            for (let i = 0; i < 3; i++) {
              this.bufferedImageArray[4 * (bufferIndex + verticalRepeat * this.width) + i] = this.imageArray[4 * sourceIndex + i];
            }
          }
          bufferIndex++;
        }
        sourceIndex++;
      }
      bufferIndex += (zoomFactor - 1) * this.width;
      sourceIndex += this.width - Math.floor(this.width / zoomFactor);
    }

    for (let i = 0; i < this.width * this.height; i++) {
      for (let j = 0; j < 3; j++) {
        // Don't copy opacity
        this.imageArray[4 * i + j] = this.bufferedImageArray[4 * i + j];
      }
    }

    this.x_min = new_x_min;
    this.x_max = new_x_max;
    this.y_min = new_y_min;
    this.y_max = new_y_max;
  } else {
    // Zoom out TODO
    for (let i = 0; i < this.width * this.height; i++) {
      for (let j = 0; j < 3; j++) {
        this.imageArray[4 * i + j] = EMPTY_COLOUR[j];
      }
    }

    // Reset zoom level entirely
    this.x_min = X_MIN_MIN;
    this.x_max = X_MAX_MAX;
    this.y_min = Y_MIN_MIN;
    this.y_max = Y_MAX_MAX;
  }
  this.iterations = 0;
  this.complexArrays.fill(0.0);
  this.iterationCountArray.fill(0);
  this.finishedArray.fill(0);
}


export let mandelbrot = {
  height: 0,
  width: 0,
  ctx: null,
  iterations: 0,
  canvas: null,
  rect: null,
  x_min: X_MIN_MIN,
  x_max: X_MAX_MAX,
  y_min: Y_MIN_MIN,
  y_max: Y_MAX_MAX,
  finishedArray: [],
  iterationCountArray: [],
  complexArrays: [],
  imageArray: [],
  iterate: iterate,
  init: init,
  zoom: zoom,
  setup: function() {
    window.addEventListener('load', this.init.bind(this));
    window.addEventListener('wheel', this.zoom.bind(this));
  }
}

mandelbrot.setup();
