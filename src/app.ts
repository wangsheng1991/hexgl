// -------------------------------------------------------------------------------------------------
// The App owns the Display and Simulation.
//
// HexGL by Thibaut 'BKcore' Despoulain <http://bkcore.com>
// Rewritten by Philip Rideout <https://prideout.net>
// -------------------------------------------------------------------------------------------------

import * as urls from "./urls";

import { glMatrix, vec3 } from "gl-matrix";

import ChaseCamera from "./chasecam";
import Display from "./display";
import Sampler from "./sampler";
import Simulation from "./simulation";

const initialVehiclePosition = vec3.fromValues(-1134 * 2, 400, -886);

Filament.init([urls.skySmall, urls.ibl, urls.tracksMaterial ], () => {
    // HexGL requires 64-bit precision and fast instantiation of vectors.
    glMatrix.setMatrixArrayType(Array);
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
        const collision = new Sampler(urls.collision);
        const elevation = new Sampler(urls.elevation);
        this.simulation = new Simulation(collision, elevation);
        this.simulation.resetPosition(initialVehiclePosition);
        this.chasecam = new ChaseCamera(this.display.camera, this.simulation.getVehicle());
        this.tick = this.tick.bind(this);
        this.time = null;
        window.requestAnimationFrame(this.tick);
    }

    private tick() {
        // Determine the time step.
        const time = Date.now();
        if (this.time === null) {
            this.time = time;
        }
        const dt = (time - this.time) * 0.1;
        this.time = time;

        // Update the vehicle orientation and position.
        this.simulation.tick(dt);

        // Update the camera position.
        this.chasecam.tick(dt, this.simulation.getNormalizedSpeed());

        // Render the 3D scene.
        this.display.render(this.simulation.getVehicle().getMatrix());

        // Request the next frame.
        window.requestAnimationFrame(this.tick);
    }
}
