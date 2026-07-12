import {
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  Mesh,
  Texture,
  type Scene,
} from '@babylonjs/core';
import { assetStore } from './AssetStore';

/** Axis-aligned wall box in the XZ game plane (Y up). */
export interface WallBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  mesh?: Mesh;
}

/** Creates billboard planes and wall collision meshes for the isometric world. */
export class MeshFactory {
  /**
   * Create a camera-facing billboard plane textured with an asset key.
   * World size is in game units (roughly 1 unit ≈ 16 old pixels).
   */
  static createBillboard(
    scene: Scene,
    name: string,
    textureKey: string,
    worldHeight: number,
  ): Mesh {
    const baseTex = assetStore.hasTexture(textureKey)
      ? assetStore.getTexture(textureKey)
      : assetStore.getTexture('__placeholder');

    const sheet = assetStore.getSpritesheet(textureKey);
    const aspect = sheet
      ? sheet.frameWidth / sheet.frameHeight
      : baseTex.getSize().width / Math.max(1, baseTex.getSize().height);

    const height = worldHeight;
    const width = height * aspect;

    const mesh = MeshBuilder.CreatePlane(
      name,
      { width, height, sideOrientation: Mesh.DOUBLESIDE },
      scene,
    );
    mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
    mesh.position.y = height / 2;

    // Clone texture so per-entity UV animation does not stomp shared sheets
    const texture = baseTex.clone();
    texture.name = `${textureKey}_${name}`;

    const mat = new StandardMaterial(`${name}_mat`, scene);
    mat.diffuseTexture = texture;
    mat.emissiveColor = new Color3(0.35, 0.35, 0.35);
    mat.specularColor = Color3.Black();
    mat.backFaceCulling = false;
    if (mat.diffuseTexture) {
      mat.diffuseTexture.hasAlpha = true;
      mat.useAlphaFromDiffuseTexture = true;
    }
    mesh.material = mat;

    // Store logical size for systems that need display dimensions
    mesh.metadata = {
      ...(mesh.metadata ?? {}),
      displayWidth: width,
      displayHeight: height,
      textureKey,
      baseHeight: height,
    };

    if (sheet) {
      texture.wrapU = Texture.CLAMP_ADDRESSMODE;
      texture.wrapV = Texture.CLAMP_ADDRESSMODE;
      MeshFactory.applyFrame(mesh, 0, sheet.columns, sheet.rows);
    }

    return mesh;
  }

  /** Create a textured plane lying flat on the ground (Y-up). */
  static createGroundDecal(
    scene: Scene,
    name: string,
    textureKey: string,
    worldHeight: number,
  ): Mesh {
    const baseTex = assetStore.hasTexture(textureKey)
      ? assetStore.getTexture(textureKey)
      : assetStore.getTexture('__placeholder');

    const aspect = baseTex.getSize().width / Math.max(1, baseTex.getSize().height);
    const depth = worldHeight;
    const width = depth * aspect;

    const mesh = MeshBuilder.CreateGround(name, { width, height: depth }, scene);
    mesh.position.y = 0.02;

    const texture = baseTex.clone();
    texture.name = `${textureKey}_${name}`;

    const mat = new StandardMaterial(`${name}_mat`, scene);
    mat.diffuseTexture = texture;
    mat.diffuseTexture.hasAlpha = true;
    mat.useAlphaFromDiffuseTexture = true;
    mat.emissiveColor = new Color3(0.35, 0.35, 0.35);
    mat.specularColor = Color3.Black();
    mat.backFaceCulling = false;
    mesh.material = mat;

    mesh.metadata = {
      ...(mesh.metadata ?? {}),
      displayWidth: width,
      displayHeight: depth,
      textureKey,
    };

    return mesh;
  }

  /** Set spritesheet cell index on a billboard's material UVs. */
  static applyFrame(mesh: Mesh, frameIndex: number, columns: number, rows: number): void {
    const mat = mesh.material as StandardMaterial | null;
    const tex = mat?.diffuseTexture as Texture | null;
    if (!tex) return;
    const col = frameIndex % columns;
    const row = Math.floor(frameIndex / columns);
    tex.uScale = 1 / columns;
    tex.vScale = 1 / rows;
    tex.uOffset = col / columns;
    // Babylon V grows upward; spritesheet rows grow downward
    tex.vOffset = 1 - (row + 1) / rows;
  }

  /**
   * Shared rock/stone wall material (one per room). Callers should dispose it
   * with the room. u/vScale tile the texture in UV space across each box face.
   */
  static createRockWallMaterial(
    scene: Scene,
    name: string,
    texture: Texture,
    uScale = 1,
    vScale = 1,
  ): StandardMaterial {
    const tex = texture.clone();
    tex.name = `${name}_tex`;
    tex.wrapU = Texture.WRAP_ADDRESSMODE;
    tex.wrapV = Texture.WRAP_ADDRESSMODE;
    tex.uScale = uScale;
    tex.vScale = vScale;
    const mat = new StandardMaterial(name, scene);
    mat.diffuseTexture = tex;
    mat.emissiveColor = new Color3(0.1, 0.09, 0.08);
    mat.specularColor = Color3.Black();
    return mat;
  }

  /** Create a wall box collider mesh and WallBox record. */
  static createWallBox(
    scene: Scene,
    name: string,
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
    height = 2,
    visible = false,
    material?: StandardMaterial,
  ): WallBox {
    const w = maxX - minX;
    const d = maxZ - minZ;
    const mesh = MeshBuilder.CreateBox(name, { width: w, height, depth: d }, scene);
    mesh.position = new Vector3((minX + maxX) / 2, height / 2, (minZ + maxZ) / 2);
    mesh.checkCollisions = true;
    mesh.isVisible = visible;
    if (visible) {
      if (material) {
        mesh.material = material;
      } else {
        const mat = new StandardMaterial(`${name}_mat`, scene);
        mat.diffuseColor = new Color3(0.32, 0.28, 0.24);
        mat.emissiveColor = new Color3(0.08, 0.07, 0.06);
        mat.specularColor = Color3.Black();
        mesh.material = mat;
      }
    }
    return { minX, maxX, minZ, maxZ, mesh };
  }

  /** Create a ground plane covering [0..width] x [0..depth] in XZ. */
  static createGround(
    scene: Scene,
    name: string,
    width: number,
    depth: number,
    texture?: Texture,
    color = new Color3(0.35, 0.35, 0.38),
  ): Mesh {
    const ground = MeshBuilder.CreateGround(name, { width, height: depth }, scene);
    ground.position.x = width / 2;
    ground.position.z = depth / 2;
    const mat = new StandardMaterial(`${name}_mat`, scene);
    if (texture) {
      mat.diffuseTexture = texture;
      texture.wrapU = Texture.WRAP_ADDRESSMODE;
      texture.wrapV = Texture.WRAP_ADDRESSMODE;
    } else {
      mat.diffuseColor = color;
    }
    mat.specularColor = Color3.Black();
    ground.material = mat;
    return ground;
  }
}
