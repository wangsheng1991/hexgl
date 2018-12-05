// -------------------------------------------------------------------------------------------------
// The App owns the Display and Simulation.
//
// HexGL by Thibaut 'BKcore' Despoulain <http://bkcore.com>
// Rewritten by Philip Rideout <https://prideout.net>
// -------------------------------------------------------------------------------------------------

import * as urls from "./urls";

import { createWorker, ITypedWorker } from "typed-web-workers";
import { mat4, vec3 } from "gl-matrix";

import ChaseCamera from "./chasecam";
import Display from "./display";
import Sampler from "./sampler";
import Simulation from "./simulation";

const initialVehiclePosition = vec3.fromValues(-1134 * 2, 400, -886);
const vehicleMatrix = mat4.create();

Filament.init([urls.skySmall, urls.ibl, urls.tracksMaterial ], () => {
    // The global app instance can be accessed for debugging purposes only.
    window["app"] = new App();
});

class App {
    private readonly display: Display;
    private readonly chasecam: ChaseCamera;
    private simulation: Simulation;
    private time: number;

    constructor() {
        const canvas = document.getElementsByTagName("canvas")[0];
        this.display = new Display(canvas);
        this.chasecam = new ChaseCamera(this.display.camera, vehicleMatrix);
        (() => {
            let k = 0;
            const onload = () => {
                if (++k === 2) {
                    this.simulation = new Simulation(canvas, collision, elevation);
                    this.simulation.resetPosition(initialVehiclePosition);
                }
            };
            const collision = new Sampler(urls.collision, onload);
            const elevation = new Sampler(urls.elevation, onload);
        })();
        this.tick = this.tick.bind(this);
        window.requestAnimationFrame(this.tick);
    }

    private tick() {
        const time = Date.now();
        if (this.time === null) {
            this.time = time;
        }
        const dt = (time - this.time) * 0.1;
        this.time = time;
        if (this.simulation) {
            this.simulation.tick(dt);
            mat4.copy(vehicleMatrix, this.simulation.vehicleMatrix);
            this.chasecam.tick(dt);
        }
        this.display.render(vehicleMatrix);
        window.requestAnimationFrame(this.tick);
    }
}

interface Values {
    x: number;
    y: number;
}

function workFn(input: Values, callback: (_: number) => void): void {
    callback(input.x + input.y);
}

function logFn(result: number) {
    console.log(`We received this response from the worker: ${result}`);
}

const typedWorker: ITypedWorker<Values, number> = createWorker(workFn, logFn);

typedWorker.postMessage({ x: 5, y: 5 });
