"use strict";

(() => {
  // # 是牆，. 是芝麻，o 是能量球，n 是追兵專用的草窩，
  // _ 是左右相通的隧道口，@ 是小蛋黃的出生點。
  const map = [
    "###################",
    "#o...............o#",
    "#.###.###.###.###.#",
    "#...#.....#.....#.#",
    "#.#.###.###.###.#.#",
    "#.#.....#...#...#.#",
    "#.###.###.###.###.#",
    "#...#.##...##.#...#",
    "###.#.##...##.#.###",
    "#...#.###n###.#...#",
    "#.###.##nnn##.###.#",
    "_.....##nnn##....._",
    "#.###.##nnn##.###.#",
    "#...#..#####..#...#",
    "#...#.........#...#",
    "#.###.###.###.###.#",
    "#.#.....#...#...#.#",
    "#.#.###.#.#.###.#.#",
    "#.....#..@....#...#",
    "#.###.###.###.###.#",
    "#o..#...#...#.#..o#",
    "#.....#...#.......#",
    "###################"
  ];

  const cols = map[0].length;
  const rows = map.length;
  const tunnel = map.findIndex(row => row.startsWith("_"));
  const pixels = mazeArt.tile;
  const width = cols * pixels;
  const height = rows * pixels;
  const north = 0, west = 1, south = 2, east = 3, none = -1;
  const directions = [north, west, south, east];
  const dx = [0, -1, 0, 1];
  const dy = [-1, 0, 1, 0];
  const reverse = dir => (dir + 2) % 4;
  const id = (x, y) => y * cols + x;
  const xOf = tile => tile % cols;
  const yOf = tile => Math.floor(tile / cols);
  const centerX = tile => (xOf(tile) + .5) * pixels;
  const centerY = tile => (yOf(tile) + .5) * pixels;
  const wrapX = x => (x + cols) % cols;
  const cells = map.join("");
  const spawn = cells.indexOf("@");
  const exit = id(9, 8);
  const seedTiles = [...cells.matchAll(/\./g)].map(match => match.index);
  const energyTiles = [...cells.matchAll(/o/g)].map(match => match.index);
  const total = seedTiles.length + energyTiles.length;

  const enemies = [
    { name: "莓醬", home: id(8, 10), corner: id(1, 1), speed: 4.65, delay: .8 },
    { name: "抹茶", home: id(10, 10), corner: id(17, 1), speed: 4.47, delay: 2.3 },
    { name: "紫芋", home: id(8, 12), corner: id(1, 20), speed: 4.32, delay: 3.9 },
    { name: "牛奶", home: id(10, 12), corner: id(17, 20), speed: 4.17, delay: 5.4 }
  ];
  const patrol = [id(1, 20), id(17, 20), id(17, 1), id(1, 1)];
  const phases = [7, 18, 6, 20, 5, 23, 4, 24];
  const bestKey = "yolk-maze-best";
  const step = 1 / 120;

  function buildGraph(useNest) {
    const allowed = tile => cells[tile] && cells[tile] !== "#" && (useNest || cells[tile] !== "n");
    const links = Array.from(cells, (_, tile) => directions.map(dir => {
      if (!allowed(tile)) return none;
      const y = yOf(tile) + dy[dir];
      let x = xOf(tile) + dx[dir];
      if (y === tunnel) x = wrapX(x);
      if (x < 0 || x >= cols || y < 0 || y >= rows) return none;
      const neighbor = id(x, y);
      return allowed(neighbor) ? neighbor : none;
    }));
    return { links, distances: new Map() };
  }

  const paths = buildGraph(false);
  const nestPaths = buildGraph(true);

  // 反向廣度優先搜尋。快取每個目標的步數，讓追兵能選路、繞牆、穿隧道。
  function distancesTo(graph, target) {
    if (graph.distances.has(target)) return graph.distances.get(target);
    const distances = new Int16Array(cells.length).fill(-1);
    const queue = [target];
    distances[target] = 0;
    for (let i = 0; i < queue.length; i++) {
      const tile = queue[i];
      for (const neighbor of graph.links[tile]) {
        if (neighbor !== none && distances[neighbor] === -1) {
          distances[neighbor] = distances[tile] + 1;
          queue.push(neighbor);
        }
      }
    }
    graph.distances.set(target, distances);
    return distances;
  }

  const lookup = id => document.getElementById(id);
  const area = lookup("play-area");
  const board = lookup("board");
  const canvas = lookup("maze");
  const scene = canvas.getContext("2d", { alpha: false });
  const backdrop = document.createElement("canvas");
  const backdropContext = backdrop.getContext("2d", { alpha: false });
  const crumbs = document.createElement("canvas");
  const crumbContext = crumbs.getContext("2d");
  const scoreLabel = lookup("score");
  const bestLabel = lookup("best");
  const levelLabel = lookup("level");
  const lifeLabel = lookup("lives");
  const lifeMarks = [...lifeLabel.children];
  const pause = lookup("pause");
  const pauseLabel = pause.querySelector("span");
  const veil = lookup("veil");
  const dialogTitle = lookup("dialog-title");
  const portrait = lookup("dialog-portrait");
  const rules = lookup("rules");
  const copyLabel = lookup("dialog-copy").firstElementChild;
  const copyNumber = lookup("dialog-copy").lastElementChild;
  const primary = lookup("primary");
  const secondary = lookup("secondary");
  const notice = lookup("notice");
  const progress = lookup("progress");
  const progressLabel = lookup("progress-label");
  const progressFill = lookup("progress-fill");
  const progressCount = lookup("progress-count");
  const controls = lookup("controls");

  let score = 0;
  let best = readBest();
  let level = 1;
  let lives = 3;
  let mode = "start";
  let unpausedMode;
  let left = total;
  let seeds;
  let orbs;
  let hero;
  let chasers;
  let requested;
  let clock;
  let visualClock = 0;
  let timer;
  let shieldUntil;
  let powerEnd;
  let powerLength;
  let streak;
  let phase;
  let phaseEnd;
  let noticeText = "";
  let motionStarted;
  let boosts;
  let lastProgress = "";
  let hitBy;
  let lastTime;
  let accumulated = 0;

  function readBest() {
    try {
      const stored = Number(localStorage.getItem(bestKey));
      return Number.isSafeInteger(stored) && stored > 0 ? stored : 0;
    } catch {
      return 0;
    }
  }

  function addScore(points) {
    score += points;
    if (score > best) {
      best = score;
      try {
        localStorage.setItem(bestKey, String(best));
      } catch {
        // 儲存空間不可用時，仍保留本次開啟期間的最高分。
      }
    }
    hud();
  }

  function hud() {
    scoreLabel.textContent = score.toLocaleString("zh-Hant");
    bestLabel.textContent = best.toLocaleString("zh-Hant");
    levelLabel.textContent = String(level).padStart(2, "0");
    lifeLabel.setAttribute("aria-label", `剩下${lives}條命`);
    lifeMarks.forEach((mark, i) => mark.classList.toggle("spent", i >= lives));
  }

  function isPowered() {
    return clock < powerEnd;
  }

  function updateProgress() {
    const power = isPowered();
    const elapsed = power ? powerEnd - clock : 0;
    const value = power ? Math.ceil(elapsed * 10) / 10 : Math.floor((total - left) / total * 100);
    const key = `${power}-${value}`;
    if (key === lastProgress) return;
    lastProgress = key;
    progress.classList.toggle("power", power);
    progressLabel.textContent = power ? "能量時間" : "收集進度";
    progressCount.textContent = power ? `${value.toFixed(1)} 秒` : `${value}%`;
    const ratio = power ? Math.min(1, value / powerLength) : value / 100;
    progressFill.style.transform = `scaleX(${ratio})`;
  }

  function setNotice(message) {
    if (noticeText === message) return;
    noticeText = message;
    notice.hidden = !message;
    notice.textContent = message;
  }

  function showNotice() {
    if (mode === "ready") setNotice(`第 ${level} 關・準備好！`);
    else if (mode === "hit") setNotice(`被${enemies[hitBy].name}碰到了！`);
    else if (mode === "clear") setNotice(`第 ${level} 關完成！`);
    else if (mode === "play" && !motionStarted) setNotice("滑動或按鍵出發");
    else setNotice("");
  }

  function view(focusDialog = true) {
    const modal = mode === "start" || mode === "paused" || mode === "over";
    veil.hidden = !modal;
    controls.inert = modal;
    pause.disabled = mode === "start" || mode === "over";
    pauseLabel.textContent = mode === "paused" ? "繼續" : "暫停";
    pause.setAttribute("aria-expanded", String(mode === "paused"));
    pause.querySelector("path").setAttribute("d", mode === "paused" ? "M9 5l10 7-10 7z" : "M9 6v12m6-12v12");
    if (modal) {
      const starting = mode === "start";
      const ending = mode === "over";
      rules.hidden = !starting;
      portrait.hidden = !starting && !ending;
      dialogTitle.textContent = starting ? "蛋黃大冒險" : ending ? "遊戲結束" : "遊戲暫停";
      copyLabel.textContent = ending ? "本次分數" : "最高分";
      copyNumber.textContent = (ending ? score : best).toLocaleString("zh-Hant");
      primary.textContent = starting ? "開始遊戲" : ending ? "再玩一次" : "繼續遊戲";
      secondary.hidden = starting;
      if (focusDialog) primary.focus({ preventScroll: true });
    }
    showNotice();
  }

  function setMode(next) {
    mode = next;
    view();
  }

  function togglePause() {
    if (mode === "paused") {
      setMode(unpausedMode);
      pause.focus({ preventScroll: true });
    } else if (mode !== "start" && mode !== "over") {
      unpausedMode = mode;
      setMode("paused");
    }
  }

  function newActor(tile) {
    return { tile, next: none, direction: none, fraction: 0, turnBack: false };
  }

  function placeActors(respawn) {
    hero = newActor(spawn);
    chasers = enemies.map((enemy, i) => ({
      ...newActor(enemy.home),
      type: i,
      state: "nest",
      recovering: false,
      release: enemy.delay + (respawn ? .55 : 0)
    }));
    clock = 0;
    requested = none;
    motionStarted = false;
    powerEnd = 0;
    powerLength = 0;
    streak = 0;
    phase = 0;
    phaseEnd = phases[0];
    timer = respawn ? 1.15 : .85;
    shieldUntil = respawn ? 1.35 : .65;
    boosts = [];
  }

  function setupLevel() {
    seeds = new Set(seedTiles);
    orbs = new Set(energyTiles);
    left = total;
    placeActors(false);
    redrawCrumbs();
    hud();
    updateProgress();
  }

  function startGame() {
    level = 1;
    lives = 3;
    score = 0;
    setupLevel();
    setMode("ready");
  }

  function homeScreen() {
    level = 1;
    lives = 3;
    score = 0;
    setupLevel();
    setMode("start");
  }

  function queueDirection(dir) {
    if (mode === "play" || mode === "ready") requested = dir;
  }

  function chooseHero(actor) {
    const moves = paths.links[actor.tile];
    if (requested !== none && moves[requested] !== none) return requested;
    if (actor.direction !== none && moves[actor.direction] !== none) return actor.direction;
    return none;
  }

  function currentTile(actor) {
    return actor.fraction > .5 && actor.next !== none ? actor.next : actor.tile;
  }

  function facingTarget(tile, facing, count) {
    if (facing === none) return tile;
    for (let i = 0; i < count; i++) {
      const next = paths.links[tile][facing];
      if (next === none) break;
      tile = next;
    }
    return tile;
  }

  function chaseTarget(actor, playerTile) {
    const playerFacing = hero.direction;
    switch (actor.type) {
      case 0:
        return playerTile; // 莓醬直追小蛋黃。
      case 1:
        return facingTarget(playerTile, playerFacing, 4); // 抹茶往前堵路。
      case 2: {
        // 紫芋依序巡邏，路程剩六步內時會轉向小蛋黃。
        const near = distancesTo(paths, playerTile)[actor.tile] <= 6;
        const checkpoint = Math.floor(clock / 5.5 + level - 1) % patrol.length;
        return near ? playerTile : patrol[checkpoint];
      }
      default: {
        // 牛奶從後面跟上，離得太近就退回自己的角落。
        const near = distancesTo(paths, playerTile)[actor.tile] <= 7;
        const backward = playerFacing === none ? none : reverse(playerFacing);
        return near ? enemies[actor.type].corner : facingTarget(playerTile, backward, 3);
      }
    }
  }

  function selectStep(actor, graph, target, flee) {
    const moves = graph.links[actor.tile];
    const back = actor.direction === none ? none : reverse(actor.direction);
    const noReverse = actor.state === "roaming";
    if (actor.turnBack) {
      actor.turnBack = false;
      if (back !== none && moves[back] !== none) return back;
    }
    const options = directions.filter(dir => moves[dir] !== none);
    const candidates = noReverse && options.length > 1 ? options.filter(dir => dir !== back) : options;
    const distances = distancesTo(graph, target);
    let winner = none;
    let highest = -Infinity;
    for (const dir of candidates) {
      const distance = distances[moves[dir]];
      if (distance < 0) continue;
      const priority = flee ? distance + Math.random() * 1.65 : -distance;
      if (priority > highest) {
        highest = priority;
        winner = dir;
      }
    }
    return winner;
  }

  function chooseChaser(actor) {
    const enemy = enemies[actor.type];
    if (actor.state === "leaving") return selectStep(actor, nestPaths, exit, false);
    if (actor.state === "returning") return selectStep(actor, nestPaths, enemy.home, false);
    const playerTile = currentTile(hero);
    if (isPowered()) return selectStep(actor, paths, playerTile, true);
    const target = phase % 2 === 0 ? enemy.corner : chaseTarget(actor, playerTile);
    return selectStep(actor, paths, target, false);
  }

  // 模擬使用小於畫面更新間隔的固定步長，演員只在格心選路。
  function advance(actor, distance, graph, choose, arrive) {
    while (distance > 0) {
      if (actor.next === none) {
        const direction = choose(actor);
        if (direction === none) return;
        actor.direction = direction;
        actor.next = graph.links[actor.tile][direction];
      }
      const gap = 1 - actor.fraction;
      if (distance < gap) {
        actor.fraction += distance;
        return;
      }
      distance -= gap;
      actor.tile = actor.next;
      actor.next = none;
      actor.fraction = 0;
      if (!arrive(actor)) return;
    }
  }

  function arrivedHero(actor) {
    if (seeds.delete(actor.tile)) {
      left--;
      crumbContext.clearRect(centerX(actor.tile) - 5, centerY(actor.tile) - 5, 10, 10);
      addScore(10);
    } else if (orbs.delete(actor.tile)) {
      left--;
      powerLength = Math.max(5.2, 8.1 - (level - 1) * .32);
      powerEnd = clock + powerLength;
      streak = 0;
      for (const chaser of chasers) {
        if (chaser.state === "roaming") chaser.turnBack = true;
      }
      addScore(50);
    }
    return left > 0;
  }

  function arrivedChaser(actor) {
    if (actor.state === "returning" && actor.tile === enemies[actor.type].home) {
      actor.state = "nest";
      actor.recovering = true;
      actor.release = clock + .85;
      actor.direction = none;
      return false;
    }
    if (actor.state === "leaving" && actor.tile === exit) {
      actor.state = "roaming";
      return false;
    }
    return true;
  }

  function position(actor) {
    const direction = actor.next === none ? none : actor.direction;
    const x = xOf(actor.tile) + .5 + (dx[direction] ?? 0) * actor.fraction;
    const y = yOf(actor.tile) + .5 + (dy[direction] ?? 0) * actor.fraction;
    return { x: wrapX(x), y };
  }

  function collides(a, b) {
    const wide = Math.abs(a.x - b.x);
    return Math.hypot(Math.min(wide, cols - wide), a.y - b.y) < .61;
  }

  function checkCollisions() {
    const player = position(hero);
    for (const actor of chasers) {
      if (actor.state !== "roaming" || !collides(player, position(actor))) continue;
      if (isPowered()) {
        actor.state = "returning";
        actor.turnBack = false;
        const points = 200 * 2 ** Math.min(streak++, 3);
        boosts.push({ ...position(actor), points, until: clock + .7 });
        addScore(points);
      } else if (clock >= shieldUntil) {
        lives--;
        hitBy = actor.type;
        timer = .85;
        hud();
        setMode("hit");
        return;
      }
    }
  }

  function play(dt) {
    if (!motionStarted) {
      if (chooseHero(hero) === none) return;
      motionStarted = true;
      showNotice();
    }
    clock += dt;
    if (clock >= phaseEnd) {
      phase = (phase + 1) % phases.length;
      phaseEnd += phases[phase];
      if (!isPowered()) {
        for (const actor of chasers) {
          if (actor.state === "roaming") actor.turnBack = true;
        }
      }
    }

    // 按相反方向可以立刻回頭，其餘方向留在緩衝直到下一個合法格心。
    if (hero.next !== none && requested === reverse(hero.direction)) {
      [hero.tile, hero.next] = [hero.next, hero.tile];
      hero.fraction = 1 - hero.fraction;
      hero.direction = requested;
    }
    const pace = Math.min(1.29, 1 + (level - 1) * .043);
    advance(hero, 5.55 * pace * dt, paths, chooseHero, arrivedHero);
    updateProgress();

    if (left === 0) {
      timer = 1.55;
      setMode("clear");
      return;
    }

    for (const actor of chasers) {
      if (actor.state === "nest") {
        // 被反吃的追兵等能量消退後再出窩，避免同一顆能量球重複得分。
        if (clock < actor.release || (actor.recovering && isPowered())) continue;
        actor.recovering = false;
        actor.state = "leaving";
      }
      const enemy = enemies[actor.type];
      const roaming = actor.state === "roaming";
      let speed = enemy.speed * pace;
      if (actor.state === "returning") speed = 8.2;
      else if (actor.state === "leaving") speed = 4.4;
      else if (isPowered()) speed = 3.12 * pace;
      advance(actor, speed * dt, roaming ? paths : nestPaths, chooseChaser, arrivedChaser);
    }
    checkCollisions();
    boosts = boosts.filter(boost => boost.until > clock);
  }

  function update(dt) {
    if (mode === "play") {
      play(dt);
    } else if (mode === "ready" || mode === "hit" || mode === "clear") {
      timer -= dt;
      if (timer > 0) return;
      if (mode === "ready") {
        setMode("play");
      } else if (mode === "clear") {
        level++;
        const nextDirection = requested;
        setupLevel();
        requested = nextDirection;
        setMode("ready");
      } else if (lives === 0) {
        setMode("over");
      } else {
        placeActors(true);
        updateProgress();
        setMode("ready");
      }
    }
  }

  function redrawCrumbs() {
    crumbContext.clearRect(0, 0, width, height);
    for (const tile of seeds) mazeArt.sesame(crumbContext, centerX(tile), centerY(tile), tile);
  }

  function sizeCanvas() {
    const areaWidth = area.clientWidth;
    const areaHeight = area.clientHeight;
    const fit = Math.floor(Math.min(areaWidth, areaHeight * width / height));
    if (fit < 1) return;
    board.style.width = `${fit}px`;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const physicalWidth = Math.max(1, Math.round(fit * dpr));
    const physicalHeight = Math.max(1, Math.round(fit * height / width * dpr));
    if (canvas.width === physicalWidth && canvas.height === physicalHeight && backdrop.width === physicalWidth) return;

    for (const [layer, ctx] of [[canvas, scene], [backdrop, backdropContext], [crumbs, crumbContext]]) {
      layer.width = physicalWidth;
      layer.height = physicalHeight;
      ctx.setTransform(physicalWidth / width, 0, 0, physicalHeight / height, 0, 0);
    }
    mazeArt.board(backdropContext, map, tunnel, xOf(exit));
    redrawCrumbs();
    draw();
  }

  function drawActor(actor, paint) {
    const { x, y } = position(actor);
    const px = x * pixels;
    const py = y * pixels;
    function at(spot) {
      scene.save();
      scene.translate(spot, py);
      paint();
      scene.restore();
    }
    at(px);
    if (px < pixels / 2) at(px + width);
    if (px > width - pixels / 2) at(px - width);
  }

  function draw() {
    scene.drawImage(backdrop, 0, 0, width, height);
    scene.drawImage(crumbs, 0, 0, width, height);
    for (const tile of orbs) mazeArt.orb(scene, centerX(tile), centerY(tile), visualClock);
    for (const actor of chasers) {
      const frightened = isPowered() && actor.state === "roaming";
      const returning = actor.state === "returning";
      drawActor(actor, () => mazeArt.chaser(scene, actor.type, actor.direction, visualClock, frightened, returning));
    }
    drawActor(hero, () => {
      const shield = motionStarted && clock < shieldUntil;
      if ((mode === "hit" || shield) && Math.floor(visualClock * 15) % 2 === 0) scene.globalAlpha = .52;
      mazeArt.chick(scene, hero.direction, visualClock, hero.next !== none, isPowered());
    });
    for (const boost of boosts) {
      const remaining = Math.min(1, boost.until - clock);
      const x = Math.min(width - 20, Math.max(20, boost.x * pixels));
      const y = Math.max(13, boost.y * pixels - 11 - (.7 - remaining) * 19);
      scene.save();
      scene.globalAlpha = Math.min(1, remaining * 4);
      scene.font = "900 14px system-ui, sans-serif";
      scene.textAlign = "center";
      scene.lineWidth = 3;
      scene.strokeStyle = "#fff1ca";
      scene.strokeText(`+${boost.points}`, x, y);
      scene.fillStyle = "#523b7e";
      scene.fillText(`+${boost.points}`, x, y);
      scene.restore();
    }
  }

  function frame(time) {
    const elapsed = lastTime === undefined ? 0 : Math.min(.05, (time - lastTime) / 1000);
    lastTime = time;
    if (mode !== "paused") {
      visualClock += elapsed;
      accumulated += elapsed;
      while (accumulated >= step) {
        accumulated -= step;
        update(step);
      }
    }
    draw();
    requestAnimationFrame(frame);
  }

  function setUpInput() {
    const keyDirections = new Map([
      ["arrowup", north], ["w", north], ["arrowleft", west], ["a", west],
      ["arrowdown", south], ["s", south], ["arrowright", east], ["d", east]
    ]);
    addEventListener("keydown", event => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (keyDirections.has(key)) {
        event.preventDefault();
        queueDirection(keyDirections.get(key));
      } else if ((key === "escape" || key === "p") && !event.repeat) {
        event.preventDefault();
        togglePause();
      } else if (key === "tab" && !veil.hidden && !secondary.hidden) {
        // 將鍵盤焦點留在目前開啟的對話框。
        if (event.shiftKey && document.activeElement === primary) {
          event.preventDefault();
          secondary.focus();
        } else if (!event.shiftKey && document.activeElement === secondary) {
          event.preventDefault();
          primary.focus();
        }
      } else if (key === "tab" && !veil.hidden) {
        event.preventDefault();
        primary.focus();
      }
    });

    for (const button of controls.querySelectorAll("[data-direction]")) {
      const dir = Number(button.dataset.direction);
      button.addEventListener("touchstart", event => {
        event.preventDefault();
        button.classList.add("pressed");
        queueDirection(dir);
      }, { passive: false });
      const release = () => button.classList.remove("pressed");
      button.addEventListener("touchend", release);
      button.addEventListener("touchcancel", release);
      button.addEventListener("pointerdown", event => {
        if (event.pointerType !== "touch" && event.button === 0) queueDirection(dir);
      });
      button.addEventListener("click", () => queueDirection(dir));
    }

    let gesture;
    function begin(x, y, identifier) {
      gesture = { x, y, identifier };
    }
    function swipe(x, y) {
      const horizontal = x - gesture.x;
      const vertical = y - gesture.y;
      if (Math.max(Math.abs(horizontal), Math.abs(vertical)) < 12) return;
      const direction = Math.abs(horizontal) > Math.abs(vertical)
        ? (horizontal > 0 ? east : west)
        : (vertical > 0 ? south : north);
      queueDirection(direction);
      gesture.x = x;
      gesture.y = y;
    }

    canvas.addEventListener("touchstart", event => {
      if (event.touches.length !== 1) {
        gesture = undefined;
        return;
      }
      const touch = event.changedTouches[0];
      begin(touch.clientX, touch.clientY, touch.identifier);
    }, { passive: true });
    canvas.addEventListener("touchmove", event => {
      if (!gesture || event.touches.length !== 1) return;
      const touch = Array.from(event.touches).find(touch => touch.identifier === gesture.identifier);
      if (touch) swipe(touch.clientX, touch.clientY);
    }, { passive: true });
    canvas.addEventListener("touchend", event => {
      if (!gesture) return;
      const touch = Array.from(event.changedTouches).find(touch => touch.identifier === gesture.identifier);
      if (touch) swipe(touch.clientX, touch.clientY);
      gesture = undefined;
    }, { passive: true });
    canvas.addEventListener("touchcancel", () => { gesture = undefined; });
    canvas.addEventListener("pointerdown", event => {
      if (event.pointerType === "touch" || event.button !== 0) return;
      begin(event.clientX, event.clientY, event.pointerId);
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointermove", event => {
      if (event.pointerType !== "touch" && gesture?.identifier === event.pointerId) {
        swipe(event.clientX, event.clientY);
      }
    });
    canvas.addEventListener("lostpointercapture", () => { gesture = undefined; });

    document.addEventListener("touchmove", event => {
      if (event.cancelable) event.preventDefault();
    }, { passive: false });
    document.addEventListener("gesturestart", event => event.preventDefault(), { passive: false });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && (mode === "play" || mode === "ready" || mode === "hit" || mode === "clear")) {
        togglePause();
      }
      lastTime = undefined;
    });
    primary.addEventListener("click", () => {
      if (mode === "paused") togglePause();
      else startGame();
    });
    secondary.addEventListener("click", homeScreen);
    pause.addEventListener("click", togglePause);
  }

  setupLevel();
  sizeCanvas();
  view(false);
  setUpInput();
  new ResizeObserver(sizeCanvas).observe(area);
  addEventListener("resize", sizeCanvas);
  requestAnimationFrame(frame);
})();
