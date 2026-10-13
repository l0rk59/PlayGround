/**
 * ENTREES — tactile prioritaire, clavier en secours.
 *
 * La recherche sur les jeux a visee tactile est formelle : un joystick
 * DYNAMIQUE centre sur le point de contact, masque quand le doigt quitte
 * l'ecran, avec une zone morte. Ce n'est pas un detail, c'est la
 * difference entre un controle qui « colle au doigt » et un controle qui
 * part dans une direction au hasard quand on leve le pouce.
 *
 * Regles appliquees :
 *  - la zone morte est proportionnelle au rayon, jamais un pixel ;
 *  - le joystick reste actif si le doigt glisse AU-DELA du rayon : on n'oblige
 *    pas le joueur a maintenir un point precis ;
 *  - l'echelle de sortie est lineaire au-dela de la zone morte, pour qu'un
 *    demi-pouce donne exactement la demi-vitesse ;
 *  - les boutons ne consomment pas le joystick (poignees distinctes) ;
 *  - les gestes navigateur (zoom, scroll, selection) sont neutralises.
 */

import { clamp } from '../core/util.js';

const DEAD_ZONE = 0.16;
const STICK_RADIUS = 62;

export class Input {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.moveX = 0;
    this.moveY = 0;
    this.aim = false;
    this.sensitivity = opts.sensitivity ?? 1;
    this.side = opts.side ?? 'left';

    this.stick = { active: false, pointerId: -1, originX: 0, originY: 0, knobX: 0, knobY: 0, radius: STICK_RADIUS };
    this.buttons = {
      dodge: null,
      ability: null,
      heal: null,
    };
    this.pressed = new Set();
    this.queue = { dodge: false, ability: false, heal: false };
    this.keys = new Set();
    this.hasTouch = false;
    this.enabled = true;

    this.layout();
    this.bind();
  }

  layout() {
    const r = this.canvas.getBoundingClientRect();
    this.w = r.width;
    this.h = r.height;
    const btn = Math.max(44, Math.min(r.width, r.height) * 0.1);
    const margin = btn * 1.5;
    this.buttons.dodge = { x: r.width - margin, y: r.height - margin, r: btn, pressed: false, cooldown: 0, cooldownMax: 1 };
    this.buttons.ability = { x: r.width - margin * 2.3, y: r.height - margin * 0.85, r: btn, pressed: false, cooldown: 0, cooldownMax: 1 };
    this.buttons.heal = { x: r.width - margin * 1.35, y: r.height - margin * 2.1, r: btn * 0.78, pressed: false, cooldown: 0, cooldownMax: 1 };
  }

  bind() {
    const c = this.canvas;
    c.style.touchAction = 'none';

    const local = (ev) => {
      const r = c.getBoundingClientRect();
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    };

    this.onDown = (ev) => {
      if (!this.enabled) return;
      const p = local(ev);
      this.hasTouch = true;

      const btn = this.buttonAt(p);
      if (btn) {
        btn.pressed = true;
        this.pressed.add(btn);
        ev.preventDefault();
        return;
      }

      // Le joystick n'apparait QUE sur la moitie opposee au bouton de
      // pause, ou l'on n'a pas deja une main occupee.
      const onLeft = p.x < this.w * 0.5;
      const wantsLeft = this.side === 'left';
      if (onLeft === wantsLeft && !this.stick.active) {
        this.stick.active = true;
        this.stick.pointerId = ev.pointerId;
        this.stick.originX = p.x;
        this.stick.originY = p.y;
        this.stick.knobX = p.x;
        this.stick.knobY = p.y;
        this.updateStick(p);
        ev.preventDefault();
      }
    };

    this.onMove = (ev) => {
      if (!this.enabled) return;
      const p = local(ev);
      for (const b of this.pressed) {
        const d = Math.hypot(p.x - b.x, p.y - b.y);
        if (d > b.r * 1.9) {
          b.pressed = false;
          this.pressed.delete(b);
        }
      }
      if (this.stick.active && ev.pointerId === this.stick.pointerId) {
        this.updateStick(p);
        ev.preventDefault();
      }
    };

    this.onUp = (ev) => {
      for (const b of [...this.pressed]) {
        const p = local(ev);
        if (ev.pointerId === undefined || this.buttonAt(p) === b) {
          b.pressed = false;
          this.pressed.delete(b);
        }
      }
      if (this.stick.active && (ev.pointerId === undefined || ev.pointerId === this.stick.pointerId)) {
        this.stick.active = false;
        this.stick.pointerId = -1;
        this.moveX = 0;
        this.moveY = 0;
      }
    };

    c.addEventListener('pointerdown', this.onDown, { passive: false });
    c.addEventListener('pointermove', this.onMove, { passive: false });
    globalThis.addEventListener('pointerup', this.onUp);
    globalThis.addEventListener('pointercancel', this.onUp);

    // Le jeu occupe tout l'ecran : pas de zoom pincé, pas de double-tap
    // qui Selectionne, pas de pull-to-refresh pendant une partie.
    const kill = (e) => e.preventDefault();
    c.addEventListener('touchstart', kill, { passive: false });
    c.addEventListener('gesturestart', kill, { passive: false });
    c.addEventListener('contextmenu', kill);

    this.onKeyDown = (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space') this.queue.dodge = true;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.queue.ability = true;
      if (e.code === 'KeyQ' || e.code === 'KeyF') this.queue.heal = true;
    };
    this.onKeyUp = (e) => this.keys.delete(e.code);
    globalThis.addEventListener('keydown', this.onKeyDown);
    globalThis.addEventListener('keyup', this.onKeyUp);
  }

  buttonAt(p) {
    for (const key of ['dodge', 'ability', 'heal']) {
      const b = this.buttons[key];
      if (!b) continue;
      if (Math.hypot(p.x - b.x, p.y - b.y) <= b.r * 1.25) return b;
    }
    return null;
  }

  updateStick(p) {
    const s = this.stick;
    const dx = p.x - s.originX;
    const dy = p.y - s.originY;
    const len = Math.hypot(dx, dy);
    const dead = s.radius * DEAD_ZONE;
    let nx = 0;
    let ny = 0;
    if (len > dead) {
      // Re-mappe pour que la zone morte ne « vole » de l'amplitude :
      // au-dela de la zone morte, la reponse est lineaire jusqu'a 1.
      const mag = clamp((len - dead) / (s.radius - dead), 0, 1);
      nx = (dx / len) * mag * this.sensitivity;
      ny = (dy / len) * mag * this.sensitivity;
      const m = Math.hypot(nx, ny);
      if (m > 1) {
        nx /= m;
        ny /= m;
      }
    }
    s.knobX = s.originX + (dx / (len || 1)) * s.radius;
    s.knobY = s.originY + (dy / (len || 1)) * s.radius;
    this.moveX = nx;
    this.moveY = ny;
    this.aim = this.buttons.ability?.pressed ?? false;
  }

  /** Etat consomme par un pas de simulation. Les edges sont uniques. */
  sample() {
    let kx = 0;
    let ky = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) ky -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) ky += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) kx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) kx += 1;
    if (kx || ky) {
      const m = Math.hypot(kx, ky);
      this.moveX = kx / m;
      this.moveY = ky / m;
    }

    const out = {
      moveX: this.moveX,
      moveY: this.moveY,
      dodge: this.queue.dodge || this.buttons.dodge?.pressed || this.keys.has('Space'),
      ability: this.queue.ability || this.buttons.ability?.pressed,
      heal: this.queue.heal || this.buttons.heal?.pressed || this.keys.has('KeyQ'),
    };
    this.queue.dodge = false;
    this.queue.ability = false;
    this.queue.heal = false;
    return out;
  }

  setCooldowns(dodgeCd, dodgeMax, abilityCd, abilityMax, healCd, healMax) {
    if (this.buttons.dodge) {
      this.buttons.dodge.cooldown = dodgeCd;
      this.buttons.dodge.cooldownMax = dodgeMax;
    }
    if (this.buttons.ability) {
      this.buttons.ability.cooldown = abilityCd;
      this.buttons.ability.cooldownMax = abilityMax;
    }
    if (this.buttons.heal) {
      this.buttons.heal.cooldown = healCd;
      this.buttons.heal.cooldownMax = healMax;
    }
  }

  releaseAll() {
    this.stick.active = false;
    this.moveX = 0;
    this.moveY = 0;
    for (const b of Object.values(this.buttons)) if (b) b.pressed = false;
    this.pressed.clear();
  }

  destroy() {
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    globalThis.removeEventListener('pointerup', this.onUp);
    globalThis.removeEventListener('pointercancel', this.onUp);
    globalThis.removeEventListener('keydown', this.onKeyDown);
    globalThis.removeEventListener('keyup', this.onKeyUp);
  }
}

export { STICK_RADIUS, DEAD_ZONE };