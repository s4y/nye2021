const cubePosition = [-15, 80, 200];

return [
  {
    // enabled: false,
    id: 'cube',
    placement: {
      position: cubePosition,
    },
    scene: [
      { type: 'cube', },
    ],
  },
  {
    id: 'landscape',
    scene: [
      {
        type: 'landscape',
        params: {
          armedForDrop: false,
          cubePosition,
        },
      },
    ],
  },
  {
    id: 'bar',
    placement: {
      position: [50, 0, 100],
    },
    scene: [
      {
        type: 'bar',
        params: {
          url: '/assets/bar.glb',
        }
      },
    ],
  },
  {
    id: 'logo',
    // enabled: false,
    placement: {
      position: [388, 190, -220],
      rotation: [0, -1.57, 0],
      scale: [10, 10, 10],
    },
    scene: [
      {
        type: 'gltf',
        params: {
          url: '/assets/lcnyc-flatmesh.glb',
          // material: 'phong',
          // color: [1, 1, 1],
        }
      },
      {
        type: 'light',
        placement: {
          position: [0, 5, 2],
        },
        params: {
          color: [0.6, 0.7, 1],
          intensity: 50,
        }
      },
    ],
  },
  {
    id: 'icecream',
    scene: [
      {
        type: 'gltf',
        placement: {
          position: [-450, 260, -287],
          scale: [100, 100, 100],
          rotation: [-0.1, 0, -0.5],
        },
        params: {
          url: '/assets/cone.glb',
          // material: 'phong',
        }
      },
    ],
  },
  {
    id: 'vj',
    placement: {
      position: [250, 0, -50.],
      scale: [-7, 7, 7],
      rotation: [0, -0.0, 0],
    },
    scene: [
      { type: 'vj', },
    ],
  },    
  {
  
    id: 'moreSky',
    placement: {
      position: [0, -1000,0],
      scale: [1000, 1500, 1000],
    },
    scene: [
      {
        type: 'moreSky',
        params: {
        }
      },
    ],
  },
  {
    enabled: false,
    id: 'example',
    placement: {
      position: [0, 1, 0],
    },
    scene: [
      {
        type: 'example',
        params: {
        }
      },
    ],
  },
];
