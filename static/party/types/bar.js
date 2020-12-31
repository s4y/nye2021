import * as THREE from '/deps/three/build/three.module.js'
import { GLTFLoader } from '/deps/three/examples/jsm/loaders/GLTFLoader.js'

export default class GLTF {
  constructor(params, globals) {
    this.group = new THREE.Group();
    this.globals = globals;
  }

  async load(params, globals) {
    const gltf = await new Promise((resolve, reject) => {
      new GLTFLoader().load(params.url, resolve, null, reject);
    });

    gltf.scene.scale.setScalar(6);

    const makeLight = (where, color, intensity) => {
      const light = new THREE.PointLight(0xffffff, intensity, 100);
      // const marker = new THREE.Mesh(
      //   new THREE.BoxBufferGeometry(0.1, 0.1, 0.1),
      //   new THREE.MeshBasicMaterial({ color: 0xff0000 }));
      // light.add(marker);
      light.position.set(...where);
      light.color.setHSL(...color);
      return light;
    };

    this.group.add(makeLight([0, 17, 0], [0.15, .4, .8], 6));

    for (let max=12, i = 0; i < max; i++) {
      const angle = i/max*Math.PI*2;
      const dist = 5.4;
      this.group.add(makeLight([Math.cos(angle)*dist, 11, Math.sin(angle)*dist], [0.07, 1., .8], 3));
    }

    this.group.add(gltf.scene);
    this.cubelight = gltf.scene.getObjectByName('cubelight');
    this.cubelight.material.color.setRGB(0.2, 0.2, 0.2);
  }
  now() {
    return (Date.now()/1000) % (1 << 15) - (1 << 14);
  }
  update() {
    const now = this.now();
    if (this.cubelight) {
      this.cubelight.rotation.y += 0.005;
      this.cubelight.rotation.x += 0.004;
      this.cubelight.material.emissive.setHSL(0.15, .9, .8 - Math.pow(this.globals.freqData[1] / 255, 4.) * 0.5);
    }
  }
  // destroy() {
  // }
}
