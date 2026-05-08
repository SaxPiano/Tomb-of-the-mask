<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Emoji Dash</title>
<style>
    body {
        margin: 0;
        background: #111;
        color: white;
        font-family: Arial, sans-serif;
        overflow: hidden;
        text-align: center;
    }
    canvas {
        background: linear-gradient(#1a1a1a, #000);
        display: block;
        margin: 0 auto;
    }
    #ui {
        position: fixed;
        top: 10px;
        width: 100%;
        text-align: center;
        z-index: 10;
    }
    button {
        padding: 10px;
        margin: 5px;
        border: none;
        border-radius: 8px;
        cursor: pointer;
    }
    #hint {
        position: fixed;
        left: 10px;
        bottom: 10px;
        font-size: 14px;
        color: #ddd;
    }
</style>
</head>
<body>

<div id="ui">
    <div>
        Skin:
        <button onclick="setSkin('😀')">😀</button>
        <button onclick="setSkin('🤖')">🤖</button>
        <button onclick="setSkin('👻')">👻</button>
        <button onclick="setSkin('🐱')">🐱</button>
    </div>
    <div>Punteggio: <span id="score">0</span></div>
</div>

<canvas id="game"></canvas>
<div id="hint">Premi SPAZIO per saltare — Premere R o toccare dopo Game Over per riavviare</div>

<script>
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let dpr = Math.max(1, window.devicePixelRatio || 1);

function resizeCanvas() {
    dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // keep drawing coordinates in CSS pixels

    // recompute ground y and adjust player/obstacles
    groundHeight = 60;
    groundY = canvas.height / dpr - groundHeight;
    if (player) {
        player.size = Math.max(32, Math.min(64, Math.round((canvas.width / dpr) * 0.03)));
        player.y = Math.min(player.y, groundY - player.size);
        if (player.grounded) player.y = groundY - player.size;
    }
    obstacles.forEach(o => {
        if (o.type === 'ground' || o.type === 'portal') {
            o.y = groundY - o.size;
        } else if (o.type === 'block') {
            // keep relative height but clamp
            o.y = Math.min(o.y, groundY - o.size - 20);
        }
    });
}

window.addEventListener("resize", resizeCanvas);

// game parameters
let groundHeight = 60;
let groundY;
let player = {
    x: 80,
    y: 0,
    size: 40,
    velocityY: 0,
    gravity: 1.2,
    jumpPower: -18,
    grounded: true,
    emoji: "😀",
    mode: "runner", // 'runner' or 'ship'
    prevEmoji: null,
    shipDuration: 5000, // ms
    shipStart: 0,
    thrust: -0.9,
    shipGravity: 0.6
};

let obstacles = []; // each obstacle: {x,y,size,type}
let score = 0;
let gameSpeed = 6;
let gameOver = false;
let spawnIntervalId = null;
let spawningIntervalMs = 1400;
let started = false;

let isHolding = false; // for ship hold-to-fly

function setSkin(e) {
    // allow changing base skin only when not ship, but record selection for later
    if (player.mode === 'runner') player.emoji = e;
    else player.prevEmoji = e;
}

function spawnObstacle() {
    // spawn different types: ground obstacle, block (floating), or portal
    const rand = Math.random();
    const size = Math.max(32, Math.min(64, Math.round((canvas.width / dpr) * 0.035)));
    if (rand < 0.10) {
        // portal
        obstacles.push({
            x: canvas.width / dpr + 20,
            y: groundY - size,
            size,
            type: 'portal'
        });
    } else if (rand < 0.45) {
        // floating block
        const maxElev = Math.max(80, Math.min(300, Math.round((canvas.height / dpr) * 0.4)));
        const minElev = 80;
        const y = groundY - size - (minElev + Math.random() * (maxElev - minElev));
        obstacles.push({
            x: canvas.width / dpr + 20,
            y,
            size,
            type: 'block'
        });
    } else {
        // ground obstacle
        obstacles.push({
            x: canvas.width / dpr + 20,
            y: groundY - size,
            size,
            type: 'ground'
        });
    }
}

function startSpawning() {
    if (spawnIntervalId !== null) clearInterval(spawnIntervalId);
    spawnIntervalId = setInterval(spawnObstacle, spawningIntervalMs);
}

function stopSpawning() {
    if (spawnIntervalId !== null) {
        clearInterval(spawnIntervalId);
        spawnIntervalId = null;
    }
}

function jump() {
    if (!started) {
        started = true;
        startSpawning();
    }
    if (player.grounded && !gameOver && player.mode === 'runner') {
        player.velocityY = player.jumpPower;
        player.grounded = false;
    }
}

window.addEventListener("keydown", e => {
    if (e.code === "Space") {
        e.preventDefault();
        if (player.mode === 'ship') {
            isHolding = true;
        } else {
            jump();
        }
    } else if ((e.code === "KeyR" || e.code === "Enter") && gameOver) {
        restart();
    }
});

window.addEventListener("keyup", e => {
    if (e.code === "Space") {
        if (player.mode === 'ship') isHolding = false;
    }
});

// pointer events cover mouse and touch
window.addEventListener("pointerdown", e => {
    // simple pointer behavior: if game over -> restart, else hold/jump
    e.preventDefault();
    if (gameOver) {
        restart();
        return;
    }
    if (!started) {
        started = true;
        startSpawning();
    }
    if (player.mode === 'ship') {
        isHolding = true;
    } else {
        jump();
    }
}, {passive: false});

window.addEventListener("pointerup", e => {
    if (player.mode === 'ship') isHolding = false;
});

// init sizes and positions
function init() {
    resizeCanvas();
    groundY = canvas.height / dpr - groundHeight;
    player.size = Math.max(32, Math.min(64, Math.round((canvas.width / dpr) * 0.03))); // scale player size a bit by width
    player.x = 80;
    player.y = groundY - player.size;
    player.velocityY = 0;
    player.grounded = true;
    player.mode = "runner";
    player.prevEmoji = null;

    obstacles = [];
    score = 0;
    gameSpeed = 6;
    gameOver = false;
    started = false;
    isHolding = false;
    document.getElementById("score").innerText = score;
    stopSpawning();
}

function enterShipMode() {
    if (player.mode === 'ship') return;
    player.prevEmoji = player.emoji;
    player.emoji = '🚀';
    player.mode = 'ship';
    player.shipStart = Date.now();
    // give a small upward boost so ship doesn't immediately hit something
    player.velocityY = -6;
    player.grounded = false;
}

function exitShipMode() {
    if (player.mode === 'runner') return;
    player.emoji = player.prevEmoji || '😀';
    player.mode = 'runner';
    player.prevEmoji = null;
    isHolding = false;
}

// restart game
function restart() {
    init();
    loop(); // resume loop if it had stopped
}

init();

// GAME LOOP
function update() {
    if (gameOver) return;

    // physics and controls differ for runner vs ship
    if (player.mode === 'ship') {
        // ship mode: reduced gravity, thrust when holding
        if (isHolding) {
            player.velocityY += player.thrust; // thrust is negative
        } else {
            player.velocityY += player.shipGravity;
        }
        // clamp vertical speed
        if (player.velocityY < -18) player.velocityY = -18;
        if (player.velocityY > 18) player.velocityY = 18;
        player.y += player.velocityY;

        // keep ship within screen bounds (allow flying above and below a bit)
        const minY = 20;
        const maxY = groundY - player.size;
        if (player.y < minY) {
            player.y = minY;
            player.velocityY = 0;
        }
        if (player.y > maxY) {
            player.y = maxY;
            player.velocityY = 0;
            player.grounded = true;
        } else {
            player.grounded = false;
        }

        // exit after duration
        if (Date.now() - player.shipStart >= player.shipDuration) {
            exitShipMode();
        }
    } else {
        // runner mode
        player.velocityY += player.gravity;
        player.y += player.velocityY;

        if (player.y >= groundY - player.size) {
            player.y = groundY - player.size;
            player.velocityY = 0;
            player.grounded = true;
        }
    }

    // obstacles - iterate backwards to safely remove
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const o = obstacles[i];
        o.x -= gameSpeed;

        // collision using axis-aligned bounding boxes
        const px = player.x, py = player.y, pw = player.size, ph = player.size;
        const ox = o.x, oy = o.y, ow = o.size, oh = o.size;
        if (px < ox + ow && px + pw > ox && py < oy + oh && py + ph > oy) {
            if (o.type === 'portal') {
                // collect portal
                enterShipMode();
                obstacles.splice(i, 1);
                continue;
            } else {
                // any other obstacle colliding -> game over
                gameOver = true;
                stopSpawning();
                break;
            }
        }

        // passed off left side -> remove and increment score
        if (o.x + o.size < -20) {
            obstacles.splice(i, 1);
            if (!gameOver) {
                score++;
                document.getElementById("score").innerText = score;
            }
        }
    }

    // slowly increase speed
    gameSpeed += 0.001;
}

function draw() {
    // clear (use CSS pixel dimensions since we set ctx transform)
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    // ground
    ctx.fillStyle = "#333";
    ctx.fillRect(0, groundY, canvas.width / dpr, groundHeight);

    // draw player (emoji)
    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = `${player.size}px serif`;
    ctx.fillText(player.emoji, player.x, player.y);
    ctx.restore();

    // obstacles
    obstacles.forEach(o => {
        ctx.save();
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        if (o.type === 'ground') {
            ctx.font = `${o.size}px serif`;
            ctx.fillText("💥", o.x, o.y);
        } else if (o.type === 'portal') {
            // draw a portal emoji slightly larger
            ctx.font = `${Math.round(o.size * 1.1)}px serif`;
            ctx.fillText("🌀", o.x, o.y - 8);
        } else if (o.type === 'block') {
            // draw a brick block
            ctx.font = `${o.size}px serif`;
            ctx.fillText("🧱", o.x, o.y);
        }
        ctx.restore();
    });

    if (!started && !gameOver) {
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.font = "24px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Premi SPAZIO o tocca per iniziare", (canvas.width / dpr) / 2, (canvas.height / dpr) / 2 - 20);
    }

    if (player.mode === 'ship' && !gameOver) {
        ctx.fillStyle = "rgba(180,220,255,0.9)";
        ctx.font = "18px Arial";
        ctx.textAlign = "left";
        ctx.fillText("Ship mode — tieni premuto SPAZIO / tocca per volare", 12, 32);
    }

    if (gameOver) {
        ctx.fillStyle = "white";
        ctx.font = "48px Arial";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", (canvas.width / dpr) / 2, (canvas.height / dpr) / 2 - 40);
        ctx.font = "20px Arial";
        ctx.fillText("Premi R o tocca per riavviare", (canvas.width / dpr) / 2, (canvas.height / dpr) / 2 + 10);
    }
}

let rafId = null;
function loop() {
    update();
    draw();
    if (!gameOver) {
        rafId = requestAnimationFrame(loop);
    } else {
        // keep drawing final state once more and cancel the loop
        if (rafId) cancelAnimationFrame(rafId);
    }
}

loop();
</script>

</body>
</html>
