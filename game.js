const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const screenWidth = canvas.width;
const screenHeight = canvas.height;
const mapWidth = 500;
const mapHeight = 500;

let bombCount = 0;
let isPaused = false;
let canShoot = true;
let bullets = [];
let shotCount = 0;
let lastShotTime = 0;
const maxShots = 5;
const shootDelay = 200;      // ms giữa 2 viên
const reloadDelay = 500;    // ms nghỉ sau khi bắn hết 3 viên
const npcs = [];
const bombs = [];        // Bomb được quăng ra (có thể nổ)
const groundBombs = [];  // Bomb nằm trên đất để nhặt
const explosions = [];
const hearts = []
let canThrowBomb = true;
let heart = 5;
let HeartLose = true;
let canClickPauseButton = true;
const enemyBullets = [];

let player = {
  x: mapWidth / 2,
  y: mapHeight / 2,
  speed: 2,
  size: 64
};

let mouseDown = false; // Đặt ở đầu luôn
window.addEventListener("mousedown", () => mouseDown = true);
window.addEventListener("mouseup", () => mouseDown = false);

let keys = {};
window.addEventListener("keydown", e => keys[e.key] = true);
window.addEventListener("keyup", e => keys[e.key] = false);

const controls = {
  up: ["ArrowUp", "w", "W"],
  down: ["ArrowDown", "s", "S"],
  left: ["ArrowLeft", "a", "A"],
  right: ["ArrowRight", "d", "D"],
  bomb: ["E", "e"]
};
 
const idleImg = new Image();
idleImg.src = "player.png";
const runImg = new Image();
runImg.src = "run.png";
const upImg = new Image();
upImg.src = "up.png";
const downImg = new Image();
downImg.src = "down.png";
const shootImg = new Image();
shootImg.src = "shoot.png";
const npcImg = new Image();
npcImg.src = "npc.png";
const bombImg = new Image();
bombImg.src = "bomb.png";
const heartImg = new Image();
heartImg.src = "heart.png";
const npc2Img = new Image();
npc2Img.src = "npc2.png";

let currentImg = idleImg;
let facingLeft = true;
let imagesLoaded = 0;

idleImg.onload = checkAllLoaded;
runImg.onload = checkAllLoaded;
upImg.onload = checkAllLoaded;
downImg.onload = checkAllLoaded;
shootImg.onload = checkAllLoaded;
npcImg.onload = checkAllLoaded;
npc2Img.onload = checkAllLoaded;
bombImg.onload = checkAllLoaded;
heartImg.onload = checkAllLoaded;


function checkAllLoaded() {
  imagesLoaded++;
  if (imagesLoaded === 9) {
    requestAnimationFrame(gameLoop);
  }
}

function isShooting() {
  return !!(keys[" "]); // Ép kiểu rõ ràng
}

function attack() {
  if (!canShoot) {
    currentImg = idleImg;
  } else {
    currentImg = shootImg;
  }
}

function update(delta) {
  updateBullets(delta);
  updateNpcs(delta);
  const moveSpeed = player.speed * delta;
  let isMoving = false;

  // Flip player về phía npc gần nhất (chỉ khi shooting)
  if (isShooting()) {
    const target = findClosestNpcY();
    if (target) {
      facingLeft = target.x < player.x;
    }
    attack();
  } else { 
    if (controls.bomb.some(k => keys[k])) throwBomb();
    if (controls.left.some(k => keys[k])) {
      player.x -= moveSpeed;
      currentImg = runImg;
      facingLeft = true;
      isMoving = true;
    }

    if (controls.right.some(k => keys[k])) {
      player.x += moveSpeed;
      currentImg = runImg;
      facingLeft = false;
      isMoving = true;
    }

    if (controls.up.some(k => keys[k])) {
      player.y -= moveSpeed;
      currentImg = upImg;
      isMoving = true;
    }

    if (controls.down.some(k => keys[k])) {
      player.y += moveSpeed;
      currentImg = downImg;
      isMoving = true;
    }

    if (!isMoving) {
      currentImg = idleImg;
    }
  }

  // 1. Player bị chặn theo trục X nếu ép vào NPC
  for (let npc of npcs) {
    const dx = Math.abs(player.x - npc.x);
    const dy = Math.abs(player.y - npc.y);
    if (dx < 10 && dy < npc.size * 0.3) {
      if (controls.left.some(k => keys[k])) player.x += moveSpeed;
      if (controls.right.some(k => keys[k])) player.x -= moveSpeed;
    }
  }
  for (let i = groundBombs.length - 1; i >= 0; i--) {
    const bomb = groundBombs[i];
    const dx = Math.abs(player.x - bomb.x);
    const dy = Math.abs(player.y - bomb.y);
    const dist = Math.hypot(dx, dy);

    if (dist < ((player.size / 2) + (bomb.size / 2)) / 2) {
      bomb.collected = true;
      groundBombs.splice(i, 1);
      bombCount++;
    }
  }
  for (let i = hearts.length - 1; i >= 0; i--) {
    const heartItem = hearts[i];
    const dx = Math.abs(player.x - heartItem.x);
    const dy = Math.abs(player.y - heartItem.y);
    const dist = Math.hypot(dx, dy);

    if (dist < ((player.size / 2) + (heartItem.size / 2)) / 2) {
      heartItem.collected = true;
      hearts.splice(i, 1);
      heart++;
    }
  }

  if (HeartLose) {
    for (let npc of npcs) {
      const dx = Math.abs(player.x - npc.x);
      const dy = Math.abs(player.y - npc.y);
      if (dx < 10 && dy < npc.size * 0.3) {
        if (HeartLose) heart--;
        HeartLose = false;
        setTimeout(() => HeartLose = true, 1000);
      }
    }
  }
  if (heart <= 0) {
    canClickPauseButton =false;
    isPaused = true;
  }
  // Wrap map
  if (player.x < 0) player.x = mapWidth;
  if (player.x > mapWidth) player.x = 0;
  if (player.y < 0) player.y = mapHeight;
  if (player.y > mapHeight) player.y = 0;
}

let mapOffsetX = 0;
let mapOffsetY = 0;

function draw() {
  ctx.clearRect(0, 0, screenWidth, screenHeight);

  const mapOffsetX = (screenWidth - mapWidth) / 2;
  const mapOffsetY = (screenHeight - mapHeight) / 2;

  // Vẽ nền map
  ctx.fillStyle = "#333";
  ctx.fillRect(mapOffsetX, mapOffsetY, mapWidth, mapHeight);

  // === Giới hạn vùng vẽ trong map ===
  ctx.save();
  ctx.beginPath();
  ctx.rect(mapOffsetX, mapOffsetY, mapWidth, mapHeight);
  ctx.clip();
  for (let bomb of bombs) {
    ctx.save();
    ctx.translate(bomb.x + mapOffsetX, bomb.y + mapOffsetY);
    ctx.drawImage(bombImg, -bomb.size / 2, -bomb.size / 2, bomb.size, bomb.size);
    ctx.restore();
  }
  for (let bomb of groundBombs) {
    ctx.save();
    ctx.translate(bomb.x + mapOffsetX, bomb.y + mapOffsetY);
    ctx.drawImage(bombImg, -bomb.size / 2, -bomb.size / 2, bomb.size, bomb.size);
    ctx.restore();
  }
  for (let exp of explosions) {
    ctx.beginPath();
    ctx.arc(exp.x + mapOffsetX, exp.y + mapOffsetY, exp.radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 100, 0, 0.3)";
    ctx.fill();
  }
// Vẽ heart rơi trên map
  for (let heartItem of hearts) {
    ctx.save();
    ctx.translate(heartItem.x + mapOffsetX, heartItem.y + mapOffsetY);
    ctx.drawImage(heartImg, -heartItem.size / 2, -heartItem.size / 2, heartItem.size, heartItem.size);
    ctx.restore();
  }


  // Vẽ NPC – flip nếu player ở bên phải
  for (let npc of npcs) {
    const flip = player.x > npc.x;

    ctx.save();
    ctx.translate(npc.x + mapOffsetX, npc.y + mapOffsetY);
    if (flip) ctx.scale(-1, 1);

    // Vẽ ảnh NPC
    if (npc.type === "melee") {
      ctx.drawImage(npcImg, -npc.size / 2, -npc.size / 2, npc.size, npc.size);
    } 
    else {
      ctx.drawImage(npc2Img, -npc.size / 2, -npc.size / 2, npc.size, npc.size);
    }
    // === Vẽ thanh máu ===
    const barWidth = 40;
    const barHeight = 5;
    const hpRatio = npc.hp / 100;

    ctx.fillStyle = "red";
    ctx.fillRect(-barWidth / 2, -npc.size / 2 - 10, barWidth, barHeight);

    ctx.fillStyle = "lime";
    ctx.fillRect(-barWidth / 2, -npc.size / 2 - 10, barWidth * hpRatio, barHeight);

    ctx.restore();
  }
  drawEnemyBullets((screenWidth - mapWidth) / 2, (screenHeight - mapHeight) / 2);


  // Vẽ đạn
  drawBullets(mapOffsetX, mapOffsetY);

  // Vẽ player – flip theo facingLeft
  ctx.save();
  ctx.translate(player.x + mapOffsetX, player.y + mapOffsetY);
  if (!facingLeft) ctx.scale(-1, 1);
  ctx.drawImage(currentImg, -player.size / 2, -player.size / 2, player.size, player.size);
  ctx.restore();

  // === Kết thúc vùng giới hạn ===
  ctx.restore();

  // Vẽ nút pause (góc trên phải)
  const btnX = screenWidth - 50;
  const btnY = 20;
  const btnW = 20;
  const btnH = 30;

  ctx.fillStyle = "white";
  ctx.fillRect(btnX, btnY, 6, btnH);
  ctx.fillRect(btnX + 12, btnY, 6, btnH);
  ctx.fillStyle = "white";
  ctx.font = "bold 20px Courier";
  ctx.fillText("W, A, S, D: Move", 780, screenHeight - 450);
  ctx.fillStyle = "white";
  ctx.font = "bold 20px Courier";
  ctx.fillText("Space: Shoot", 780, screenHeight - 400);
  ctx.fillStyle = "white";
  ctx.font = "bold 20px Courier";
  ctx.fillText("E: Bomb", 780, screenHeight - 350);
  if (isPaused) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)"; // màu đen trong suốt 40%
    ctx.fillRect(0, 0, screenWidth, screenHeight);
  }
  if (bombCount > 0) {
    ctx.drawImage(bombImg, 50, screenHeight- 550, 100, 100); 

// Hiển thị số lượng
    ctx.fillStyle = "white";
    ctx.font = "20px Courier";
    ctx.fillText("x" + bombCount, 90, screenHeight - 450);
  }
  if (heart > 0) {
    for (let a = 1; a <= heart; a++) {
      ctx.drawImage(heartImg, 60*a, screenHeight- 600, 64, 64); 
    }
  }
  else {
    ctx.save();

    ctx.font = "bold 40px Courier";          // chữ đậm + kích cỡ
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const centerX = mapOffsetX + mapWidth / 2;
    const centerY = mapOffsetY + mapHeight / 2;

    ctx.lineWidth = 5;
    ctx.strokeStyle = "black";
    ctx.strokeText("Game Over!", centerX, centerY);  // viền đen

    ctx.fillStyle = "red";
    ctx.fillText("Game Over!", centerX, centerY);    // chữ đỏ

    ctx.restore();
  }
}


function findClosestNpcY() {
  let closest = null;
  let minDist = Infinity;

  for (let npc of npcs) {
    const dist = Math.abs(npc.y - player.y);
    if (dist < minDist) {
      minDist = dist;
      closest = npc;
    }
  }

  return closest;
}
     
function shoot() {
  const target = findClosestNpcY();

  let vx, vy;

  if (target) {
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const len = Math.hypot(dx, dy);
    vx = dx / len;
    vy = dy / len;
  } else {
    vx = facingLeft ? -1 : 1;
    vy = 0;
  }

  let r = Math.random();
  let damage = r*100;

  bullets.push({
    x: player.x,
    y: player.y,
    vx,
    vy,
    speed: 5,
    damage
  });
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function updateBullets(delta) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * b.speed * delta;
    b.y += b.vy * b.speed * delta;

    for (let j = npcs.length - 1; j >= 0; j--) {
      const npc = npcs[j];
      const dx = Math.abs(b.x - npc.x);
      const dy = Math.abs(b.y - npc.y);

      if (dx < 3 && dy < npc.size / 2) {
        npc.hp -= b.damage;
        bullets.splice(i, 1);
        if (npc.hp <= 0) npcs.splice(j, 1);
        break;
      }
    }
  }
}


function drawBullets(offsetX, offsetY) {
  ctx.fillStyle = "white";
  for (let b of bullets) {
    ctx.beginPath();
    ctx.arc(b.x + offsetX, b.y + offsetY, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function updateShooting(currentTime) {
  if (!isShooting()) return;
  if (!canShoot) return;

  if (currentTime - lastShotTime >= shootDelay) {
    shoot();
    lastShotTime = currentTime;
    shotCount++;

    if (shotCount >= maxShots) {
      canShoot = false;
      setTimeout(() => {
        canShoot = true;
        shotCount = 0;
      }, reloadDelay);
    }
  }
}

function updateNpcs(delta) {
  for (let npc of npcs) {
    const dx = player.x - npc.x;
    const dy = player.y - npc.y;
    const dist = Math.hypot(dx, dy);

    if (npc.type === "melee") {
      if (dist > 1) {
        const vx = dx / dist;
        const vy = dy / dist;

        let nextX = npc.x + vx * npc.speed * delta;
        let nextY = npc.y + vy * npc.speed * delta;

        // Va chạm trục X
        let blockedX = false;
        for (let other of npcs) {
          if (other === npc) continue;
          const deltaX = Math.abs(nextX - other.x);
          const deltaY = Math.abs(npc.y - other.y);
          if (deltaX < npc.size * 0.2 && deltaY < npc.size * 0.2) {
            blockedX = true;
            break;
          }
        }
        if (!blockedX) npc.x = nextX;

        // Va chạm trục Y
        let blockedY = false;
        for (let other of npcs) {
          if (other === npc) continue;
          const deltaX = Math.abs(npc.x - other.x);
          const deltaY = Math.abs(nextY - other.y);
          if (deltaX < npc.size * 0.2 && deltaY < npc.size * 0.2) {
            blockedY = true;
            break;
          }
        }
        if (!blockedY) npc.y = nextY;
      }
    } 
    
    else if (npc.type === "ranger") {
      // Bắn đạn mỗi 2 giây
      npc.shootCooldown -= delta;
      if (npc.shootCooldown <= 0 && dist < 600) {
        const len = Math.hypot(dx, dy);
        const vx = dx / len;
        const vy = dy / len;

        enemyBullets.push({
          x: npc.x,
          y: npc.y,
          vx,
          vy,
          speed: 2,
          damage: 10
        });

        npc.shootCooldown = 120; // reset sau mỗi 2s nếu delta = 1/60
      }
    }
  }
}

function updateEnemyBullets(delta) {
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const b = enemyBullets[i];
    b.x += b.vx * b.speed * delta;
    b.y += b.vy * b.speed * delta;

    const dx = Math.abs(b.x - player.x);
    const dy = Math.abs(b.y - player.y);
    if (dx < player.size / 2 && dy < player.size / 2) {
      heart--;
      enemyBullets.splice(i, 1);
    }
  }
}

function drawEnemyBullets(offsetX, offsetY) {
  ctx.fillStyle = "red";
  for (let b of enemyBullets) {
    ctx.beginPath();
    ctx.arc(b.x + offsetX, b.y + offsetY, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}


function spawnRandomNpc() {
  const type = Math.random() < 0.8 ? "melee" : "ranger";

  const newNpc = {
    x: Math.random() * mapWidth + mapOffsetX,
    y: Math.random() * mapHeight + mapOffsetY,
    size: 64,
    speed: type === "melee" ? 1 : 0.5,
    hp: 100,
    type,
    shootCooldown: 0  // dùng cho ranger
  };

  npcs.push(newNpc);
}

let time = 0;
let i = 1;
function spawnLoop() {
  if (!isPaused) spawnRandomNpc();

  if (time % 5 === 0 && time !== 0) {
    if (!isPaused) items();
  }

  time++;
  setTimeout(spawnLoop, 1000);
}

spawnLoop();

function items() {
  let r = Math.random();
  let item;

  if (r < 0.3) {
    item = {
      x: Math.random() * mapWidth,
      y: Math.random() * mapHeight,
      size: 64,
      collected: false,
      type: "bomb"
    };
    groundBombs.push(item);
  } else {
    item = {
      x: Math.random() * mapWidth,
      y: Math.random() * mapHeight,
      size: 32,
      collected: false,
      type: "heart"
    };
    hearts.push(item);
  }

  setTimeout(() => {
    if (!item.collected) {
      if (item.type === "bomb") {
        const index = groundBombs.indexOf(item);
        if (index !== -1) groundBombs.splice(index, 1);
      } else {
        const index = hearts.indexOf(item);
        if (index !== -1) hearts.splice(index, 1);
      }
    }
  }, 10000);
}



function throwBomb() {
  if (!canThrowBomb || bombCount <= 0) return;

  const target = findClosestNpcY();

  let vx, vy;
  if (target) {
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const len = Math.hypot(dx, dy);
    vx = dx / len;
    vy = dy / len;
  } else {
    vx = facingLeft ? -1 : 1;
    vy = 0;
  }

  bombs.push({
    x: player.x,
    y: player.y,
    vx,
    vy,
    speed: 6,
    radius: 60,
    timer: 30,
    size: 64 // 👈 nhớ thêm nếu chưa có
  });

  canThrowBomb = false;
  bombCount--;
  setTimeout(() => canThrowBomb = true, 5000); // cooldown 5s
}
  

function updateBombs(delta) {
  for (let i = bombs.length - 1; i >= 0; i--) {
    let b = bombs[i];
    b.x += b.vx * b.speed * delta;

    b.timer--;
    if (b.timer <= 0) {
      explode(b.x, b.y, b.radius);
      bombs.splice(i, 1);
    }
  }
}

function explode(x, y, radius) {
  // Gây sát thương
  for (let i = npcs.length - 1; i >= 0; i--) {
    const npc = npcs[i];
    const dx = npc.x - x;
    const dy = npc.y - y;
    const dist = Math.hypot(dx, dy);
    let r = Math.random();
    if (dist < radius) {
      npc.hp -= (r*50)+50;
      if (npc.hp <= 0) npcs.splice(i, 1);
    }
  }

  // 👇 Thêm hiệu ứng nổ
  explosions.push({
    x, y, radius,
    life: 15 // frames tồn tại
  });
}

function updateExplosions() {
  for (let i = explosions.length - 1; i >= 0; i--) {
    explosions[i].life--;
    if (explosions[i].life <= 0) explosions.splice(i, 1);
  }
}



canvas.addEventListener("click", (e) => {
  if (!canClickPauseButton) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const btnX = screenWidth - 50;
  const btnY = 20;
  const btnW = 20;
  const btnH = 30;

  if (x >= btnX - 2 && x <= btnX + btnW + 2 && y >= btnY - 2 && y <= btnY + btnH + 2) {
    isPaused = !isPaused;
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    isPaused = true;
  } else {
    // Không tự unpause liền — chỉ reset time để tránh jump
    lastTime = performance.now();
  }
});


let lastTime = 0;

function gameLoop(timestamp) {

  const delta = Math.min((timestamp - lastTime) / 16.67, 5);

  lastTime = timestamp;

  if (!isPaused) {
    updateShooting(timestamp);
    update(delta);
    updateBombs(delta);
    updateExplosions();
    updateEnemyBullets(delta)
  }

  draw();
  requestAnimationFrame(gameLoop);
}



