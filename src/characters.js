import { Util } from './util.js';

/** A class containing methods for dealing with characters  */
export class Characters {

  /**
   * This function determines the next move for a given NPC
   * @param {Object} state
   * @param {Character} state.npc the npc in question
   * @param {number} state.width the width of the whole map
   * @param {number} state.height the heigth of the whole map
   * @returns {Character} an updated version of the npc
   */
  static moveNPC({ npc, width, height, player, attack, updateStats }) {
    let newNPC = npc;

    // Allow for spawn points
    if (npc.isNew && npc.fallbackSpeed == null) {
      newNPC = { ...newNPC, speed: npc.width+1, fallbackSpeed: npc.speed };//TODO speed+1?
    } else if (npc.isNew && !npc.hasCollision) {
      newNPC = { ...newNPC, speed: newNPC.fallbackSpeed, isNew: false };
    }

    // If we're near to destination, or have a collision pick a new destination
    if (!npc.destination || Util.dist(npc, npc.destination) < npc.width || npc.hasCollision) {
      newNPC = { ...newNPC, destination: Characters.newDestination({ width, height, attack, player }) };
    }

    const x = newNPC.x + Math.round(newNPC.width/2);
    const y = newNPC.y + Math.round(newNPC.height/2);
    const xdist = Math.abs(x-newNPC.destination.x);
    const xmove = Math.sign(-x+newNPC.destination.x)*Math.min(xdist, newNPC.speed);
    const ydist = Math.abs(y-newNPC.destination.y);
    const ymove = Math.sign(-y+newNPC.destination.y)*Math.min(ydist, newNPC.speed);
    if (xmove !== 0 || ymove !== 0) {
      let prefix = '';
      let facing = newNPC.facing;
      if (ymove < 0) { prefix = 'up'; }
      else if (ymove > 0) { prefix = 'down'; }
      if (xmove < 0) { facing = prefix + 'left'; }
      else if (xmove > 0) { facing = prefix + 'right'; }
      else if (prefix) { facing = prefix; }

      if (newNPC.type === 'vip' && !attack && (
          newNPC.x >= width*newNPC.maxRight ||
          newNPC.x <= width*newNPC.maxLeft ||
          newNPC.y >= height*newNPC.maxDown ||
          newNPC.y <= height*newNPC.maxUp)){
        newNPC = {
          ...newNPC,
          facing,
          x: Math.min(Math.max(newNPC.x-xmove, 0), width-1),
          y: Math.min(Math.max(newNPC.y-ymove, 0), height-1),
          hasCollision: true
        };
      }else {
        newNPC = {
          ...newNPC,
          facing,
          x: Math.min(Math.max(newNPC.x + xmove, 0), width - 1),
          y: Math.min(Math.max(newNPC.y + ymove, 0), height - 1),
          hasCollision: false
        };
      }
    }

    return newNPC;
  }

  // This is what NPCs use right now to find a new place to go 
  static newDestination({ width, height, player, attack }) {
    if (player && attack) {
      return { x: player.x, y: player.y };
    }
    return {
      x: Math.floor(Math.random()*width),
      y: Math.floor(Math.random()*height),
    };
  }
}
