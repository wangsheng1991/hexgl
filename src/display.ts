// -------------------------------------------------------------------------------------------------
// The Display draws to the main canvas and manages all Filament entities.
//
//   - constructor(canvas: HTMLCanvasElement)
//   - readonly camera: Filament.Camera;
//   - render(vehicleMatrix: mat4)
//
// HexGL by Thibaut 'BKcore' Despoulain <http://bkcore.com>
// Rewritten by Philip Rideout <https://prideout.net>
// -------------------------------------------------------------------------------------------------

import "./filament";

import * as urls from "./urls";

import { mat4 } from "gl-matrix";

export default class Display {

    public readonly camera: Filament.Camera;
    private canvas: HTMLCanvasElement;
    private engine: Filament.Engine;
    private scene: Filament.Scene;
    private skybox: Filament.Skybox;
    private indirectLight: Filament.IndirectLight;
    private view: Filament.View;
    private swapChain: Filament.SwapChain;
    private renderer: Filament.Renderer;
    private sampler: Filament.TextureSampler;
    private material: Filament.Material;
    private ship: Filament.Entity;

    constructor(canvas) {
        this.canvas = canvas;
        this.engine = Filament.Engine.create(canvas);
        this.scene = this.engine.createScene();
        this.skybox = this.engine.createSkyFromKtx(urls.skySmall);
        this.scene.setSkybox(this.skybox);
        this.indirectLight = this.engine.createIblFromKtx(urls.ibl);
        this.indirectLight.setIntensity(100000);
        this.scene.setIndirectLight(this.indirectLight);
        this.swapChain = this.engine.createSwapChain();
        this.renderer = this.engine.createRenderer();
        this.camera = this.engine.createCamera();
        this.view = this.engine.createView();
        this.view.setCamera(this.camera);
        this.view.setScene(this.scene);

        this.sampler = new Filament.TextureSampler(
            Filament.MinFilter.LINEAR_MIPMAP_LINEAR, Filament.MagFilter.LINEAR,
            Filament.WrapMode.REPEAT);

        this.material = this.engine.createMaterial(urls.tracksMaterial);

        // Load the high-res skybox only after every other asset has been loaded.
        const addEntity = (entity) => {
            this.scene.addEntity(entity);
            if (5 === this.scene.getRenderableCount()) {
                Filament.fetch([urls.skyLarge], () => {
                    this.engine.destroySkybox(this.skybox);
                    this.skybox = this.engine.createSkyFromKtx(urls.skyLarge);
                    this.scene.setSkybox(this.skybox);
                });
            }
        };

        const filenames = [urls.diffuse, urls.specular, urls.normal, urls.mesh];
        const shipmi = this.material.createInstance();
        const asset = "ship";
        const assetUrls = filenames.map((path) => `${asset}/${path}`);

        // Load the ship first since it determines camera, then all other assets.
        Filament.fetch(assetUrls, () => {
            this.ship = this.createRenderable(asset, shipmi);
            addEntity(this.ship);
            for (const bgasset of ["tracks", "scrapers1", "scrapers2"]) {
                const bgurls = filenames.map((path) => `${bgasset}/${path}`);
                Filament.fetch(bgurls, () => {
                    const bgmi = this.material.createInstance();
                    addEntity(this.createRenderable(bgasset, bgmi));
                });
            }
        });

        const sunlight = Filament.EntityManager.get().create();
        Filament.LightManager.Builder(Filament.LightManager$Type.SUN)
            .color([0.98, 0.92, 0.89])
            .intensity(110000.0)
            .direction([0.5, -1, 0])
            .build(this.engine, sunlight);
        addEntity(sunlight);

        this.resize = this.resize.bind(this);
        window.addEventListener("resize", this.resize);
        this.resize();
    }

    public render(vehicleMatrix: mat4) {
        if (this.ship) {
            const tcm = this.engine.getTransformManager();
            const inst = tcm.getInstance(this.ship);
            tcm.setTransform(inst, vehicleMatrix as unknown as number[]);
            inst.delete();
        }
        this.renderer.render(this.swapChain, this.view);
    }

    private resize() {
        const dpr = window.devicePixelRatio;
        const width = this.canvas.width = window.innerWidth * dpr;
        const height = this.canvas.height = window.innerHeight * dpr;
        this.view.setViewport([0, 0, width, height]);

        const aspect = width / height;
        const Fov = Filament.Camera$Fov;
        const fov = aspect < 1 ? Fov.HORIZONTAL : Fov.VERTICAL;
        this.camera.setProjectionFov(45, aspect, 1.0, 20000.0, fov);
    }

    private createRenderable(name, matinstance) {
        const diffuse = this.engine.createTextureFromJpeg(`${name}/${urls.diffuse}`);
        const specular = this.engine.createTextureFromJpeg(`${name}/${urls.specular}`);
        const normal = this.engine.createTextureFromJpeg(`${name}/${urls.normal}`);
        matinstance.setTextureParameter("diffuse", diffuse, this.sampler);
        matinstance.setTextureParameter("specular", specular, this.sampler);
        matinstance.setTextureParameter("normal", normal, this.sampler);
        return this.engine.loadFilamesh(`${name}/${urls.mesh}`, matinstance, {}).renderable;
    }
}
