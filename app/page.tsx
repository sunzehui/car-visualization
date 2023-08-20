'use client'
import {
  Box, CubeCamera, Environment, MeshReflectorMaterial, OrbitControls, PerspectiveCamera, useGLTF
} from '@react-three/drei'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import { Suspense, useEffect, useRef } from 'react'
import {
  Color,
  DoubleSide, LinearSRGBColorSpace, RepeatWrapping, SRGBColorSpace, TextureLoader, TorusGeometry, Vector2
} from 'three'
import { Mesh } from 'three'
import { GLTF } from 'three-stdlib/loaders/GLTFLoader'
import {
  EffectComposer,
  DepthOfField,
  Bloom,
  ChromaticAberration,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";

const GRID_SIZE = 30;
const GRID_BOX_NUM = 30;
const CAR_SPEED = 2;

const Effect = () => {
  return (
    <EffectComposer>
      {/* <DepthOfField focusDistance={0.0035} focalLength={0.01} bokehScale={3} height={480} /> */}
      <Bloom
        blendFunction={BlendFunction.ADD}
        intensity={1.3} // The bloom intensity.
        width={300} // render width
        height={300} // render height
        kernelSize={5} // blur kernel size
        luminanceThreshold={0.15} // luminance threshold. Raise this value to mask out darker elements in the scene.
        luminanceSmoothing={0.025} // smoothness of the luminance threshold. Range is [0, 1]
      />
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL} // blend mode
        offset={[0.0005, 0.0012]} // color offset
      />
    </EffectComposer>
  )
}

interface ModelCarGLTF extends GLTF {

}

const ModelCar = () => {
  const car = useGLTF('/car/scene.gltf') as ModelCarGLTF

  useEffect(() => {
    car.scene.scale.set(0.005, 0.005, 0.005);
    car.scene.position.set(0, -0.035, 0);
    car.scene.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        object.material.envMapIntensity = 20;
      }
    });
  }, [car])


  useFrame((state, delta) => {
    let t = state.clock.getElapsedTime();

    let group = car.scene.children[0].children[0].children[0];
    const rad = CAR_SPEED * (1000 / 3600) / 0.22;
    group.children[0].rotation.x = t * rad;
    group.children[2].rotation.x = t * rad;
    group.children[4].rotation.x = t * rad;
    group.children[6].rotation.x = t * rad;
  });

  return (
    <primitive object={car.scene} />
  )
}
const ModelRoad = () => {
  const gridTexture = useLoader(TextureLoader, '/textures/grid-texture.png');
  useEffect(() => {
    gridTexture.wrapS = gridTexture.wrapT = RepeatWrapping;
    gridTexture.anisotropy = 4
    gridTexture.repeat.set(GRID_BOX_NUM, GRID_BOX_NUM);
  }, [gridTexture])
  useFrame((state, delta) => {
    const clock = state.clock.getElapsedTime();

    gridTexture.offset.y = -clock * CAR_SPEED * (1000 / 3600) * GRID_BOX_NUM / 10;
  })


  return (
    <mesh
      rotation-x={-Math.PI * 0.5}
      castShadow receiveShadow
    >
      <planeGeometry args={[GRID_SIZE, GRID_SIZE]} />
      <meshLambertMaterial
        color={[1, 1, 1]}
        transparent={true}
        opacity={0.15}
        map={gridTexture} alphaMap={gridTexture}
      />
    </mesh>
  )
}


const ModelGround = () => {
  const roughnessMapTexture = useLoader(TextureLoader, '/textures/terrain-roughness.jpg');
  const normalMapTexture = useLoader(TextureLoader, '/textures/terrain-normal.jpg');

  useEffect(() => {
    [normalMapTexture, roughnessMapTexture].forEach((t) => {
      t.wrapS = RepeatWrapping;
      t.wrapT = RepeatWrapping;
      t.repeat.set(10, 10);
      t.offset.set(0, 0);
    });
  }, [roughnessMapTexture, normalMapTexture]);
  useFrame((state, delta) => {
    const clock = state.clock.getElapsedTime();
    normalMapTexture.offset.y = -clock * CAR_SPEED * (1000 / 3600);
    roughnessMapTexture.offset.y = -clock * CAR_SPEED * (1000 / 3600);
  })

  return (
    <mesh
      rotation-x={-Math.PI * 0.5}
      castShadow receiveShadow
    >
      <planeGeometry args={[GRID_SIZE, GRID_SIZE]} />
      <MeshReflectorMaterial
        normalMap={normalMapTexture}
        normalScale={new Vector2(0.15, 0.15)}
        roughnessMap={roughnessMapTexture}
        dithering={true}
        color={[0.015, 0.015, 0.015]}
        roughness={0.7}
        blur={[1000, 400]} // Blur ground reflections (width, heigt), 0 skips blur
        mixBlur={30} // How much blur mixes with surface roughness (default = 1)
        mixStrength={80} // Strength of the reflections
        mixContrast={1} // Contrast of the reflections
        resolution={1024} // Off-buffer resolution, lower=faster, higher=better quality, slower
        mirror={0} // Mirror environment, 0 = texture colors, 1 = pick up env colors
        depthScale={0.01} // Scale the depth factor (0 = no depth, default = 0)
        minDepthThreshold={0.9} // Lower edge for the depthTexture interpolation (default = 0)
        maxDepthThreshold={1} // Upper edge for the depthTexture interpolation (default = 0)
        depthToBlurRatioBias={0.25} // Adds a bias factor to the depthTexture before calculating the blur amount [blurFactor = blurTexture * (depthTexture + bias)]. It accepts values between 0 and 1, default is 0.25. An amount > 0 of bias makes sure that the blurTexture is not too sharp because of the multiplication with the depthTexture
        reflectorOffset={0.2} // Offsets the virtual camera that projects the reflection. Useful when the reflective surface is some distance from the object's origin (default = 0)
      />
    </mesh>
  )
}
const ModelRing = () => {
  const refs = useRef([])
  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();
    refs.current.forEach((ref, idx) => {
      const gap = 6
      const z = (2 - idx) * gap + ((time * CAR_SPEED) % gap);
      ref.position.z = -z;
      if (idx % 2) {
        ref.material.emissive = new Color(6, 0.15, 0.7);
      }
      else {
        ref.material.emissive = new Color(0.1, 0.7, 3);
      }
    })
  })
  return (
    <>
      {new Array(6).fill(0).map((item, idx) =>
        <mesh
          key={idx}
          ref={(ref) => (refs.current[idx] = ref)}
          position={[0, 0, 0]}
          castShadow receiveShadow
        >
          <torusGeometry args={[3.2, .1, 20, 150]} />
          <meshStandardMaterial
            color={[0, 0, 0]}
            emissive={[4, 0.1, 0.4]}
          />
        </mesh>
      )}
    </>
  )
}
const ThreeScene = () => {
  return (
    <Suspense fallback={null}>
      <Canvas shadows>
        {/* <ambientLight intensity={0.4} /> */}
        <PerspectiveCamera
          makeDefault fov={50}
          position={[3, 2, 5]}
        />
        <fog attach="fog" args={['#000', 10, 50]} />
        <ModelRing />
        <spotLight
          color={[1, 0.25, 0.7]}
          intensity={1.5}
          angle={0.6}
          penumbra={0.5}
          position={[5, 5, 0]}
          castShadow
          shadow-bias={-0.0001}
        />
        <spotLight
          color={[0.14, 0.5, 1]}
          intensity={2}
          angle={0.6}
          penumbra={0.5}
          position={[-5, 5, 0]}
          castShadow
          shadow-bias={-0.0001}
        />
        <CubeCamera resolution={256} frames={Infinity}>
          {(texture) => (
            <>
              <Environment map={texture} />
              <ModelCar />
            </>
          )}
        </CubeCamera>

        <ModelRoad />
        <ModelGround />
        <OrbitControls
          target={[0, 0.35, 0]}
          maxPolarAngle={1.45}
        />

        <color args={[0, 0, 0]} attach="background" />

        <Effect />
      </Canvas>
    </Suspense>
  )
}

export default function Page() {
  return (
    <>
      <div className='mx-auto flex h-full w-full'>
        <ThreeScene />
      </div>
    </>
  )
}
