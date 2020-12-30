import * as THREE from '/deps/three/build/three.module.js'
import { GLTFLoader } from '/deps/three/examples/jsm/loaders/GLTFLoader.js'
import Service from '/space/js/Service.js'

const materials = {
  lowPoly: new THREE.ShaderMaterial( {
    side: THREE.DoubleSide,
    uniforms: {
      color: { value: new THREE.Color(1, 0, 0) },
    },
    vertexShader: `
      varying vec3 pp;
      varying vec3 norm;

      void main() {
        pp = position;
        norm = normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }
    `,

    fragmentShader: `
      #include <common>

      varying vec3 pp;
      varying vec3 norm;
      uniform vec3 color;
      void main() {
        float spooky = max(dot(norm, normalize(vec3(0, 100, 0) - pp)), 0.);
        gl_FragColor = vec4(color * 0.1 + color * clamp(1.-pow(1.-spooky, 10.), 0., 1.) * 0.9, 1.);
      }
    `,
  } ),
  desert: new THREE.ShaderMaterial( {
    side: THREE.DoubleSide,
    uniforms: {
      t: { value: 0 },
      color: { value: new THREE.Color(1, 0, 0) },
    },
    vertexShader: `
      varying vec3 pp;
      varying vec3 norm;

      void main() {
        pp = (modelMatrix * vec4(position, 1.)).xyz;
        norm = normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }
    `,

    fragmentShader: `
      #include <common>

      // https://stackoverflow.com/questions/15095909/from-rgb-to-hsv-in-opengl-glsl
      vec3 rgb2hsv(vec3 c) {
          vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
          vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
          vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

          float d = q.x - min(q.w, q.y);
          float e = 1.0e-10;
          return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
      }

      vec3 hsv2rgb(vec3 c)
      {
          vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
          vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
          return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
      }

      vec4 mulHsv(vec4 c, vec3 hsv) {
        return vec4(hsv2rgb(rgb2hsv(c.rgb) * hsv), c.a);
      }

      vec4 addHsv(vec4 c, vec3 add) {
        vec3 hsv = rgb2hsv(c.rgb);
        hsv[0] += add[0];
        hsv[1] = min(hsv[1], hsv[1] + add[1]);
        hsv[2] += add[2];
        return vec4(hsv2rgb(hsv), c.a);
      }

      vec4 hsv(float h, float s, float v) {
        return vec4(hsv2rgb(vec3(h, s, v)), 1.);
      }

      varying vec3 pp;
      varying vec3 norm;
      uniform float t;
      uniform vec3 color;
      void main() {
        float spooky = max(dot(norm, normalize(vec3(0, 70, 0) - pp)), 0.);
        gl_FragColor = vec4(color * 0.3 + 0.7 * color * clamp(1.-pow(1.-spooky, 1.), 0., 1.) * 0.9, 1.);
        // gl_FragColor *= vec4(pow(dot(normalize(pp) + norm, normalize(vec3(0, 1, 0))), 1.));
        float yeet = clamp(sin(dot(normalize(norm), vec3(0, 0, 1)) * 10. - t), 0., 1.);
        gl_FragColor = addHsv(gl_FragColor, vec3((yeet/2.+.5) * 0.4, 0., 0.));
      }
    `,
  } ),
  phong: new THREE.MeshPhongMaterial(),
  lambert: new THREE.MeshLambertMaterial(),
};

export default class GLTF {
  constructor(params, globals) {
    this.params = params;
    this.group = new THREE.Group();
  }
  async load(params, globals) {
    const [gltf, map, normal_map] = await Promise.all([
      new Promise((resolve, reject) => {
        new GLTFLoader().load(params.url, resolve, null, reject);
      }),
      params.map ? globals.texturePool.get(params.map) : null,
      params.normal_map ? globals.texturePool.get(params.normal_map) : null,
    ]);
    this.gltf = gltf;

    if (params.material) {
      const material = this.material = materials[params.material].clone();
      if (params.color) {
        if (material.uniforms)
          material.uniforms.color.value.setRGB(...params.color);
        else
          material.color.setRGB(...params.color);
      }
      if (params.emissive)
        material.emissive.setRGB(...params.emissive);
      if (map) {
        material.map = map;
        material.needsUpdate = true;
      }
      if (normal_map) {
        material.normalMap = normal_map;
        material.needsUpdate = true;
      }
      gltf.scene.traverse((o) => {
        if (o.isMesh)
          o.material = material;
      });
    }
    this.group.add(gltf.scene);
  }
  update() {
    if (this.params.material == 'desert' && this.material) {
      this.material.uniforms.t.value = (+new Date() / 1000) % 10000;
    }
  }
}
