import * as THREE from '/deps/three/build/three.module.js'
import { GLTFLoader } from '/deps/three/examples/jsm/loaders/GLTFLoader.js'
import { SubdivisionModifier } from '/deps/SubdivisionModifier.js';
import Service from '/space/js/Service.js'

export default class VJ {
  constructor(params, globals) {
    this.params = params;
    this.group = new THREE.Group();

    this.vjEl = globals.vjEl;
    this.resizeCb = () => this.resize();
    this.vjEl.addEventListener('resize', this.resizeCb);
    this.vjEl.addEventListener('ended', this.resizeCb);
    this.vjEl.addEventListener('emptied', this.resizeCb);
    this.vjEl.addEventListener('loadedmetadata', this.resizeCb);
  }
  async load(params, globals) {
    const mesh = this.mesh = new THREE.Mesh(
      new THREE.PlaneBufferGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: globals.vjTex,
      }));
    mesh.material.side = THREE.DoubleSide;
    this.group.add(mesh);
    this.resize();
  }
  resize() {
    if (this.vjEl.srcObject) {
      const height = 50 * (this.vjEl.videoHeight || 1) / (this.vjEl.videoWidth || 1) * 0.75;
      this.mesh.geometry = new THREE.CylinderBufferGeometry(50, 50, height, 64, 1, true, Math.PI * 0.5, 0.625);
      this.mesh.rotation.y = Math.PI;
      this.mesh.position.x = 50;
      this.mesh.position.y = height / 2;
      this.mesh.visible = true;
    } else {
      this.mesh.visible = false;
    }
  }
  destroy() {
    this.vjEl.removeEventListener('resize', this.resizeCb);
    this.vjEl.removeEventListener('ended', this.resizeCb);
    this.vjEl.addEventListener('emptied', this.resizeCb);
    this.vjEl.removeEventListener('loadedmetadata', this.resizeCb);
  }
}
