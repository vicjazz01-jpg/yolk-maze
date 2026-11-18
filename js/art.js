"use strict";

const mazeArt = (() => {
  const tile = 24;
  const ink = "#482c25";

  function oval(ctx, x, y, rx, ry, fill, stroke, tilt = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, tilt, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  function line(ctx, color, width, points) {
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (const point of points.slice(1)) ctx.lineTo(...point);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function glint(ctx, x, y, size, color) {
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.quadraticCurveTo(x + 1, y - 1, x + size, y);
    ctx.quadraticCurveTo(x + 1, y + 1, x, y + size);
    ctx.quadraticCurveTo(x - 1, y + 1, x - size, y);
    ctx.quadraticCurveTo(x - 1, y - 1, x, y - size);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function wallOutline(ctx, x, y, side, corners, inset) {
    const left = x + (side[0] ? inset : 0);
    const top = y + (side[1] ? inset : 0);
    const right = x + tile - (side[2] ? inset : 0);
    const bottom = y + tile - (side[3] ? inset : 0);
    const [tl, tr, br, bl] = corners;
    ctx.moveTo(left + tl, top);
    ctx.lineTo(right - tr, top);
    ctx.quadraticCurveTo(right, top, right, top + tr);
    ctx.lineTo(right, bottom - br);
    ctx.quadraticCurveTo(right, bottom, right - br, bottom);
    ctx.lineTo(left + bl, bottom);
    ctx.quadraticCurveTo(left, bottom, left, bottom - bl);
    ctx.lineTo(left, top + tl);
    ctx.quadraticCurveTo(left, top, left + tl, top);
    ctx.closePath();
  }

  // 牆、地面與草窩只在畫布尺寸改變時繪製。
  function board(ctx, map, tunnelRow, nestX) {
    const width = map[0].length * tile;
    const height = map.length * tile;
    ctx.lineCap = "round";
    const crust = ctx.createLinearGradient(0, 0, 0, height);
    crust.addColorStop(0, "#fae6b7");
    crust.addColorStop(.56, "#f4d9a2");
    crust.addColorStop(1, "#f1d298");
    ctx.fillStyle = crust;
    ctx.fillRect(0, 0, width, height);

    const isWall = (x, y) => map[y]?.[x] === "#";
    const walls = [];
    for (let row = 0; row < map.length; row++) {
      for (let col = 0; col < map[row].length; col++) {
        const x = col * tile;
        const y = row * tile;
        if (!isWall(col, row)) {
          if ((row * 3 + col * 7) % 5 === 0) {
            oval(ctx, x + 4, y + 6, 1.15, .65, "#bc87452c", null, -.6);
            oval(ctx, x + 18, y + 17, .9, .6, "#fff6da87");
          }
          continue;
        }
        const sides = [
          col > 0 && !isWall(col - 1, row),
          row > 0 && !isWall(col, row - 1),
          col < map[row].length - 1 && !isWall(col + 1, row),
          row < map.length - 1 && !isWall(col, row + 1)
        ];
        const corners = sides.map((open, i) => open && sides[(i + 1) % 4] ? 5 : 0);
        walls.push({ x, y, sides, corners });
      }
    }

    for (const [inset, fill] of [[1, "#905737"], [3, "#b77d55"]]) {
      ctx.beginPath();
      for (const { x, y, sides, corners } of walls) wallOutline(ctx, x, y, sides, corners, inset);
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.beginPath();
    for (const { x, y, sides } of walls) {
      const [left, top, right, bottom] = sides;
      if (top) {
        ctx.moveTo(x + (left ? 7 : 0), y + 5);
        ctx.lineTo(x + tile - (right ? 7 : 0), y + 5);
      }
      if (bottom) {
        ctx.moveTo(x + (left ? 7 : 0), y + tile - 3);
        ctx.lineTo(x + tile - (right ? 7 : 0), y + tile - 3);
      }
    }
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = "#e0a87a97";
    ctx.stroke();

    for (const { x, y, sides } of walls) {
      if ((x / tile * 5 + y / tile) % 3 === 0 && sides.some(Boolean)) {
        line(ctx, "#8d583e50", 1.1, [[x + 9, y + 13], [x + 15, y + 12]]);
      }
    }

    const tunnelY = (tunnelRow + .5) * tile;
    for (const [edge, sign] of [[0, 1], [width, -1]]) {
      ctx.save();
      ctx.translate(edge, tunnelY);
      ctx.scale(sign, 1);
      for (let i = 0; i < 2; i++) {
        const x = 8 + i * 7;
        line(ctx, "#99653c", 1.7, [[x + 2, -3], [x - 1, 0], [x + 2, 3]]);
      }
      ctx.restore();
    }

    ctx.save();
    ctx.translate((nestX + .5) * tile, 11.5 * tile);
    oval(ctx, 0, 2, 42, 32, "#9c613f");
    oval(ctx, 0, -1, 40, 30, "#c89054");
    oval(ctx, 0, -2, 33, 24, "#e1b671");
    oval(ctx, 0, -1, 26, 19, "#f2cd86");
    for (let i = 0; i < 22; i++) {
      const angle = i * Math.PI / 11;
      const x = Math.cos(angle);
      const y = Math.sin(angle);
      const straw = i % 3 === 0 ? "#f6d693" : "#a97042";
      line(ctx, straw, 1.6, [[x * 38, y * 28], [x * 32 - y * 4, y * 25 + x * 4], [x * 27 - y * 6, y * 21 + x * 6]]);
    }
    ctx.restore();
  }

  function sesame(ctx, x, y, index) {
    const tilt = index % 3 === 0 ? .52 : -.56;
    oval(ctx, x, y + .6, 2.65, 1.5, "#ae753d", null, tilt);
    oval(ctx, x - .4, y, 2.32, 1.16, "#fff5d3", null, tilt);
  }

  function orb(ctx, x, y, time) {
    const pulse = Math.sin(time * 4.2) * .8;
    oval(ctx, x, y, 8.1 + pulse, 8.1 + pulse, "#ffe484b0");
    oval(ctx, x, y, 5.45, 5.45, "#fbb63a", "#bd7426");
    oval(ctx, x - .65, y - .8, 4, 4, "#ffd05a");
    glint(ctx, x - 1.25, y - 1.5, 2.75, "#fff8da");
  }

  function chick(ctx, direction, time, walking, powered) {
    ctx.lineWidth = 1;
    oval(ctx, 0, 9.2, 8.6, 2.45, "#9b632c45");
    if (powered) {
      const pulse = Math.sin(time * 13);
      oval(ctx, 0, -1, 11.5 + pulse * .65, 11.1 + pulse * .65, "#fff198a8");
      glint(ctx, 8.5, -8.5, 2.5, "#fff5bc");
    }

    const step = walking ? Math.sin(time * 29) * 1.25 : 0;
    oval(ctx, -3.9, 7.7 + step, 2.4, 1.45, "#d77729");
    oval(ctx, 3.9, 7.7 - step, 2.4, 1.45, "#d77729");
    ctx.translate(0, walking ? -.5 - Math.abs(step) * .46 : Math.sin(time * 4) * .35);

    oval(ctx, -7.5, 2, 2.8, 3.25, "#ffcb42", "#ab6c2b", .4);
    oval(ctx, 7.5, 2, 2.8, 3.25, "#ffcb42", "#ab6c2b", -.4);
    oval(ctx, 0, -.8, 9.2, 9, "#ffbd32", "#a86a2b");
    oval(ctx, -.15, -1.55, 8.45, 8, "#ffd255");
    oval(ctx, -3.75, -6.1, 2.4, 1.15, "#fff0a9", null, -.42);
    const face = direction === 1 ? -1.45 : direction === 3 ? 1.45 : 0;
    const lookUp = direction === 0 ? -.9 : 0;
    if (time % 4.4 > 4.29) {
      oval(ctx, face - 3, -1.2 + lookUp, 1.15, .48, ink);
      oval(ctx, face + 3, -1.2 + lookUp, 1.15, .48, ink);
    } else {
      oval(ctx, face - 3, -1.7 + lookUp, 1.2, 1.35, ink);
      oval(ctx, face + 3, -1.7 + lookUp, 1.2, 1.35, ink);
    }

    oval(ctx, face - 5, 1.5 + lookUp, 1.35, .85, "#ee902f95");
    oval(ctx, face + 5, 1.5 + lookUp, 1.35, .85, "#ee902f95");
    ctx.beginPath();
    ctx.moveTo(face - 2.05, .6 + lookUp);
    ctx.quadraticCurveTo(face, -.1 + lookUp, face + 2.05, .6 + lookUp);
    ctx.quadraticCurveTo(face + 2, 1.5 + lookUp, face, 2.8 + lookUp);
    ctx.quadraticCurveTo(face - 2, 1.5 + lookUp, face - 2.05, .6 + lookUp);
    ctx.fillStyle = "#d7772c";
    ctx.fill();
  }

  function berry(ctx, blue) {
    const body = blue ? "#786cba" : "#ae4876";
    const shade = blue ? "#524985" : "#74324c";
    oval(ctx, -4.65, 5, 2.7, 3.1, body, shade);
    oval(ctx, 4.9, 4.6, 2.7, 3.4, body, shade);
    oval(ctx, 0, 0, 8.95, 7.8, body, shade, -.09);
    oval(ctx, -4.05, -4.3, 2.5, 1.25, blue ? "#c2b5ed" : "#f08fb0", null, -.56);
    oval(ctx, -.8, -6, .72, .65, blue ? "#c2b5ed" : "#f08fb0");
  }

  function beetle(ctx, blue) {
    const body = blue ? "#8391cd" : "#85a650";
    const shade = blue ? "#514f87" : "#496538";
    line(ctx, shade, 1.25, [[-3.2, -4.6], [-5.9, -8.65], [-7.1, -9]]);
    line(ctx, shade, 1.25, [[3.2, -4.6], [5.9, -8.65], [7.1, -9]]);
    for (const side of [-1, 1]) {
      for (let leg = 1; leg < 7; leg += 2) {
        line(ctx, shade, 1.35, [[side * 5, leg - 1], [side * 8.6, leg + 1]]);
      }
    }
    oval(ctx, 0, 1.5, 7.9, 7.2, body, shade);
    line(ctx, shade, 1, [[0, 2.3], [0, 8.2]]);
    oval(ctx, -4.3, 4.5, 1.4, 1.8, blue ? "#b8bcee" : "#bfd680", null, .3);
    oval(ctx, 4.3, 4.5, 1.4, 1.8, blue ? "#b8bcee" : "#bfd680", null, -.3);
    oval(ctx, 0, -2.5, 5.65, 4.7, blue ? "#a8a6de" : "#adc77b", shade);
  }

  function taro(ctx, blue) {
    const body = blue ? "#747abe" : "#a37bb9";
    const shade = blue ? "#4e5084" : "#624571";
    oval(ctx, -7.6, 3.1, 2.7, 2.8, body, shade, .45);
    oval(ctx, 7.6, 3.1, 2.7, 2.8, body, shade, -.45);
    oval(ctx, -3.9, 6.2, 3, 1.9, shade);
    oval(ctx, 3.9, 6.2, 3, 1.9, shade);
    oval(ctx, 0, -.05, 8.4, 7.8, body, shade);
    oval(ctx, -.75, -6.4, 3.1, 1.3, blue ? "#aeb9ed" : "#d8b0e4", null, -.16);
    oval(ctx, 0, 5.5, 3.4, 1.15, blue ? "#aeb9ed" : "#c79dd6");
  }

  function milk(ctx, blue) {
    const shade = blue ? "#51588b" : "#a7796b";
    const body = blue ? "#a3b3e5" : "#fff7e7";
    ctx.beginPath();
    ctx.moveTo(-7.9, 4.8);
    ctx.bezierCurveTo(-11.2, 3, -9.1, -3.9, -5.4, -4.5);
    ctx.bezierCurveTo(-4.8, -8.2, 2.6, -9.8, 4.6, -5.6);
    ctx.bezierCurveTo(8.6, -6.4, 11, -1.1, 8.5, 4.6);
    ctx.bezierCurveTo(6.4, 8.6, -5.2, 8.2, -7.9, 4.8);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.strokeStyle = shade;
    ctx.stroke();
    oval(ctx, -5.45, 2.3, 1.6, 1.1, blue ? "#d6dafa" : "#e6a1a8");
    oval(ctx, 5.45, 2.3, 1.6, 1.1, blue ? "#d6dafa" : "#e6a1a8");
  }

  const creatures = [berry, beetle, taro, milk];

  function chaser(ctx, type, direction, time, frightened, returning) {
    ctx.lineWidth = 1.05;
    ctx.lineJoin = "round";
    const look = direction === 1 ? -.55 : direction === 3 ? .55 : 0;
    if (returning) {
      glint(ctx, -6, 3, 2.7, "#fff8d6");
      glint(ctx, 6, -4, 3.2, "#b77c4a");
      for (const x of [-2.65, 2.65]) {
        oval(ctx, x, -1, 2.1, 2.85, "#fffbeb", "#946650");
        oval(ctx, x + look, -.8, .8, 1.15, "#524978");
      }
      return;
    }
    oval(ctx, 0, 8, 7.85, 2.15, "#89532e42");
    ctx.translate(0, Math.sin(time * 12 + type) * .65);
    creatures[type](ctx, frightened);
    if (frightened) {
      for (const x of [-2.6, 2.6]) {
        oval(ctx, x, -.8, 1.05, 1.28, "#fff9ec");
        line(ctx, "#fff9ec", .75, [[x - .7, -2.9], [x + .5, -3.3]]);
      }
      line(ctx, "#423d6d", .85, [[-1.9, 3], [-.9, 2.25], [0, 3], [.9, 2.25], [1.9, 3]]);
    } else {
      const y = type === 1 ? -2.1 : -.95;
      const face = type === 0 ? "#fff2df" : ink;
      oval(ctx, -2.7 + look, y, 1.18, 1.35, face);
      oval(ctx, 2.7 + look, y, 1.18, 1.35, face);
      oval(ctx, look, y + 3, .95, .52, face);
    }
  }

  return { tile, board, sesame, orb, chick, chaser };
})();
