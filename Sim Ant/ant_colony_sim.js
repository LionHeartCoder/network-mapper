const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Colony parameters
const NUM_ANTS = 50;
const FOOD_SOURCES = 5;
const NEST = { x: 400, y: 300, radius: 40 };
const RED_NEST = { x: 700, y: 500, radius: 40 };

let ants = [];
let redAnts = [];
let foods = [];
let colonyStats = { foodStored: 0, ants: NUM_ANTS };
let redStats = { foodStored: 0, ants: NUM_ANTS };

// --- Frame counter for game loop ---
let frameCount = 0;

// --- Scent Trail and Colony Reproduction ---
const SCENT_GRID_SIZE = 20;
const SCENT_DECAY = 0.98;
const SCENT_STRENGTH = 100;
const REPRODUCTION_COST = 10;
const REPRODUCTION_RATE = 0.01;
let foodScentGrid = [];
let nestScentGrid = [];
let redFoodScentGrid = [];
let redNestScentGrid = [];

// --- Improved Food Spawn Rate, Trail Following, and Scouting ---
const FOOD_DROP_INTERVAL = 600; // slower food spawn
const SCOUT_RADIUS = 120; // minimum distance from nest to start scouting

function randomPos(radius = 0) {
    return {
        x: Math.random() * (canvas.width - 2 * radius) + radius,
        y: Math.random() * (canvas.height - 2 * radius) + radius
    };
}

function resetGame() {
    ants = [];
    redAnts = [];
    foods = [];
    colonyStats.foodStored = 0;
    redStats.foodStored = 0;
    for (let i = 0; i < NUM_ANTS; i++) {
        ants.push({
            x: NEST.x + Math.random() * NEST.radius,
            y: NEST.y + Math.random() * NEST.radius,
            carrying: false,
            target: null,
            state: 'searching'
        });
        redAnts.push({
            x: RED_NEST.x + Math.random() * RED_NEST.radius,
            y: RED_NEST.y + Math.random() * RED_NEST.radius,
            carrying: false,
            target: null,
            state: 'searching'
        });
    }
    for (let i = 0; i < FOOD_SOURCES; i++) {
        const sizes = [
            { radius: 8, amount: 50 },
            { radius: 16, amount: 150 },
            { radius: 32, amount: 400 }
        ];
        const size = sizes[Math.floor(Math.random() * sizes.length)];
        const pos = randomPos(size.radius);
        foods.push({ x: pos.x, y: pos.y, amount: size.amount, radius: size.radius });
    }
}

function initScentGrid() {
    foodScentGrid = Array(Math.ceil(canvas.width / SCENT_GRID_SIZE)).fill().map(() =>
        Array(Math.ceil(canvas.height / SCENT_GRID_SIZE)).fill(0));
    nestScentGrid = Array(Math.ceil(canvas.width / SCENT_GRID_SIZE)).fill().map(() =>
        Array(Math.ceil(canvas.height / SCENT_GRID_SIZE)).fill(0));
    redFoodScentGrid = Array(Math.ceil(canvas.width / SCENT_GRID_SIZE)).fill().map(() =>
        Array(Math.ceil(canvas.height / SCENT_GRID_SIZE)).fill(0));
    redNestScentGrid = Array(Math.ceil(canvas.width / SCENT_GRID_SIZE)).fill().map(() =>
        Array(Math.ceil(canvas.height / SCENT_GRID_SIZE)).fill(0));
}

function layScentTrail(ant, grid) {
    const gx = Math.floor(ant.x / SCENT_GRID_SIZE);
    const gy = Math.floor(ant.y / SCENT_GRID_SIZE);
    if (grid[gx] && grid[gx][gy] !== undefined) {
        grid[gx][gy] = SCENT_STRENGTH;
    }
}

function decayScentGrid(grid) {
    for (let x = 0; x < grid.length; x++) {
        for (let y = 0; y < grid[x].length; y++) {
            grid[x][y] *= SCENT_DECAY;
        }
    }
}

function getScentDirection(ant, grid) {
    let bestStrength = 0;
    let bestDir = null;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            const gx = Math.floor((ant.x + dx * SCENT_GRID_SIZE) / SCENT_GRID_SIZE);
            const gy = Math.floor((ant.y + dy * SCENT_GRID_SIZE) / SCENT_GRID_SIZE);
            if (grid[gx] && grid[gx][gy] !== undefined && grid[gx][gy] > bestStrength) {
                bestStrength = grid[gx][gy];
                bestDir = { dx, dy };
            }
        }
    }
    return bestDir;
}

// --- Improved Ant Intelligence and Combat ---
function findNearestFood(ant) {
    let minDist = Infinity;
    let nearest = null;
    for (let food of foods) {
        if (food.amount > 0) {
            const dist = Math.hypot(food.x - ant.x, food.y - ant.y);
            if (dist < minDist) {
                minDist = dist;
                nearest = food;
            }
        }
    }
    return nearest;
}

function findNearbyEnemy(ant, enemyGroup) {
    for (let enemy of enemyGroup) {
        if (Math.hypot(enemy.x - ant.x, enemy.y - ant.y) < 10) {
            return enemy;
        }
    }
    return null;
}

// --- Smoother Ant Motion and Improved Nests ---
function updateAntGroup(antGroup, nest, stats, enemyGroup, foodGrid, nestGrid) {
    antGroup.forEach(ant => {
        // Combat: fight if near enemy
        const enemy = findNearbyEnemy(ant, enemyGroup);
        if (enemy) {
            ant.x = -100; ant.y = -100;
            enemy.x = -100; enemy.y = -100;
            stats.ants--;
            if (enemyGroup === ants) colonyStats.ants--;
            else redStats.ants--;
            return;
        }
        if (ant.state === 'searching') {
            // Follow food scent trail
            const scentDir = getScentDirection(ant, foodGrid);
            if (scentDir && Math.random() < 0.8) {
                ant.x += scentDir.dx * 1.2 + (Math.random() * 0.4 - 0.2);
                ant.y += scentDir.dy * 1.2 + (Math.random() * 0.4 - 0.2);
            } else {
                // Randomly boost some ants to simulate scouts
                const scoutBoost = Math.random() < 0.1 ? 3.5 : 1.2;
                ant.x += Math.cos(Math.random() * 2 * Math.PI) * scoutBoost;
                ant.y += Math.sin(Math.random() * 2 * Math.PI) * scoutBoost;
            }
            // Seek nearest food
            const nearestFood = findNearestFood(ant);
            if (nearestFood && Math.hypot(nearestFood.x - ant.x, nearestFood.y - ant.y) < nearestFood.radius) {
                ant.carrying = true;
                ant.state = 'carrying';
                ant.target = { x: nest.x, y: nest.y };
                nearestFood.amount--;
                layScentTrail(ant, foodGrid); // Lay food scent when food found
            }
        } else if (ant.state === 'carrying') {
            // Follow nest scent trail
            const scentDir = getScentDirection(ant, nestGrid);
            if (scentDir && Math.random() < 0.8) {
                ant.x += scentDir.dx * 1.2 + (Math.random() * 0.4 - 0.2);
                ant.y += scentDir.dy * 1.2 + (Math.random() * 0.4 - 0.2);
            } else {
                // Directly head to nest
                const dx = ant.target.x - ant.x;
                const dy = ant.target.y - ant.y;
                const dist = Math.hypot(dx, dy);
                if (dist > 0) {
                    ant.x += dx / dist * 1.5;
                    ant.y += dy / dist * 1.5;
                }
            }
            layScentTrail(ant, nestGrid); // Lay nest scent when carrying
            const dx = ant.target.x - ant.x;
            const dy = ant.target.y - ant.y;
            const dist = Math.hypot(dx, dy);
            if (dist < nest.radius) {
                stats.foodStored++;
                ant.carrying = false;
                ant.state = 'searching';
                ant.target = null;
            }
        }
    });
}

function reproduceAnts(stats, antGroup, nest, grid) {
    if (stats.foodStored >= REPRODUCTION_COST && Math.random() < REPRODUCTION_RATE * (stats.foodStored / REPRODUCTION_COST)) {
        antGroup.push({
            x: nest.x + Math.random() * nest.radius,
            y: nest.y + Math.random() * nest.radius,
            carrying: false,
            target: null,
            state: 'searching'
        });
        stats.ants++;
        stats.foodStored -= REPRODUCTION_COST;
    }
}

function spawnFoodDrop() {
    // Randomly choose size: small, medium, large
    const sizes = [
        { radius: 8, amount: 50 },
        { radius: 16, amount: 150 },
        { radius: 32, amount: 400 }
    ];
    const size = sizes[Math.floor(Math.random() * sizes.length)];
    const pos = randomPos(size.radius);
    foods.push({ x: pos.x, y: pos.y, amount: size.amount, radius: size.radius });
}

function drawAntGroup(antGroup, color) {
    antGroup.forEach(ant => {
        if (ant.x < 0 || ant.y < 0) return; // Dead ants
        ctx.fillStyle = ant.carrying ? color : color;
        ctx.beginPath();
        ctx.arc(ant.x, ant.y, 3, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawNest(nest, color, border) {
    // Outer tan nest
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(nest.x, nest.y, nest.radius, 0, Math.PI * 2);
    ctx.fill();
    // Inner dark brown entrance
    ctx.fillStyle = '#4e2e0e';
    ctx.beginPath();
    ctx.arc(nest.x, nest.y, nest.radius * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.stroke();
}

function drawFoods() {
    foods.forEach(food => {
        if (food.amount > 0) {
            // Shrink radius as food is consumed
            food.radius = Math.max(4, food.amount / 12);
            ctx.fillStyle = '#27ae60';
            ctx.beginPath();
            ctx.arc(food.x, food.y, food.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    });
}

function updateStats() {
    document.getElementById('stats').innerHTML =
        `Black Ants: ${colonyStats.ants} | Food Stored: ${colonyStats.foodStored}<br>` +
        `Red Ants: ${redStats.ants} | Food Stored: ${redStats.foodStored}`;
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawNest(NEST, '#e6c49f', '#a67c52');
    drawNest(RED_NEST, '#e6c49f', '#a67c52');
    drawFoods();
    updateAntGroup(ants, NEST, colonyStats, redAnts, foodScentGrid, nestScentGrid);
    updateAntGroup(redAnts, RED_NEST, redStats, ants, redFoodScentGrid, redNestScentGrid);
    drawAntGroup(ants, '#222');
    drawAntGroup(redAnts, '#e74c3c');
    updateStats();
    decayScentGrid(foodScentGrid);
    decayScentGrid(nestScentGrid);
    decayScentGrid(redFoodScentGrid);
    decayScentGrid(redNestScentGrid);
    reproduceAnts(colonyStats, ants, NEST, nestScentGrid);
    reproduceAnts(redStats, redAnts, RED_NEST, redNestScentGrid);
    frameCount++;
    if (frameCount % FOOD_DROP_INTERVAL === 0) {
        spawnFoodDrop();
    }
    requestAnimationFrame(gameLoop);
}

resetGame();
initScentGrid();
gameLoop();