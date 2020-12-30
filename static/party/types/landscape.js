import * as THREE from '/deps/three/build/three.module.js'
import { GLTFLoader } from '/deps/three/examples/jsm/loaders/GLTFLoader.js'
import { SubdivisionModifier } from '/deps/SubdivisionModifier.js';
import Service from '/space/js/Service.js'

const shaderCommon = `
  uniform float ripple;
  uniform float t;
  uniform sampler2D map;
  uniform sampler2D sf_t;
  uniform vec3 color;
  uniform vec3 ripplePosition;
  uniform float rippleAmt;
  uniform float glowAmt;
  uniform float gridAmt;
  uniform float houseLightsAmt;
  uniform float accentLightsAmt;
  varying vec2 vUv;
  varying vec3 mp;
  varying vec3 norm;
  varying vec3 pp;
  varying vec3 reflection;
  varying vec3 vert;

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

  float rippleDist() {
      return distance(mp.xz - ripplePosition.xz, vec2(0.)) * 0.1 - t * 1.;
  }

  float rippleMag(float dist) {
      return sin(dist) * 10.0 * clamp(1.-distance(mp.xz, ripplePosition.xz) / 500., .1, 1.) * rippleAmt;
  }

  float sf(float x) {
    return texture2D(sf_t, vec2(x, 0.))[0];
  }
`

const materialProto =  new THREE.ShaderMaterial( {
  uniforms: {
    t: { value: 0 },
    color: { value: new THREE.Color(1, 0, 0) },
    map: { type: 't', },
    sf_t: { type: 't' },
    glowAmt: { value: 0, },
    gridAmt: { value: 0.1, },
    houseLightsAmt: { value: 1.0, },
    accentLightsAmt: { value: 1, },
    ripplePosition: { value: new THREE.Vector3(), },
    rippleAmt: { value: 0, },
  },
  extensions: {
   derivatives: true,
  },
  vertexShader: `
    ${shaderCommon}

    void main() {
      pp = (modelMatrix * vec4(position, 1.)).xyz - cameraPosition;
      norm = normal;
      vUv = uv;
      reflection = normalize((cameraPosition - position) - 2. * dot((cameraPosition - position), normal) * normal);

      vert = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

      mp = (modelMatrix * vec4(position, 1.)).xyz;
      gl_Position.y += rippleMag(rippleDist());
    }
  `,

  fragmentShader: `
    ${shaderCommon}

    vec4 bg(vec3 p) {
      // return vec4(pow(dot(norm, -normalize(p)), 10.));
      vec2 center = (vUv*2.-vec2(1.5, 0.75)) * 8.;
      float bri = 1.-pow(distance(center, vec2(0)), 10.) + sf(sin(atan(center.x, center.y) * 2.)/2.+.5) * 10.;
      return vec4(clamp(bri, 0., 1.) * 0.2);
    }

    vec4 textex(vec3 p) {
      vec4 c = texture2D(map, reflection.xz*.01);
      c *= dot(norm, -normalize(p));
      return c;
    }

    void main() {
      vec3 rp = mp - ripplePosition;
      float angle = atan(rp.x, rp.z);
      float rDist = rippleDist();
      float rMag = rippleMag(rDist);
      vec3 nnorm = normalize(normalize(norm) + normalize(vec3(sin(angle) * sin(rDist + PI / 2.) * rMag, 1., cos(angle) * cos(rDist) * rMag)));

      // gl_FragColor += hsv(0., 1., .5) * pow(clamp(dot(nnorm, normalize(vec3(-40., 10, 0) - pp)), 0., 1.), 1.);
      // gl_FragColor += hsv(0.5, 1., .5) * pow(clamp(dot(nnorm, normalize(vec3(40., 10, 0) - pp)), 0., 1.), 1.);
      gl_FragColor += hsv(0., 0., .5) * pow(clamp(dot(nnorm, normalize(vec3(-4000, 400, 1000) - pp)), 0., 1.), 6.) * accentLightsAmt;

      gl_FragColor += hsv(0.5, 1., .2) * pow(clamp(dot(nnorm, normalize(vec3(0, 200, 200.) - pp)), 0., 1.), 2.) * houseLightsAmt;
      gl_FragColor += hsv(0.05, 1., .3) * pow(clamp(dot(nnorm, normalize(vec3(0, 200, -200) - pp)), 0., 1.), 2.) * houseLightsAmt;

      // gl_FragColor += vec4(pow(clamp(dot(nnorm, vec3(0, 1, 0)), 0., 1.), 1.));
      // float yeet = clamp(sin(dot(normalize(nnorm), vec3(0, 0, 1)) * 10. - t), 0., 1.);
      // gl_FragColor = addHsv(gl_FragColor, vec3((yeet/2.+.5) * 0.4, 0., 0.));
      // gl_FragColor += bg(pp);
      // gl_FragColor += textex(pp) * 0.5;
      // vec2 yoov = mod(vUv, vec2(1));
      vec2 yeet2 = mod(vUv*1.+vec2(0.37, 0.), 1.);
      float freq = sf(((sin((yeet2.y+yeet2.x)*PI*1.))/2.+.5)/4.);
      // freq = 0.;
      gl_FragColor += hsv(0.8 + t * 0.001 + freq * 0.8, 1., 1.) * pow(max(yeet2.x, yeet2.y), 50. - 50. * freq) * glowAmt;

      vec3 grid = abs(fract(vert * 5. - 0.5) - 0.5) / fwidth(vert * 5.);
      float line = min(min(grid.x, grid.y), grid.z);
      gl_FragColor += vec4(clamp(1.-line, 0., 1.)) * gridAmt;


      // gl_FragColor = vec4(mod(vert/2., 1.), 1.);
    }
  `,
});

export default class GLTF {
  constructor(params, globals) {
    this.params = params;
    this.group = new THREE.Group();
  }
  async load(params, globals) {
    const gltf = this.gltf = await new Promise((resolve, reject) => {
      new GLTFLoader().load('/assets/cubezone.glb', resolve, null, reject);
    });

    const material = this.material = /*new THREE.MeshLambertMaterial({
      color: 0x111111,
    });//*/materialProto.clone();
    material.uniforms.color.value.setRGB(0.1, 0.1, 0.1);
    material.uniforms.ripplePosition.value.set(...params.cubePosition);
    gltf.scene.scale.setScalar(50);
    // gltf.scene.position.y -= 100;
    gltf.scene.traverse((o) => {
      if (params.armedForDrop && o.name == 'Cube') o.geometry = (() => {
        let geo = new THREE.Geometry().fromBufferGeometry(o.geometry);
        geo.mergeVertices();
        new SubdivisionModifier(6, true).modify(geo);
        return geo;
      })();
      if (o.isMesh) {
        o.material = material;
      }
    });
    this.group.add(gltf.scene);

    // const videoEl = this.videoEl = document.createElement('video');
    // videoEl.playsInline = true;
    // videoEl.loop = true;
    // videoEl.muted = true;
    // videoEl.src = '/assets/HakobuNe%20-%20VERITAS%20feat.KAREN%20%28%E3%82%AB%E3%83%AC%E3%83%B3%29%20%E3%80%80%27Prod%20by%20HakobuNe%27-m9mK-EtTACM.mp4';
    // videoEl.play();

    // const videoTexture = new THREE.VideoTexture(videoEl);
    // videoTexture.wrapS = THREE.RepeatWrapping;
    // videoTexture.wrapT = THREE.RepeatWrapping;
    // this.videoTexture = videoTexture;
    // material.uniforms.map.value = videoTexture;
    //
  material.uniforms.sf_t.value = globals.freqTex;

  const light = new THREE.PointLight(0xffffff, 10);
  light.position.set(10, 200, 0);
  this.group.add(light);
  }
  now() {
    return (Date.now()/1000) % (1 << 15) - (1 << 14);
  }
  update() {
    if (!this.material)
      return;
    this.material.uniforms.t.value = (+new Date() / 1000) % 10000;
    // this.material.uniforms.rippleAmt.value = Math.pow(1.-(Math.sin(this.now())/2.+.5), 10.);
  }
  // destroy() {
  //   this.videoEl.src = "";
  //   this.videoEl.load();
  // }
}
