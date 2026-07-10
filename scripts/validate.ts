/**
 * Offline validation script: loads all mods, validates every def against Zod schemas,
 * checks asset references. Exits non-zero on any failure.
 * Run via: npm run validate
 */
import fs from 'fs';
import path from 'path';
import { ContentRegistry } from '../src/engine/core/ContentRegistry';
import { ModLoader, type AssetManifest } from '../src/engine/core/ModLoader';

const MODS_DIR = path.resolve(import.meta.dirname, '..', 'mods');

function discoverJsonFiles(dir: string, ext = '.json'): { filename: string; data: unknown }[] {
  const results: { filename: string; data: unknown }[] = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...discoverJsonFiles(full, ext));
    } else if (entry.name.endsWith(ext) && entry.name !== 'mod.json' && entry.name !== 'manifest.json') {
      try {
        const raw = JSON.parse(fs.readFileSync(full, 'utf-8'));
        results.push({ filename: path.relative(MODS_DIR, full), data: raw });
      } catch (e) {
        results.push({ filename: path.relative(MODS_DIR, full), data: null });
        console.error(`  JSON parse error in ${full}: ${(e as Error).message}`);
      }
    }
  }
  return results;
}

function validateManifestFiles(manifest: AssetManifest, assetsDir: string): string[] {
  const errors: string[] = [];
  for (const [key, entry] of Object.entries(manifest)) {
    const filePath = path.join(assetsDir, entry.file);
    if (!fs.existsSync(filePath)) {
      errors.push(`Manifest key "${key}" references missing file: ${entry.file}`);
    }
  }
  return errors;
}

function main() {
  let totalErrors = 0;

  if (!fs.existsSync(MODS_DIR)) {
    console.error('No mods/ directory found');
    process.exit(1);
  }

  const modDirs = fs.readdirSync(MODS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());

  if (modDirs.length === 0) {
    console.error('No mods found in mods/');
    process.exit(1);
  }

  for (const modDir of modDirs) {
    const modPath = path.join(MODS_DIR, modDir.name);
    const modJsonPath = path.join(modPath, 'mod.json');

    console.log(`\nValidating mod: ${modDir.name}`);

    if (!fs.existsSync(modJsonPath)) {
      console.error(`  Missing mod.json in ${modDir.name}`);
      totalErrors++;
      continue;
    }

    const modMeta = JSON.parse(fs.readFileSync(modJsonPath, 'utf-8'));
    const defFiles = discoverJsonFiles(modPath);

    const manifestPath = path.join(modPath, 'assets', 'manifest.json');
    let manifest: AssetManifest = {};
    if (fs.existsSync(manifestPath)) {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    }

    const localRegistry = new ContentRegistry();
    const loader = new ModLoader();
    const { errors } = loader.loadMod(modMeta, defFiles, manifest, modPath, localRegistry);

    if (errors.length > 0) {
      for (const err of errors) {
        console.error(`  ERROR: ${err}`);
      }
      totalErrors += errors.length;
    }

    const manifestErrors = validateManifestFiles(manifest, path.join(modPath, 'assets'));
    for (const err of manifestErrors) {
      console.error(`  ASSET: ${err}`);
    }
    totalErrors += manifestErrors.length;

    const defCount = localRegistry.size;
    console.log(`  Loaded ${defCount} defs, ${Object.keys(manifest).length} manifest entries`);
  }

  console.log('');
  if (totalErrors > 0) {
    console.error(`VALIDATION FAILED: ${totalErrors} error(s)`);
    process.exit(1);
  } else {
    console.log('VALIDATION PASSED');
  }
}

main();
