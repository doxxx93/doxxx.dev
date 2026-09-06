/**
 * Copyright coppieee ( http://wonderfl.net/user/coppieee )
 * MIT License ( http://www.opensource.org/licenses/mit-license.php )
 * Original AS3: http://wonderfl.net/c/tNGi
 * HTML5 port:   https://github.com/15x15G/PixelBreakOut
 */
"use strict";
var canvas = document.getElementById("myCanvas");
var ctx = canvas.getContext("2d", { willReadFrequently: true, imageSmoothingEnabled: false });
class Blocks {
    get count() {
        return this._count;
    }
    get width() {
        return this._width;
    }
    get height() {
        return this._height;
    }
    constructor(width, height) {
        this._width = width;
        this._height = height;
        this._count = width * height;
        //this.values = new Vector.<Particle>(width * height, false);
        this.values = new Array(width * height);
        let c = new ColorHSV();
        for (let i = 0; i < this._width; i++) {
            c.h = (360 * i) / this._width;
            for (let j = 0; j < this._height; j++) {
                let p = new Particle(i, j);
                p.color = c.hsvToRgb();
                this.values[i + j * this._width] = p;
            }
        }
    }
    getParticle(x, y) {
        x = Math.floor(x);
        y = Math.floor(y);
        var index = x + y * this._width;
        if (index >= this.values.length || index < 0) {
            return undefined;
        }
        return this.values[x + y * this._width];
    }
    removeParticle(x, y) {
        x = Math.floor(x);
        y = Math.floor(y);
        var p = this.values[x + y * this._width];
        if (p) {
            this._count--;
            this.values[x + y * this._width] = undefined;
        }
        return p;
    }
}
class Particle {
    constructor(x = 0, y = 0) {
        this.vx = 0;
        this.vy = 0;
        this.color = new ColorRGBA(); //number 32bit
        this.x = x;
        this.y = y;
    }
}
class ColorHSV {
    constructor() {
        this.h = 0;
        this.s = 1;
        this.v = 1;
    }
    hsvToRgb() {
        const hPrime = this.h / 60;
        const x = this.v * (1 - Math.abs((hPrime % 2) - 1));
        const y = this.v * (1 - Math.abs(Math.abs(hPrime % 2) - 1));
        const z = this.v * (1 - this.s);
        let r = 0;
        let g = 0;
        let b = 0;
        if (hPrime < 1) {
            r = this.v;
            g = x;
            b = z;
        }
        else if (hPrime < 2) {
            r = y;
            g = this.v;
            b = z;
        }
        else if (hPrime < 3) {
            r = z;
            g = this.v;
            b = x;
        }
        else if (hPrime < 4) {
            r = z;
            g = y;
            b = this.v;
        }
        else if (hPrime < 5) {
            r = x;
            g = z;
            b = this.v;
        }
        else {
            r = this.v;
            g = z;
            b = y;
        }
        return new ColorRGBA(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255), 225);
    }
    hsv2rgb() {
        return [this.f(5), this.f(3), this.f(1)];
    }
    f(n, k = (n + this.h / 60) % 6) {
        return this.v - this.v * this.s * Math.max(Math.min(k, 4 - k, 1), 0);
    }
}
class ColorRGBA {
    constructor(r = 255, g = 255, b = 255, a = 255) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
    }
}
class Rect {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = new ColorRGBA(0, 255, 0, 255);
    }
    hitTestPoint(x, y) {
        if (this.x < x && x < this.x + this.width && this.y < y && y < this.y + this.height) {
            return true;
        }
        else {
            return false;
        }
    }
}
// 块
var blocks = new Blocks(canvas.width, 100);
// 掉落
var fallBlocks = [];
// 板
var bar = new Rect(0, canvas.height - 50, 50, 10);
// 球
var balls = [];
var _ball = new Particle(canvas.width / 2, canvas.height / 2);
_ball.vx = Math.random() * 10;
_ball.vy = -Math.random() * 9 - 1;
_ball.color = new ColorRGBA();
balls.push(_ball);
document.addEventListener("mousemove", mouseMoveHandler, false);
document.addEventListener("touchmove", touchMoveHandler, { passive: false });
document.addEventListener("touchstart", touchMoveHandler, { passive: false });
var newx = 0;
function mouseMoveHandler(e) {
    const rect = canvas.getBoundingClientRect();
    let relativeX = ((e.clientX - rect.left) / rect.width) * canvas.width;
    if (relativeX > 0 && relativeX < canvas.width) {
        newx = clamp(Math.floor(relativeX - bar.width / 2), 0, canvas.width - bar.width);
    }
}
function touchMoveHandler(evt) {
    evt.preventDefault();
    const touch = evt.touches[0];
    const x = touch.clientX;
    //const y = touch.clientY
    //console.log(`Touch moved to (${x}, ${y})`)
    const rect = canvas.getBoundingClientRect();
    let relativeX = ((x - rect.left) / rect.width) * canvas.width;
    if (relativeX > 0 && relativeX < canvas.width) {
        newx = clamp(Math.floor(relativeX - bar.width / 2), 0, canvas.width - bar.width);
    }
}
function setPixel(array, x, y, c) {
    x = clamp(Math.floor(x), 0, canvas.width);
    y = clamp(Math.floor(y), 0, canvas.width);
    let index = (y * canvas.width + x) * 4;
    array[index] = c.r; // red
    array[index + 1] = c.g; // green
    array[index + 2] = c.b; // blue
    array[index + 3] = c.a; // alpha
}
function ColorTransform(array, x, y, mr, mg, mb) {
    x = Math.floor(x);
    y = Math.floor(y);
    let index = (y * canvas.width + x) * 4;
    array[index] = clamp(Math.floor(array[index] * mr), 0, 255); // red
    array[index + 1] = clamp(Math.floor(array[index + 1] * mg), 0, 255); // green
    array[index + 2] = clamp(Math.floor(array[index + 2] * mb), 0, 255); // blue
    //array[index + 3] = c.a // alpha
}
function clamp(number, min, max) {
    return Math.max(min, Math.min(number, max));
}
function draw() {
    //ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.clearRect(bar.x, bar.y, bar.width, bar.height);
    bar.x = newx;
    // ctx.save()
    // ctx.globalAlpha = 0.1
    // ctx.globalCompositeOperation = "destination-out"
    // ctx.fillStyle = "#FFF"
    // ctx.fillRect(0, 0, canvas.width, canvas.height)
    // ctx.restore()
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let pixels = imageData.data;
    for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
            ColorTransform(pixels, x, y, 0.9, 0.5, 0.9);
        }
    }
    // 画块
    blocks.values.forEach((block) => {
        if (block) {
            setPixel(pixels, block.x, block.y, block.color);
        }
    });
    let removeBalls = [];
    // 球判定
    balls.forEach((ball) => {
        let bvx = ball.vx;
        let bvy = ball.vy;
        let bspeed = Math.sqrt(bvx * bvx + bvy * bvy);
        let bradius = Math.atan2(bvy, bvx);
        for (let i = 0; i < bspeed; i++) {
            ball.x += ball.vx / bspeed;
            ball.y += ball.vy / bspeed;
            // 命中
            let hitParticle = blocks.getParticle(ball.x, ball.y);
            if (hitParticle) {
                let removedP = blocks.removeParticle(ball.x, ball.y);
                if (removedP) {
                    removedP.vx = Math.cos(bradius + (Math.PI * 2) / (30 * Math.random()) - 15) * 3;
                    removedP.vy = 1;
                    removedP.color = hitParticle.color;
                    fallBlocks.push(removedP);
                    ball.vy = -ball.vy;
                }
            }
            // 撞左右壁
            if ((ball.x < 0 && ball.vx < 0) || (ball.x > canvas.width && ball.vx > 0)) {
                ball.vx = -ball.vx;
            }
            // 撞上壁
            if (ball.y < 0 && ball.vy < 0) {
                ball.vy = -ball.vy;
            }
            // 撞下壁(消失)
            if (ball.y > canvas.height) {
                removeBalls.push(ball);
            }
            // 撞板
            if (bar.hitTestPoint(ball.x, ball.y)) {
                ball.vy = -Math.abs(ball.vy);
            }
            setPixel(pixels, ball.x, ball.y, ball.color);
        }
    });
    // 移除出界球
    removeBalls.forEach(function (b) {
        let index = balls.indexOf(b);
        if (index != -1) {
            balls.splice(index, 1);
        }
    });
    //掉落块判定
    let removeFallBs = [];
    fallBlocks.forEach((fallP) => {
        fallP.vy += 0.1;
        fallP.x += fallP.vx;
        fallP.y += fallP.vy;
        setPixel(pixels, fallP.x, fallP.y, fallP.color);
        if (bar.hitTestPoint(fallP.x, fallP.y)) {
            var newball = new Particle(fallP.x, fallP.y);
            newball.vx = Math.random() * 10;
            newball.vy = Math.random() * 9 + 1;
            newball.color = fallP.color;
            balls.push(newball);
            removeFallBs.push(fallP);
        }
        else if (fallP.y > canvas.height) {
            removeFallBs.push(fallP);
        }
    });
    //移除掉落块
    removeFallBs.forEach((b) => {
        var index = fallBlocks.indexOf(b);
        if (index != -1) {
            fallBlocks.splice(index, 1);
        }
    });
    // 画板
    for (let y = bar.y; y < bar.y + bar.height; y++) {
        for (let x = bar.x; x < bar.x + bar.width; x++) {
            setPixel(pixels, x, y, bar.color);
        }
    }
    ctx.putImageData(imageData, 0, 0);
}
var balllabel = document.getElementById("balllabel");
var blocklabel = document.getElementById("blocklabel");
var fpslabel = document.getElementById("fpslabel");
startAnimating(30, 500);
// Animation state/parameters
var fpsInterval, lastDrawTime, frameCount, lastSampleTime;
var intervalID, requestID;
function startAnimating(fps, sampleFreq) {
    fpsInterval = 1000 / fps;
    lastDrawTime = performance.now();
    lastSampleTime = lastDrawTime;
    frameCount = 0;
    animate(0);
    intervalID = setInterval(sampleFps, sampleFreq);
}
function sampleFps() {
    // sample FPS
    let now = performance.now();
    if (frameCount > 0) {
        let currentFps = ((frameCount / (now - lastSampleTime)) * 1000).toFixed(1);
        let ballc = balls.length;
        let blockc = blocks.count;
        balllabel.innerHTML = `balls:${ballc}`;
        blocklabel.innerHTML = `blocks:${blockc}`;
        fpslabel.innerHTML = `${currentFps} fps`;
        frameCount = 0;
    }
    lastSampleTime = now;
}
function animate(now) {
    // request another frame
    requestID = requestAnimationFrame(animate);
    // calc elapsed time since last loop
    let elapsed = now - lastDrawTime;
    // if enough time has elapsed, draw the next frame
    if (elapsed > fpsInterval) {
        // Get ready for next frame by setting lastDrawTime=now, but...
        // Also, adjust for fpsInterval not being multiple of 16.67
        lastDrawTime = now - (elapsed % fpsInterval);
        // draw
        draw();
        frameCount++;
    }
}
