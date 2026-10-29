import * as Phaser from '../../../vendor/phaser.esm.min.js';
import { DEPTH } from '../constants.js';

const FEET_OFFSET = 56;

export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, feetY, tuning) {
    super(scene, x, feetY - FEET_OFFSET, 'green_idle');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.tuning = tuning;
    this.setDepth(DEPTH.player);
    this.setOrigin(0.5, 0.5);
    this.setBodySize(34, 82);
    this.setOffset(31, 30);
    this.setCollideWorldBounds(true);
    this.setMaxVelocity(tuning.speed, 1100);
    this.setDragX(0);
    this.setBounce(0, 0);

    this.lastGroundedAt = -Infinity;
    this.jumpBufferedAt = -Infinity;
    this.jumpCut = false;
    this.wasGrounded = false;
    this.hurtUntil = 0;
    this.play('player-idle');
  }

  get feetY() {
    return this.y + FEET_OFFSET;
  }

  update(time, delta, input) {
    if (!this.body || !this.active) return;

    const grounded = this.body.blocked.down || this.body.touching.down;
    if (grounded) this.lastGroundedAt = time;
    if (grounded && !this.wasGrounded) {
      this.jumpCut = false;
      this.scene.onPlayerLand?.();
      if (Math.abs(this.body.velocity.y) > 260) this.squash();
    }
    this.wasGrounded = grounded;

    let direction = 0;
    if (input.left) direction -= 1;
    if (input.right) direction += 1;

    // Drag only while there is no input, otherwise acceleration and drag fight
    // each other and the character feels sluggish.
    if (direction !== 0) {
      this.setDragX(0);
      this.setAccelerationX(direction * this.tuning.acceleration);
      this.setFlipX(direction < 0);
    } else {
      this.setAccelerationX(0);
      this.setDragX(this.tuning.drag);
    }

    if (input.jumpPressed) this.jumpBufferedAt = time;

    const canCoyote = time - this.lastGroundedAt <= this.tuning.coyoteMs;
    const buffered = time - this.jumpBufferedAt <= this.tuning.jumpBufferMs;
    if (buffered && canCoyote) {
      this.setVelocityY(-this.tuning.jumpVelocity);
      this.lastGroundedAt = -Infinity;
      this.jumpBufferedAt = -Infinity;
      this.jumpCut = false;
      this.scene.onPlayerJump?.();
      this.stretch();
    }

    // Releasing the jump key early gives a shorter hop.
    if (!input.jumpHeld && this.body.velocity.y < -260 && !this.jumpCut) {
      this.setVelocityY(this.body.velocity.y * 0.52);
      this.jumpCut = true;
    }

    if (time < this.hurtUntil) {
      if (this.anims.currentAnim?.key !== 'player-hit') this.play('player-hit', true);
      return;
    }

    if (!grounded) {
      if (this.anims.currentAnim?.key !== 'player-jump') this.play('player-jump', true);
    } else if (Math.abs(this.body.velocity.x) > 24) {
      if (this.anims.currentAnim?.key !== 'player-walk') this.play('player-walk', true);
    } else if (this.anims.currentAnim?.key !== 'player-idle') {
      this.play('player-idle', true);
    }
  }

  stretch() {
    this.scene.tweens.killTweensOf(this);
    this.setScale(0.97, 1.06);
    this.scene.tweens.add({
      targets: this,
      scaleX: 1,
      scaleY: 1,
      duration: 150,
      ease: 'Quad.easeOut',
    });
  }

  squash() {
    this.scene.tweens.killTweensOf(this);
    this.setScale(1.07, 0.93);
    this.scene.tweens.add({
      targets: this,
      scaleX: 1,
      scaleY: 1,
      duration: 110,
      ease: 'Quad.easeOut',
    });
  }

  hurt() {
    this.hurtUntil = this.scene.time.now + 420;
    this.play('player-hit', true);
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(90, () => this.clearTint());
  }

  freeze() {
    this.setAccelerationX(0);
    this.setDragX(0);
    this.setVelocity(0, 0);
    this.play('player-idle', true);
  }

  respawn(x, feetY) {
    this.setPosition(x, feetY - FEET_OFFSET);
    this.setVelocity(0, 0);
    this.setAccelerationX(0);
    this.setDragX(0);
    this.hurtUntil = 0;
    this.jumpCut = false;
    this.play('player-idle', true);
  }
}
