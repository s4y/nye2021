import * as THREE from '/deps/three/build/three.module.js'

export default class GLTF {
  constructor(params, globals) {
    this.group = new THREE.Group();
  }

  async load(params, globals) {
    const material = this.material = new THREE.ShaderMaterial( {
      uniforms: {
        t: { value: 0 },
        sf_t: { value: globals.freqTex },
      },
      vertexShader: `
        varying vec2 p;

        void main() {
          p = uv*2.-1.;
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }
      `,

      fragmentShader: `
        varying vec2 p;
        uniform float t;
        uniform sampler2D sf_t;

        float sf(float x) {
          return texture2D(sf_t, vec2(x, 0.))[0];
        }

        void main() {
          float bri = sin(p.x * p.y * 10. + t);
          gl_FragColor = vec4(bri, bri, sf(abs(p.x)), 1);
        }
      `,
    });

    const mesh = this.mesh = new THREE.Mesh(
      new THREE.BoxBufferGeometry(5, 5, 5),
      material);
    mesh.position.y = 6;
    this.group.add(mesh);

    mesh.onBeforeRender = () => {
      const now = this.now();
      material.uniforms.t.value = now;
      mesh.rotation.y = now / 10;
      mesh.rotation.x = now / 9;
    };

  }
  now() {
    return (Date.now()/1000) % (1 << 15) - (1 << 14);
  }
  // update() {
  // }
  // destroy() {
  // }
}
