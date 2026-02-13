const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game variables
let bird = { x: 50, y: 150, width: 20, height: 20, velocity: 0, gravity: 0.5, lift: -6 };
let isGameRunning = false;

// Add obstacles
let pipes = [];
const pipeWidth = 50;
const pipeGap = 120;

// Add scoring system
let score = 0;

// Add scroll speed ramping and high score display
let pipeSpeed = 2;
// Load high score from localStorage
let highScore = Number(localStorage.getItem('flappyHighScore')) || 0;

// Modify startGame to show the canvas and hide the menu
function startGame() {
    document.getElementById('menu').style.display = 'none';
    canvas.style.display = 'block';
    isGameRunning = true;
    gameLoop();
}

// Bird movement
document.addEventListener('keydown', () => {
    if (isGameRunning) bird.velocity = bird.lift;
});

function spawnPipe() {
    const pipeY = Math.random() * (canvas.height - pipeGap - 100) + 50;
    pipes.push({ x: canvas.width, y: pipeY });
}

function updatePipes() {
    pipes.forEach(pipe => {
        pipe.x -= pipeSpeed;
    });

    // Remove pipes that are off-screen
    pipes = pipes.filter(pipe => pipe.x + pipeWidth > 0);

    // Spawn new pipes
    if (pipes.length === 0 || pipes[pipes.length - 1].x < canvas.width - 200) {
        spawnPipe();
    }
}

function updateScore() {
    pipes.forEach(pipe => {
        if (!pipe.scored && bird.x > pipe.x + pipeWidth) {
            score++;
            pipe.scored = true;
            // Ramp up speed every 5 points
            if (score % 5 === 0) {
                pipeSpeed += 0.5;
            }
            // Update high score
            if (score > highScore) {
                highScore = score;
                localStorage.setItem('flappyHighScore', highScore);
            }
        }
    });
}

function update() {
    bird.velocity += bird.gravity;
    bird.y += bird.velocity;

    updatePipes();
    updateScore();
    checkCollisions();
}

// Add collision detection
function checkCollisions() {
    // Check collision with pipes
    pipes.forEach(pipe => {
        if (
            bird.x < pipe.x + pipeWidth &&
            bird.x + bird.width > pipe.x &&
            (bird.y < pipe.y || bird.y + bird.height > pipe.y + pipeGap)
        ) {
            endGame();
        }
    });

    // Check collision with top and bottom of the canvas
    if (bird.y + bird.height >= canvas.height || bird.y <= 0) {
        endGame();
    }
}

function endGame() {
    isGameRunning = false;
    alert(`Game Over! Your score: ${score}`);
    showMenu();
    // Reset game state for next round
    bird.y = 150;
    bird.velocity = 0;
    pipes = [];
    score = 0;
    pipeSpeed = 2;
}

// Enhance graphics and animations
const birdImage = new Image();
birdImage.src = 'bird.png';

const pipeTopImage = new Image();
pipeTopImage.src = 'pipe_top.png';

const pipeBottomImage = new Image();
pipeBottomImage.src = 'pipe_bottom.png';

const backgroundImage = new Image();
backgroundImage.src = 'background.png';

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    if (backgroundImage.complete && backgroundImage.naturalWidth !== 0) {
        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    }

    // Draw bird
    if (birdImage.complete && birdImage.naturalWidth !== 0) {
        ctx.drawImage(birdImage, bird.x, bird.y, bird.width, bird.height);
    } else {
        ctx.fillStyle = 'yellow';
        ctx.fillRect(bird.x, bird.y, bird.width, bird.height);
    }

    // Draw pipes
    pipes.forEach(pipe => {
        if (pipeTopImage.complete && pipeTopImage.naturalWidth !== 0) {
            ctx.drawImage(pipeTopImage, pipe.x, 0, pipeWidth, pipe.y);
        } else {
            ctx.fillStyle = 'green';
            ctx.fillRect(pipe.x, 0, pipeWidth, pipe.y);
        }

        if (pipeBottomImage.complete && pipeBottomImage.naturalWidth !== 0) {
            ctx.drawImage(pipeBottomImage, pipe.x, pipe.y + pipeGap, pipeWidth, canvas.height - pipe.y - pipeGap);
        } else {
            ctx.fillStyle = 'green';
            ctx.fillRect(pipe.x, pipe.y + pipeGap, pipeWidth, canvas.height - pipe.y - pipeGap);
        }
    });

    // Draw score
    ctx.fillStyle = 'black';
    ctx.font = '20px Arial';
    ctx.fillText(`Score: ${score}`, 10, 30);
    ctx.fillText(`High Score: ${highScore}`, 10, 60);
}

function gameLoop() {
    if (!isGameRunning) return;

    update();
    draw();

    requestAnimationFrame(gameLoop);
}

// Show high score on menu
function showMenu() {
    document.getElementById('menu').style.display = 'block';
    canvas.style.display = 'none';
    const highScoreElem = document.getElementById('high-score');
    if (highScoreElem) {
        highScoreElem.textContent = `High Score: ${highScore}`;
    }
}

// Add event listener to the start button
document.getElementById('start-button').addEventListener('click', () => {
    startGame();
});

// Show menu on page load
showMenu();