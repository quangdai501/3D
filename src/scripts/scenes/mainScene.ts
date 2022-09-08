import {
  Scene3D,    
  THREE,
  PointerLock,
  PointerDrag,
  ExtendedObject3D,
  ThirdPersonControls
} from '@enable3d/phaser-extension'

const isTouchDevice = 'ontouchstart' in window
export default class MainScene extends Scene3D {
  canJump: boolean;
  isJumping: boolean;
  move: boolean;
  moveTop: number;
  moveRight: number;
  character: any;
  controls: any;
  keys: any;
  publichubModel: any;

  constructor() {
    super({ key: 'MainScene' })
  }

  init() {
    this.accessThirdDimension();
    this.canJump = true
    this.isJumping = false
    this.move = false

    this.moveTop = 0
    this.moveRight = 0
  }

  create() {
    // creates a nice scene
    this.third.warpSpeed('-ground');

    // this.third.physics.debug.enable();

    const loadPublichub=()=>{
      this.third.load.gltf('/assets/glb/Island_PublishHub_new.glb').then(object => {
        const scene = object.scenes[0];
  
        const publichub = new ExtendedObject3D()
        publichub.name = 'scene'
        publichub.add(scene);
        publichub.position.set(0, -10, 0)
        this.third.add.existing(publichub);
  
        publichub.traverse(child => {
          if (child.isMesh) {
            child.castShadow = child.receiveShadow = false
  
            this.third.physics.add.existing(child, {
              shape: 'concave',
              mass: 0,
              collisionFlags: 1,
              autoCenter: false
            })
            child.body.setAngularFactor(0, 0, 0)
            child.body.setLinearFactor(0, 0, 0)
          }
        })
  
      })
    }

    const loadMainCharacter = ()=>{
      this.third.load.gltf('/assets/glb/character1.glb').then(object => {
        const character = object.scene
  
        this.character = new ExtendedObject3D()
        this.character.name = 'character'
        this.character.rotation.set(0, Math.PI * 1.5, 0);
        this.character.add(character);
  
        this.character.traverse(child => {
          if (child.isMesh) {
            child.shape = 'convex'
            child.castShadow = child.receiveShadow = true
            child.material.roughness = 1
            child.material.metalness = 0
          }
        })
  
        /**
         * Animations
         */
        this.third.animationMixers.add(this.character.anims.mixer)
        object.animations.forEach(animation => {
          if (animation.name) {
            /**
             * This is a hack, because I could not adjust the scale with this.character.scale.set()
             * This is not a bug from enable3d, this is how the assets a made :/
             */
            animation.tracks.forEach(track => {
              if (/(scale|position)/.test(track.name)) {
                const newValues = track.values.map(v => v * 1)
                track.values = newValues
              }
            })
  
            this.character.anims.add(animation.name, animation)
          }
        })
        this.character.anims.play('idle_v1')
        this.character.position.set(0, 2, 8)
  
        /**
         * Add the player to the scene with a body
         */
        this.third.add.existing(this.character);
        
        this.third.physics.add.existing(this.character, {
          shape: 'capsule',
          radius: 0.2,
          height: 1,
          offset: { y: -0.75 }
        })
        this.character.body.setFriction(0.8)
        this.character.body.setAngularFactor(0, 0, 0)
  
        this.controls = new ThirdPersonControls(this.third.camera, this.character, {
          offset: new THREE.Vector3(0, 1, 0),
          targetRadius: 3
        })
  
      })
    }

    loadPublichub();
    loadMainCharacter();

    this.keys = {
      a: this.input.keyboard.addKey('a'),
      w: this.input.keyboard.addKey('w'),
      d: this.input.keyboard.addKey('d'),
      s: this.input.keyboard.addKey('s'),
      space: this.input.keyboard.addKey(32)
    };


    if (!isTouchDevice) {
      const pointerLock = new PointerLock(this.game.canvas)
      const pointerDrag = new PointerDrag(this.game.canvas)
      pointerDrag.onMove(delta => {
        if (!pointerLock.isLocked()) return
        const { x, y } = delta
        this.moveTop = -y
        this.moveRight = x
      })
    }
  }

  jump() {
    if (!this.character) return
    this.canJump = false
    this.isJumping = true
    this.character.anims.play('run_jumnp')
    this.time.addEvent({
      delay: 750,
      callback: () => (this.canJump = true)
    })
    this.time.addEvent({
      delay: 750,
      callback: () => {
        this.character.anims.play('walk')
        this.isJumping = false
      }
    })
    this.character.body.applyForceY(4)
  }

  update(time, delta) {
    if (this.character && this.character.body && this.controls && this.controls.update) {
      /**
       * Update Controls
       */
      this.controls.update(this.moveRight * 3, -this.moveTop * 3)
      if (!isTouchDevice) this.moveRight = this.moveTop = 0
      /**
       * Player Turn
       */
      const speed = 4
      const v3 = new THREE.Vector3()

      const rotation = this.third.camera.getWorldDirection(v3)
      const theta = Math.atan2(rotation.x, rotation.z)
      const rotationcharacter = this.character.getWorldDirection(v3)
      const thetacharacter = Math.atan2(rotationcharacter.x, rotationcharacter.z)
      this.character.body.setAngularVelocityY(0)

      const l = Math.abs(theta - thetacharacter)
      let rotationSpeed = isTouchDevice ? 2 : 4
      let d = Math.PI / 24

      if (l > d) {
        if (l > Math.PI - d) rotationSpeed *= -1
        if (theta < thetacharacter) rotationSpeed *= -1
        this.character.body.setAngularVelocityY(rotationSpeed)
      }

      /**
       * Player Move
       */
      if (this.keys.w.isDown || this.move) {
        if (this.character.anims.current === 'idle_v1' && !this.isJumping) this.character.anims.play('walk')

        const x = Math.sin(theta) * speed,
          y = this.character.body.velocity.y,
          z = Math.cos(theta) * speed

        this.character.body.setVelocity(x, y, z)
      } else {
        if (this.character.anims.current === 'walk' && !this.isJumping) this.character.anims.play('idle_v1')
      }

      /**
       * Player Jump
       */
      if (this.keys.space.isDown && this.canJump) {
        this.jump()
      }
    }
  }
}
