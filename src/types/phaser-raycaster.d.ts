declare module 'phaser-raycaster' {
  import Phaser from 'phaser';

  interface Point {
    x: number;
    y: number;
  }

  namespace PhaserRaycaster {
    class Raycaster {
      mapGameObjects(objects: Phaser.GameObjects.GameObject[], dynamic?: boolean): Raycaster.Map[];
      removeMappedObjects(objects: Phaser.GameObjects.GameObject[]): void;
      createRay(options?: {
        origin?: Phaser.Math.Vector2 | Point;
        angle?: number;
        angleDeg?: number;
        cone?: number;
        coneDeg?: number;
        range?: number;
        collisionRange?: number;
        detectionRange?: number;
        ignoreNotIntersectedRays?: boolean;
        autoSlice?: boolean;
        round?: boolean;
        enablePhysics?: boolean | 'arcade' | 'matter';
      }): Raycaster.Ray;
      destroy(): void;
    }

    namespace Raycaster {
      interface Map {
        config(options?: Record<string, unknown>): Map;
        updateMap(): Map;
        destroy(): void;
        active: boolean;
      }

      class Ray {
        origin: Point;
        angle: number;
        autoSlice: boolean;
        slicedIntersections: Phaser.Geom.Triangle[];
        collisionRange: number;

        setOrigin(x: number, y: number): Ray;
        setAngle(angle?: number): Ray;
        setAngleDeg(angle?: number): Ray;
        setCone(cone?: number): Ray;
        setConeDeg(cone?: number): Ray;
        setCollisionRange(range: number): Ray;
        setDetectionRange(range: number): Ray;
        cast(options?: { objects?: object[] }): Phaser.Math.Vector2 | boolean;
        castCircle(options?: { objects?: object[] }): Phaser.Math.Vector2[];
        castCone(options?: { objects?: object[] }): Phaser.Math.Vector2[];
        overlap(objects?: unknown): Phaser.GameObjects.GameObject[];
        processOverlap(rayFoV: unknown, target: unknown): boolean;
        enablePhysics(type?: 'arcade' | 'matter'): Ray;
        destroy(): void;
      }
    }
  }

  class PhaserRaycaster extends Phaser.Plugins.ScenePlugin {
    createRaycaster(options?: {
      mapSegmentCount?: number;
      objects?: unknown | object[];
      boundingBox?: Phaser.Geom.Rectangle;
      autoUpdate?: boolean;
      debug?: boolean | object;
    }): PhaserRaycaster.Raycaster;
  }

  export = PhaserRaycaster;
}
