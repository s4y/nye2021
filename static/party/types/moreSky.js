import * as THREE from '/deps/three/build/three.module.js'
var uniformsSky;

export default class GLTF {
  constructor(params, globals) {
    this.group = new THREE.Group();
  }

  async load(params, globals) {
    uniformsSky = {
    u_time: { type: "f", value: 1.0 },
    u_resolution: { type: "v2", value: new THREE.Vector2() },
    u_mouse: { type: "v2", value: new THREE.Vector2() },
    u_camRot: {type: "v3", value: new THREE.Vector3() },
    u_camQuat:{type:"v4", value: new THREE.Vector4() },
    u_camPos: {type: "v3", value: new THREE.Vector3() },
    u_vol:{type:'f', value: 0.0}
      };
    const material = this.material = new THREE.ShaderMaterial( {
      uniforms: uniformsSky,
      vertexShader: `
        varying vec2 p;

        void main() {
          p = uv*2.-1.;
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }
      `,
      fragmentShader: _fragmentShader,
      side: THREE.BackSide
    });
    uniformsSky.u_resolution.value.x = window.innerWidth;
    uniformsSky.u_resolution.value.y = window.innerHeight;

    const mesh = this.mesh = new THREE.Mesh(
      new THREE.BoxBufferGeometry(5, 10, 5),
      material);
    mesh.position.y = 6;
    this.group.add(mesh);

    mesh.onBeforeRender = () => {
      const now = this.now();
      material.uniforms.u_time.value = now;
      
    };

  }
  now() {
    return (Date.now()/1000) % (1 << 15) - (1 << 14);
  }
  update(camera) {
    camera.updateMatrixWorld();

    var vector = camera.position.clone();

    vector.applyMatrix4( camera.matrixWorld );
    //debugger
    if(this.material ){
    this.material.uniforms.u_camPos.value = vector;
    this.material.uniforms.u_camRot.value = camera.rotation;
    this.material.uniforms.u_camQuat.value = camera.quaternion;
    }
  }
  // destroy() {
  // }
}
var _fragmentShader = `      
      
#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
uniform vec4 u_camRot;
uniform vec4 u_camQuat;
uniform vec3 u_camPos;
uniform float u_vol;
uniform sampler2D u_feed;
#define PI 3.14159265
#define TAU (2*PI)

#define PHI ((pow(float(5),0.5))*0.5 + 0.5)
// Define some constants
const int steps = 16; // This is the maximum amount a ray can march.
const float smallNumber = 0.001;
const float maxDist = 100.; // This is the maximum distance a ray can travel.



vec3 rotateQuat( vec4 quat, vec3 vec )
{
return vec + 2.0 * cross( cross( vec, quat.xyz ) + quat.w * vec, quat.xyz );
}

vec3 lookAt(vec2 uv, vec3 camOrigin, vec3 camTarget){
    vec3 zAxis = normalize(camTarget - camOrigin);
    vec3 up = vec3(0,1,0);
    vec3 xAxis = normalize(cross(up, zAxis));
    vec3 yAxis = normalize(cross(zAxis, xAxis));
    
    float fov =1.;
    
    vec3 dir = (normalize(uv.x * xAxis + uv.y * yAxis + zAxis * fov));
    
    return dir;
}

float fBlob(vec3 p) {
  p = abs(p);
  if (p.x < max(p.y, p.z)) p = p.yzx;
  if (p.x < max(p.y, p.z)) p = p.yzx;
    float b = max(max(max(
        dot(p, normalize(vec3(1, 1, 1))),
        dot(p.xz, normalize(vec2(PHI+1., 1)))),
        dot(p.yx, normalize(vec2(1., PHI)))),
        dot(p.xz, normalize(vec2(1., PHI))));
    float l = length(p) ;
  return l - 1.5 - 0.2 * (1.5 / 2.0) * cos(min(pow(float((1.01 - b / l)),0.5)*(PI / 0.25), PI));
}

// Repeat in three dimensions
vec3 pMod3(inout vec3 p, vec3 size) {
  vec3 c = floor((p + size*0.5)/size);
  p = mod(p + size*0.5, size) - size*0.5;
  return c;
}
float smin( float a, float b, float k )
{
    float h = clamp( 0.5+0.5*(b-a)/k, 0.0, 1.0 );
    return mix( b, a, h ) - k*h*(1.0-h);
}
float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}
float scene(vec3 position){

    vec3 c = vec3(10.,10,30);
    vec3 m = pMod3(position,c);
    position.y += (1.-(rand(m.xy)*2.0))* c.y/2.;
    position.x += (1.-(rand(m.xz)*2.0))* c.x/2.;
    position.z += (1.-(rand(m.yz)*2.0))* c.z/2.;
    float b = fBlob(vec3(
            position.x, 
            position.y, 
            position.z - 10.)
        );
    vec3 p = position;
    return b ;
}

vec4 trace (vec3 origin, vec3 direction){
    
    float dist = 0.;
    float totalDistance = 0.;
    vec3 positionOnRay = origin;
    
    for(int i = 0 ; i < steps; i++){
        
        dist = scene(positionOnRay) * rand(positionOnRay.xy);
        
        // Advance along the ray trajectory the amount that we know the ray
        // can travel without going through an object.
        positionOnRay += dist * direction;
        
        // Total distance is keeping track of how much the ray has traveled
        // thus far.
        totalDistance += dist;
        
        // If we hit an object or are close enough to an object,
        if (dist < smallNumber){
            // return the distance the ray had to travel normalized so be white
            // at the front and black in the back.
            return 1. - (vec4(totalDistance) / maxDist);
 
        }
        
        if (totalDistance > maxDist){
 
            return vec4(0);//texture2D(u_feed, gl_FragCoord.xy/u_resolution); // Background color.
        }
    }
    
    return vec4(0);//return texture2D(u_feed, gl_FragCoord.xy/u_resolution);
}
 
// main is a reserved function that is going to be called first
void main(void)
{
      float lo = 500.;
    float hi= 1000.;
  if (u_camPos.y < lo){
    gl_FragColor =vec4(0);
    return;
  }

    vec2 normCoord = gl_FragCoord.xy/u_resolution;

    vec2 uv = -1. + 2. * normCoord;
    // Unfortunately our screens are not square so we must account for that.
    uv.x *= (u_resolution.x / u_resolution.y);
    
    vec3 rayOrigin = vec3(uv, 0.);
    vec3 camOrigin = u_camPos*0.1;
    
    vec3 zAxis = vec3(0,0,1);
    vec3 up = vec3(0,1,0);
    vec3 xAxis = normalize(cross(up, zAxis));
    vec3 yAxis = normalize(cross(zAxis, xAxis));

    // we need to apply rotate 3 times each with rotation on the relative object, 
    // then we can get the lookat direction that we need. SO lets start with looking at forward

    vec3 dirToLook = normalize(camOrigin + rayOrigin);
    dirToLook = rotateQuat(u_camQuat, dirToLook);    


    // according to 3js docs Default order is 'XYZ'

    vec3 dir = lookAt(uv, camOrigin, camOrigin+dirToLook);
    float multby = 1.;

  if (u_camPos.y >= lo && u_camPos.y< hi){
    multby = ((u_camPos.y -lo)/(hi-lo));
  }
    gl_FragColor = trace(camOrigin, dir)* multby;
}

`;