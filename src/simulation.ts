// Based on HexGL by Thibaut 'BKcore' Despoulain <http://bkcore.com>

import Sampler from "./sampler";

import { mat3, mat4, quat, vec3, vec4 } from "gl-matrix";

// Listens to input events and periodically updates a matrix representing the vehicle's position and
// orientation. Looks at two images (collision / elevation) to glean information about the race
// track. Public methods:
//
//   - tick(dt: number)
//   - getMatrix(): mat4
//   - resetPosition(pos: vec3)
//
export default class Simulation {
    private readonly vehicleMatrix: mat4;
    private readonly dummyMatrix: mat4;
    private readonly collision: Sampler;
    private readonly elevation: Sampler;
    private readonly keyState: KeyState;
    private active: boolean;
    private destroyed: boolean;
    private falling: boolean;

    private movement: vec3;
    private rotation: vec3;
    private roll: number;
    private rollAxis: vec3;
    private drift: number;
    private speed: number;
    private speedRatio: number;
    private boost: number;
    private shield: number;
    private angular: number;
    private quaternion: quat;
    private collisionPixelRatio: number;
    private collisionDetection: boolean;
    private collisionPreviousPosition: vec3;
    private heightPixelRatio: number;
    private heightBias: number;
    private heightLerp: number;
    private heightScale: number;

    private readonly rollAngle: number;
    private readonly rollLerp: number;
    private readonly rollDirection: vec3;

    private gradient: number;
    private gradientTarget: number;
    private gradientLerp: number;
    private gradientScale: number;
    private gradientVector: vec3;
    private tilt: number;
    private tiltTarget: number;
    private tiltLerp: number;
    private tiltScale: number;
    private tiltVector: vec3;
    private repulsionVLeft: vec3;
    private repulsionVRight: vec3;
    private repulsionVFront: vec3;
    private repulsionVScale: number;
    private repulsionAmount: number;
    private repulsionForce: vec3;
    private fallVector: vec3;
    private collisionState: CollisionState

    constructor(canvas: HTMLElement, collision: Sampler, elevation: Sampler) {
        this.vehicleMatrix = mat4.create();
        this.dummyMatrix = mat4.create();
        this.collision = collision;
        this.elevation = elevation;
        this.keyState = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            ltrigger: false,
            rtrigger: false,
            use: false
        };
        document.addEventListener('keydown', this.onKeyDown.bind(this));
        document.addEventListener('keyup', this.onKeyUp.bind(this));

        this.active = true;
        this.destroyed = false;
        this.falling = false;
        this.movement = vec3.fromValues(0,0,0);
        this.rotation = vec3.fromValues(0,0,0);
        this.roll = 0.0;
        this.rollAxis = vec3.create();
        this.drift = 0.0;
        this.speed = 0.0;
        this.speedRatio = 0.0;
        this.boost = 0.0;
        this.shield = 1.0;
        this.angular = 0.0;
        this.quaternion = quat.create();
        this.collisionPixelRatio = 1.0;
        this.collisionDetection = false;
        this.collisionPreviousPosition = vec3.create();
        this.heightPixelRatio = 1.0;
        this.heightBias = 0.0;
        this.heightLerp = 0.4;
        this.heightScale = 1.0;
        this.rollAngle = 0.6;
        this.rollLerp = 0.08;
        this.rollDirection = vec3.fromValues(0, 0, 1);
        this.gradient = 0.0;
        this.gradientTarget = 0.0;
        this.gradientLerp = 0.05;
        this.gradientScale = 4.0;
        this.gradientVector = vec3.fromValues(0, 0, 5);
        this.tilt = 0.0;
        this.tiltTarget = 0.0;
        this.tiltLerp = 0.05;
        this.tiltScale = 4.0;
        this.tiltVector = vec3.fromValues(5, 0, 0);
        this.repulsionVLeft = vec3.fromValues(1,0,0);
        this.repulsionVRight = vec3.fromValues(-1, 0, 0);
        this.repulsionVFront = vec3.fromValues(0, 0, 1);
        this.repulsionVScale = 4.0;
        this.repulsionAmount = 0.0;
        this.repulsionForce = vec3.create();

        // this.resetPos = null;
        // this.resetRot = null;

        this.collisionState = {
            front: false,
            left: false,
            right: false
        };
    }

    public resetPosition(pos: vec3) {
        mat4.fromTranslation(this.vehicleMatrix, pos);
        mat4.fromTranslation(this.dummyMatrix, pos);
    }

    public getMatrix(): mat4 {
        return this.vehicleMatrix;
    }

    public tick(dt: number) {
        if (this.falling) {
            mat4.translate(this.vehicleMatrix, this.vehicleMatrix, this.fallVector);
            return;
        }

        this.rotation[1] = 0;
        vec3.set(this.movement, 0, 0, 0);
        this.drift = -this.drift * driftLerp;
        this.angular = -this.angular * angularLerp * .5;

        let rollAmount = 0;
        let angularAmount = 0;
        let yawLeap = 0;

        if (this.active) {
            if (this.keyState.left) {
                angularAmount += angularSpeed * dt;
                rollAmount -= this.rollAngle;
            }
            if (this.keyState.right) {
                angularAmount -= angularSpeed * dt;
                rollAmount += this.rollAngle;
            }

            if (true || this.keyState.forward) {
                this.speed += thrust * dt;
            } else {
                this.speed -= airResist * dt;
            }

            if (this.keyState.ltrigger) {
                if (this.keyState.left) {
                    angularAmount += airAngularSpeed * dt;
                } else {
                    angularAmount += airAngularSpeed * .5 * dt;
                }
                this.speed -= airBrake * dt;
                this.drift += (airDrift - this.drift) * driftLerp;
                this.movement[0] += this.speed * this.drift * dt;
                if (this.drift > 0) {
                    this.movement[2] -= this.speed * this.drift * dt;
                }
                rollAmount -= this.rollAngle * .7;
            }

            if (this.keyState.rtrigger) {
                if (this.keyState.right) {
                    angularAmount -= airAngularSpeed * dt;
                } else {
                    angularAmount -= airAngularSpeed * .5 * dt;
                }
                this.speed -= airBrake * dt;
                this.drift += (-airDrift - this.drift) * driftLerp;
                this.movement[0] += this.speed * this.drift * dt;
                if (this.drift < 0) {
                    this.movement[2] += this.speed * this.drift * dt;
                }
                rollAmount += this.rollAngle * .7;
            }
        }

        this.angular += (angularAmount - this.angular) * angularLerp;
        this.rotation[1] = this.angular;

        this.speed = Math.max(0, Math.min(this.speed, maxSpeed));
        this.speedRatio = this.speed / maxSpeed;
        this.movement[2] += this.speed * dt;

        if (vec3.equals(this.repulsionForce, zero3)) {
            vec3.copy(this.repulsionForce, zero3);
        } else {
            if (this.repulsionForce[2] != 0) {
                this.movement[2] = 0;
            }
            vec3.add(this.movement, this.movement, this.repulsionForce);
            const t = dt > 1.5 ? repulsionLerp * 2 : repulsionLerp;
            vec3.lerp(this.repulsionForce, this.repulsionForce, zero3, t);
        }

        mat4.getTranslation(this.collisionPreviousPosition, this.dummyMatrix);
        // this.boosterCheck(dt);

        const txz = vec3.fromValues(this.movement[0], 0, this.movement[2]);
        mat4.translate(this.dummyMatrix, this.dummyMatrix, txz);
        // this.heightCheck(dt);

        const ty = vec3.fromValues(0, this.movement[1], 0);
        mat4.translate(this.dummyMatrix, this.dummyMatrix, ty);
        // this.collisionCheck(dt);

        quat.set(this.quaternion, this.rotation[0], this.rotation[1], this.rotation[2], 1);
        quat.normalize(this.quaternion, this.quaternion);
        const dummyquat = quat.create();
        mat4.getRotation(dummyquat, this.dummyMatrix);
        quat.multiply(dummyquat, dummyquat, this.quaternion);

        const dummypos = vec3.create();
        mat4.getTranslation(dummypos, this.dummyMatrix);
        mat4.fromRotationTranslation(this.dummyMatrix, dummyquat, dummypos);

        // Finally, forumulate the final transformation matrix.
        const xform = this.vehicleMatrix;
        mat4.identity(xform);

        // Gradient
        const gradientDelta = (this.gradientTarget - (yawLeap + this.gradient)) * this.gradientLerp;
        if (Math.abs(gradientDelta) > epsilon) {
            this.gradient += gradientDelta;
        }
        if (Math.abs(this.gradient) > epsilon) {
            mat4.rotate(xform, xform, this.gradient, gradientAxis);
        }

        // Tilting
        const tiltDelta = (this.tiltTarget - this.tilt) * this.tiltLerp;
        if (Math.abs(tiltDelta) > epsilon) {
            this.tilt += tiltDelta;
        }
        if (Math.abs(this.gradient) > epsilon) {
            mat4.rotate(xform, xform, this.tilt, tiltAxis);
        }

        // Rolling
        const rollDelta = (rollAmount - this.roll) * this.rollLerp;
        if (Math.abs(rollDelta) > epsilon) {
            this.roll += rollDelta;
        }
        if (Math.abs(this.gradient) > epsilon) {
            vec3.copy(this.rollAxis, this.rollDirection);
            mat4.rotate(xform, xform, this.roll, this.rollAxis);
        }

        mat4.multiply(xform, xform, this.dummyMatrix);
    }

    private onKeyDown(event) {
        const key = this.keyState;
        switch(event.keyCode) {
            case 38: /*up*/ key.forward = true; break;
            case 40: /*down*/ key.backward = true; break;
            case 37: /*left*/ key.left = true; break;
            case 39: /*right*/ key.right = true; break;
            case 81: /*Q*/ key.ltrigger = true; break;
            case 65: /*A*/ key.ltrigger = true; break;
            case 68: /*D*/ key.rtrigger = true; break;
            case 69: /*E*/ key.rtrigger = true; break;
        }
    }

    private onKeyUp(event) {
        const key = this.keyState;
        switch(event.keyCode) {
            case 38: /*up*/ key.forward = false; break;
            case 40: /*down*/ key.backward = false; break;
            case 37: /*left*/ key.left = false; break;
            case 39: /*right*/ key.right = false; break;
            case 81: /*Q*/ key.ltrigger = false; break;
            case 65: /*A*/ key.ltrigger = false; break;
            case 68: /*D*/ key.rtrigger = false; break;
            case 69: /*E*/ key.rtrigger = false; break;
        }
    }
}


interface KeyState {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    ltrigger: boolean;
    rtrigger: boolean;
    use: boolean;
}

interface CollisionState {
    front: boolean;
    left: boolean;
    right: boolean;
}

const epsilon = 0.00000001;
const zero3 = vec3.create();
const airResist = 0.02;
const airDrift = 0.1;
const thrust = 0.02;
const airBrake = 0.02;
const maxSpeed = 7.0;
const boosterSpeed = this.maxSpeed * 0.2;
const boosterDecay = 0.01;
const angularSpeed = 0.005;
const airAngularSpeed = 0.0065;
const repulsionRatio = 0.5;
const repulsionCap = 2.5;
const repulsionLerp = 0.1;
const collisionSpeedDecrease = 0.8;
const collisionSpeedDecreaseCoef = 0.8;
const maxShield = 1.0;
const shieldDelay = 60;
const shieldTiming = 0;
const shieldDamage = 0.25;
const driftLerp = 0.35;
const angularLerp = 0.35;
const fallVector = vec3.fromValues(0, -20, 0);
const gradientAxis = vec3.fromValues(1, 0, 0);
const tiltAxis = vec3.fromValues(0, 0, 1);
