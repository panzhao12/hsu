import { Story } from './story.js';
import { Util } from './util.js';
import { Physics } from './physics.js';
import { Sprite } from './sprite.js';
import { Characters } from './characters.js';
import { Camera } from './camera.js';

const fetchGameData = new Promise((res, rej) => {
  fetch('./gameData.json')
    .then(response => res(response.json()))
});

window.addEventListener('load', async () => {
  const start = new Date(); // Save the start time
  const gameData = await fetchGameData;

  // Load elements from DOM (look in index.html)
  const objectCanvas = document.getElementById('objects-layer');
  const layoutCanvas = document.getElementById('layout-layer');
  const layoutImage = document.getElementById('layout');
  const backgroundImage = document.getElementById('background');

  // Get bounds pixels and context
  const layoutCanvasData = Camera.getCanvasData(layoutCanvas);
  const { canvasWidth, canvasHeight } = layoutCanvasData;

  Camera.setCanvasResolution(objectCanvas, canvasWidth, canvasHeight);
  Camera.setCanvasResolution(layoutCanvas, canvasWidth, canvasHeight);
  layoutCanvasData.context.drawImage(layoutImage, 0, 0, 
    canvasWidth, Math.round(canvasWidth*layoutImage.height/layoutImage.width)
  );

  const pixels = Camera.getContextPixels(layoutCanvasData);
  // Default layer context
  const context = objectCanvas.getContext('2d');
  context.imageSmoothingEnabled = false;
  layoutCanvasData.context.imageSmoothingEnabled = false;

  // Load the initial story
  let gameState = Story.loadGameState({ gameData, width: canvasWidth, height: canvasHeight });

  // Load sprites
  const characterSprite = document.getElementById('character-sprite');
  const sprites = Sprite.loadSprites({
    characterSprite: {
      image: characterSprite, // Actual image data
      columns: 3, // How many columns
      rows: 5, // How many rows
      padding: 60, // How much whitespace to ignore
      // How big should the cached tile versions be - we just have two sizes
      scales: [gameState.player.width, gameState.player.width*2]
    },
    background: {
      image: backgroundImage,
      columns: 1,
      rows: 1,
      padding: 0,
      scales: [canvasWidth, canvasWidth*2],
      alpha: false
    }
  }, canvasProvider);

  // Add some random characters
  let newCharacters = new Array(0).fill(gameState.characters[0]).map((t, i) => {
    let spriteIndex = 8;
    while(spriteIndex === 8) { spriteIndex = Math.floor(Math.random()*13); }
    return { ...t, id:i+gameState.characters.length+1, spriteIndex, type:'' }; //other NPCs' IDs follow the 'vip' NPCs'
  });

  console.log(newCharacters);
  console.log(gameState);

  let storyChanges;
  let oldViewport;
  let physicsState = { 
    context,
    pixels,
    player: gameState.player, 
    characters: gameState.characters.concat(newCharacters),
    width: canvasWidth,
    height: canvasHeight,
    locMap: {},
    updateStats,
    moveNPC: Characters.moveNPC,
    movePlayer,
    getGameState
  };
  /**
   * physicsLoop.
   */
  const physicsLoop = () => {
    physicsState = Physics.updatePhysicsState(physicsState);
    if (storyChanges) {
      physicsState = Story.applyChanges(physicsState, storyChanges);
      storyChanges = null;
    }
    const viewport = Camera.updateViewport({
      oldViewport,
      player: physicsState.player,
      width: physicsState.width,
      height: physicsState.height,
      scale: zoom ? 2 : 1
    });
    Camera.drawScene({
      oldViewport,
      player: physicsState.player,
      characters: physicsState.characters,
      context, 
      width: canvasWidth,
      height: canvasHeight,
      sprites,
      layoutContext: layoutCanvasData.context,
      viewport
    });
    oldViewport = viewport;
    window.requestAnimationFrame(physicsLoop);
  };
  // Start main game loop
  physicsLoop();


  // Update game state periodically (100ms)
  let last = new Date();
  setInterval(() => {
    const timeSinceLast = new Date()-last;
    gameState = {
      ...gameState,
      player: physicsState.player,
      characters: physicsState.characters,
    };
    const now = new Date() - start;
    let conversationTriggered = false;
    let newGameState = Story.updateGameState({ 
      gameState, 
      now,
      timeSinceLast,
      conversationTriggered
    });
    last = new Date();
    if (newGameState !== gameState) {
      storyChanges = Story.getChanges(gameState, newGameState);
    }

    if (gameState.conversation !== newGameState.conversation) {
      renderConversation(newGameState.conversation);
    }
  }, 100);

  // Update FPS/other stats every 1000ms
  setInterval(() => {
    updateDiagnostDisp({ fps: frames, mapMakingTime, collisionTime, collisionChecks, collisionCalls });
    clearStats();
  }, 1000);
});


/**
 * getGameState.
 * @deprecated
 */
function getGameState() {
  return { paused: pause, attack, up, down, left, right };
}

// 
/**
 * Take all the input requests give an updated player
 *
 * @param {}
 */
function movePlayer({ player, width, height, up, down, left, right }) {
  let newPlayer = player;
  let prefix = '';
  if (up && !down) {
    prefix = 'up';
    newPlayer = { 
      ...newPlayer,
      y: Math.max(newPlayer.y - newPlayer.speed, 0), facing: prefix
    };
  } 
  if (down && !up) {
    prefix = 'down';
    newPlayer = { 
      ...newPlayer, 
      y: Math.min(newPlayer.y + newPlayer.speed, height-newPlayer.height),
      facing: prefix
    };
  }
  if (left && !right) {
    newPlayer = {
      ...newPlayer,
      x: Math.max(newPlayer.x - newPlayer.speed, 0),
      facing: prefix + 'left'
    };
  }
  if (right && !left) {
    newPlayer = { 
      ...newPlayer,
      x: Math.min(newPlayer.x + newPlayer.speed, width-newPlayer.height),
      facing: prefix + 'right'
    };
  }
  return newPlayer;
}

// Modified by the eventListener
let up = false;
let down = false;
let left = false;
let right = false;
let attack = false;
let pause = false;
let zoom = false;
window.addEventListener('keydown', (e) => {
  // Do nothing if event already handled
  if (event.defaultPrevented) { return; }

  switch(event.code) {
    case "KeyS":
    case "ArrowDown":
      // Handle "back"
      down = true;
      break;
    case "KeyW":
    case "ArrowUp":
      // Handle "forward"
      up = true;
      break;
    case "KeyA":
    case "ArrowLeft":
      // Handle "turn left"
      left = true;
      break;
    case "KeyD":
    case "ArrowRight":
      // Handle "turn right"
      right = true;
      break;
  }
});
window.addEventListener('keyup', (e) => {
  // Do nothing if event already handled
  if (event.defaultPrevented) { return; }

  switch(event.code) {
    case "KeyS":
    case "ArrowDown":
      down = false;
      break;
    case "KeyW":
    case "ArrowUp":
      up = false;
      break;
    case "KeyA":
    case "ArrowLeft":
      left = false;
      break;
    case "KeyD":
    case "ArrowRight":
      right = false;
      break;
    case "Space":
      attack = !attack;
      break;
    case "KeyP":
      pause = !pause;
      break;
    case "KeyZ":
      zoom = !zoom;
      break;
    default:
      console.log(event.code);
      break;
  }
});

// These are modified by updateStats and clearStats
let frames = 0;
let mapMakingTime = 0;
let collisionTime = 0;
let collisionChecks = 0;
let collisionCalls = 0;

/**
 * clearStats.
 */
function clearStats() {
  frames = 0;
  mapMakingTime = 0;
  collisionTime = 0;
  collisionChecks = 0;
  collisionCalls = 0;
}

/**
 * updateStats.
 *
 * @param {} key
 * @param {} value
 */
function updateStats(key, value) {
  switch(key) {
    case 'frames':
      frames+=value;
      return;
    case 'mapMakingTime':
      mapMakingTime+=value;
      return;
    case 'collisionTime':
      collisionTime+=value;
      return;
    case 'collisionChecks':
      collisionChecks+=value;
      return;
    case 'collisionCalls':
      collisionCalls+=value;
      return;
  }
}

/**
 * updateDiagnostDisp.
 *
 * @param {}
 */
function updateDiagnostDisp({ fps, collisionTime, mapMakingTime, collisionChecks, collisionCalls }) {
  const el = document.getElementById('fps');
  el.innerHTML = `<ul>
    <li>${fps} FPS</li>
    <li>${collisionTime} Col. ms </li>
    <li>${mapMakingTime} Map. ms </li>
    <li>${Math.round(collisionChecks/collisionCalls)} Ave. Col. Checks </li>
  </ul>`;
}

/**
 * renderConversation.
 *
 * @param {} conversation
 */
function renderConversation(conversation) {
  const el = document.getElementById('conversation');
  if (!conversation) {
    el.style.display = 'none';
    return;
  }
  const { character, currentDialog } = conversation;
  el.style.display = 'block';
  let html = `<p>
    <b>${character.name}:</b>
    ${currentDialog.response}
  </p>`;
  el.innerHTML = html;

  if (!conversation.conversationTriggered) {
    el.style.display = 'none';
  }
}

/**
 * canvasProvider.
 */
function canvasProvider() {
  return document.createElement('canvas');
}
