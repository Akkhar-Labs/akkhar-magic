/**
 * Akkhar-Magic :: Build Script
 * =============================
 * Bundles the entire project into a single CJS file using esbuild,
 * then packages it into a standalone .exe using Node SEA.
 *
 * Usage:
 *   node scripts/build.cjs          — bundle only
 *   node scripts/build.cjs --sea    — bundle + create .exe
 */

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const BUNDLE_PATH = path.join(DIST, 'akkhar-magic.cjs');
const SEA_CONFIG = path.join(DIST, 'sea-config.json');
const SEA_BLOB = path.join(DIST, 'sea-prep.blob');
const EXE_NAME = 'akkhar-magic.exe';
const EXE_PATH = path.join(DIST, EXE_NAME);

const isSea = process.argv.includes('--sea');
const isDist = process.argv.includes('--dist');

async function bundle() {
  console.log('📦 Bundling with esbuild...');

  if (!fs.existsSync(DIST)) {
    fs.mkdirSync(DIST, { recursive: true });
  }

  await esbuild.build({
    entryPoints: [path.join(ROOT, 'src', 'index.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outfile: BUNDLE_PATH,
    minify: false,
    sourcemap: false,
    // Keep readable for debugging
    keepNames: true,
    // Handle ESM → CJS conversion
    banner: {
      js: [
        '// Akkhar-Magic v0.0.1 — Bundled Build',
        '// Akkhar-Labs | A PRIME Ecosystem Company',
        '',
      ].join('\n'),
    },
    // puppeteer-extra has complex plugin loading — keep external
    // and ship node_modules alongside for now
    external: [
      'puppeteer-core',
      'puppeteer-extra',
      'puppeteer-extra-plugin-stealth',
    ],
    logOverride: {
      'empty-import-meta': 'silent',
    },
  });

  const stats = fs.statSync(BUNDLE_PATH);
  console.log(
    `✅ Bundle: ${BUNDLE_PATH} (${(stats.size / 1024).toFixed(1)} KB)`,
  );
}

function buildSea() {
  console.log('\n🔨 Building standalone .exe with Node SEA...');

  // Step 1: Create SEA config
  const seaConfig = {
    main: BUNDLE_PATH,
    output: SEA_BLOB,
    disableExperimentalSEAWarning: true,
    useSnapshot: false,
    useCodeCache: true,
  };
  fs.writeFileSync(SEA_CONFIG, JSON.stringify(seaConfig, null, 2));
  console.log('  → SEA config written');

  // Step 2: Generate blob
  console.log('  → Generating SEA blob...');
  execSync(`node --experimental-sea-config "${SEA_CONFIG}"`, {
    cwd: ROOT,
    stdio: 'inherit',
  });

  // Step 3: Copy node.exe
  const nodeExe = process.execPath;
  fs.copyFileSync(nodeExe, EXE_PATH);
  console.log(`  → Copied node.exe → ${EXE_NAME}`);

  // Step 4: Remove signature (Windows requires this before injection)
  try {
    execSync(`signtool remove /s "${EXE_PATH}"`, { stdio: 'pipe' });
    console.log('  → Removed existing signature');
  } catch {
    // signtool not available or no signature — fine
    console.log('  → No signature to remove (OK)');
  }

  // Step 5: Inject blob
  console.log('  → Injecting SEA blob...');
  execSync(
    `npx postject "${EXE_PATH}" NODE_SEA_BLOB "${SEA_BLOB}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`,
    { cwd: ROOT, stdio: 'inherit' },
  );

  const exeStats = fs.statSync(EXE_PATH);
  console.log(
    `\n✅ Executable: ${EXE_PATH} (${(exeStats.size / 1024 / 1024).toFixed(1)} MB)`,
  );
}

function buildDist() {
  console.log('\n📂 Creating portable distribution...');

  const DIST_DIR = path.join(DIST, 'akkhar-magic');
  const DIST_NM = path.join(DIST_DIR, 'node_modules');

  // Clean & create
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(DIST_DIR, { recursive: true });

  // Copy bundle
  fs.copyFileSync(BUNDLE_PATH, path.join(DIST_DIR, 'akkhar-magic.cjs'));
  console.log('  → Copied bundle');

  // Copy required node_modules
  const requiredPkgs = [
    'puppeteer-core',
    'puppeteer-extra',
    'puppeteer-extra-plugin-stealth',
    'puppeteer-extra-plugin',
    'puppeteer-extra-plugin-user-preferences',
    'puppeteer-extra-plugin-user-data-dir',
    'debug',
    'ms',
    'merge-deep',
    'kind-of',
    'clone-deep',
    'shallow-clone',
    'is-plain-object',
    'chromium-bidi',
    'mitt',
    'urlpattern-polyfill',
    'zod',
    'devtools-protocol',
    'ws',
    '@anthropic-ai',
    '@puppeteer',
  ];

  const srcNm = path.join(ROOT, 'node_modules');
  fs.mkdirSync(DIST_NM, { recursive: true });

  for (const pkg of requiredPkgs) {
    const srcPkg = path.join(srcNm, pkg);
    const dstPkg = path.join(DIST_NM, pkg);
    if (fs.existsSync(srcPkg)) {
      copyDirSync(srcPkg, dstPkg);
    }
  }

  // Also copy scoped packages that puppeteer needs
  const scopedDirs = ['@anthropic-ai', '@puppeteer'];
  for (const scope of scopedDirs) {
    const srcScope = path.join(srcNm, scope);
    const dstScope = path.join(DIST_NM, scope);
    if (fs.existsSync(srcScope)) {
      copyDirSync(srcScope, dstScope);
    }
  }

  console.log('  → Copied dependencies');

  // Create launcher .bat
  const batContent = `@echo off\r\ntitle Akkhar-Magic v0.0.1\r\necho.\r\necho   Starting Akkhar-Magic...\r\necho.\r\nnode "%~dp0akkhar-magic.cjs" %*\r\nif errorlevel 1 (\r\n  echo.\r\n  echo   ERROR: Akkhar-Magic failed to start.\r\n  echo   Make sure Node.js v20+ is installed: https://nodejs.org\r\n  echo.\r\n  pause\r\n)\r\n`;
  fs.writeFileSync(path.join(DIST_DIR, 'akkhar-magic.bat'), batContent);
  console.log('  → Created launcher: akkhar-magic.bat');

  // Calculate size
  const totalSize = getDirSize(DIST_DIR);
  console.log(
    `\n✅ Distribution: ${DIST_DIR} (${(totalSize / 1024 / 1024).toFixed(1)} MB)`,
  );
  console.log('   Users need Node.js v20+ installed.');
  console.log('   Double-click akkhar-magic.bat to start.');
}

function copyDirSync(src, dst) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

function getDirSize(dir) {
  let size = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      size += getDirSize(p);
    } else {
      size += fs.statSync(p).size;
    }
  }
  return size;
}

async function main() {
  try {
    await bundle();
    if (isDist) {
      buildDist();
    } else if (isSea) {
      buildSea();
    } else {
      console.log('\n💡 Build options:');
      console.log(
        '   node scripts/build.cjs --dist   Portable folder (recommended)',
      );
      console.log(
        '   node scripts/build.cjs --sea    Standalone .exe (experimental)',
      );
    }
  } catch (err) {
    console.error('❌ Build failed:', err.message || err);
    process.exit(1);
  }
}

main();
