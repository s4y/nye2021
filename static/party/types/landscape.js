import * as THREE from '/deps/three/build/three.module.js'
import { GLTFLoader } from '/deps/three/examples/jsm/loaders/GLTFLoader.js'
import { SubdivisionModifier } from '/deps/SubdivisionModifier.js';
import Service from '/space/js/Service.js'

const shaderCommon = `
  #define PHONG

  uniform vec3 diffuse;
  uniform vec3 emissive;
  uniform vec3 specular;
  uniform float shininess;
  uniform float opacity;

  uniform float ripple;
  uniform float t;
  uniform sampler2D map;
  uniform sampler2D sf_t;
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
    ...THREE.UniformsLib.common,
    ...THREE.UniformsLib.lights,

    t: { value: 0 },
    emissive: { value: new THREE.Color(0, 0, 0) },
    map: { type: 't', },
    sf_t: { type: 't' },
    glowAmt: { value: 0, },
    gridAmt: { value: 0.1, },
    houseLightsAmt: { value: 0, },
    accentLightsAmt: { value: 0, },
    ripplePosition: { value: new THREE.Vector3(), },
    rippleAmt: { value: 0, },
    shininess: { value: 200, },
    specular: { value: new THREE.Color(0x000000) },
    emissive: { value: new THREE.Color(0x000000) },
    diffuse: { value: new THREE.Color(0x555555) },
  },
  lights: true,
  extensions: {
   derivatives: true,
  },
  vertexShader: `
    ${shaderCommon}

    varying vec3 vViewPosition;
    #ifndef FLAT_SHADED
      varying vec3 vNormal;
    #endif

    void main() {
      #include <beginnormal_vertex>
      #include <morphnormal_vertex>
      #include <skinbase_vertex>
      #include <skinnormal_vertex>
      #include <defaultnormal_vertex>

      #ifndef FLAT_SHADED // Normal computed with derivatives when FLAT_SHADED
        vNormal = normalize( transformedNormal );
      #endif

      #include <begin_vertex>
      #include <project_vertex>
      vViewPosition = - mvPosition.xyz;
      #include <worldpos_vertex>
      #include <envmap_vertex>
      #include <shadowmap_vertex>
      #include <fog_vertex>

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

    #include <bsdfs>
    #include <lights_pars_begin>
    #include <lights_phong_pars_fragment>
    #include <specularmap_pars_fragment>

    vec4 bg(vec3 p) {
      // return vec4(pow(dot(norm, -normalize(p)), 10.));
      vec2 center = (vUv*2.-vec2(1.5, 0.75)) * 8.;
      float bri = 1.-pow(distance(center, vec2(0)), 10.) + sf(sin(atan(center.x, center.y) * 2.)/2.+.5) * 10.;
      return vec4(clamp(bri, 0., 1.) * 0.2);
    }

    vec4 textex(vec3 p) {
      float xpos = atan(p.z, p.x) / PI / 1.;
      vec4 c = texture2D(map, vec2(xpos, p.y / 1000. - 0.125) + 0.5);
      // c *= clamp(abs(xpos), 0., 1.);
      c *= clamp(p.y / 100., 0., 1.);
      // c *= dot(norm, -normalize(p));
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
      gl_FragColor += textex(mp) * 0.5;
      // vec2 yoov = mod(vUv, vec2(1));
      vec2 yeet2 = mod(vUv*1.+vec2(0.37, 0.), 1.);
      float freq = sf(((sin((yeet2.y+yeet2.x)*PI*1.))/2.+.5)/4.);
      // freq = 0.;
      gl_FragColor += hsv(0.8 + t * 0.001 + freq * 0.8, 1., 1.) * pow(max(yeet2.x, yeet2.y), 50. - (50.*glowAmt) * freq) * glowAmt;

      vec3 grid = abs(fract(rp / 10. - 0.5) - 0.5) / fwidth(rp / 10.);
      float line = clamp(min(min(grid.x, grid.y), grid.z), 0., 1.);
      gl_FragColor += vec4(clamp(1.-line, 0., 1.)) * gridAmt;

      vec4 diffuseColor = vec4( diffuse, opacity );
      ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
      vec3 totalEmissiveRadiance = emissive;

      #include <specularmap_fragment>
      #include <normal_fragment_begin>
      #include <normal_fragment_maps>

      #include <lights_phong_fragment>
      #include <lights_fragment_begin>
      #include <lights_fragment_maps>
      #include <lights_fragment_end>

      vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
      #include <envmap_fragment>
      gl_FragColor += vec4( outgoingLight, diffuseColor.a );

    #include <tonemapping_fragment>
    #include <encodings_fragment>
    #include <fog_fragment>
    #include <premultiplied_alpha_fragment>
    #include <dithering_fragment>
    }
  `,
});

export default class GLTF {
  constructor(params, globals) {
    this.params = params;
    this.globals = globals;
    this.group = new THREE.Group();
  }
  async load(params, globals, world) {
    const gltf = this.gltf = await new Promise((resolve, reject) => {
      new GLTFLoader().load('/assets/cubezone.glb', resolve, null, reject);
    });

    const material = this.material = materialProto.clone();
    material.uniforms.ripplePosition.value.set(...params.cubePosition);
    gltf.scene.scale.setScalar(50);
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

    material.uniforms.sf_t.value = globals.freqTex;
    material.uniforms.map.value = globals.vjTex;

    const light = new THREE.PointLight(0xffffff, 200);
    light.position.set(-350, 300, -200);
    this.group.add(light);

    // const marker = new THREE.Mesh(
    //   new THREE.BoxBufferGeometry(1, 1, 1),
    //   new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    // light.add(marker);
  }
  now() {
    return (Date.now()/1000) % (1 << 15) - (1 << 14);
  }
  update() {
    const now = this.now();
    if (!this.material)
      return;
    this.material.uniforms.t.value = now;
    if (this.cubelight) {
      this.cubelight.rotation.y += 0.005;
      this.cubelight.rotation.x += 0.004;
      this.cubelight.material.emissive.setHSL(0.15, .9, .8 - Math.pow(this.globals.freqData[1] / 255, 4.) * 0.5);
    }

    const { knobs } = this.globals;
    if (knobs) {
      this.material.uniforms.glowAmt.value = knobs['nye.glow'] || 0;
      this.material.uniforms.rippleAmt.value = knobs['nye.ripple'] || 0;
    this.material.uniforms.houseLightsAmt.value = knobs['nye.houseLights'] || 0;
    this.material.uniforms.accentLightsAmt.value = knobs['nye.accentLights'] || 0;
    this.material.uniforms.gridAmt.value = knobs['nye.grid'] || 0;
    }
  }
  // destroy() {
  //   this.videoEl.src = "";
  //   this.videoEl.load();
  // }
}
