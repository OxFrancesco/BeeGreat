import { join } from 'node:path';
import { tmpdir } from 'node:os';
const root = import.meta.dir;
const dependencyRoot = process.env.AERO_THREE_ROOT;
if (!dependencyRoot) throw new Error('Set AERO_THREE_ROOT to the installed three@0.180.0 package directory.');
const test = process.argv.includes('--test');
const outdir = test ? join(tmpdir(), 'aero-scene-tests') : join(root, 'public');
const result = await Bun.build({
  entrypoints: [join(root, test ? 'src/scene-collisions.test.js' : 'src/scene.js')], outdir,
  naming: test ? 'scene-collisions.test.js' : 'scene.js', minify: !test, target: test ? 'bun' : 'browser',
  external: test ? ['bun:test'] : [],
  plugins: [{ name: 'pinned-three', setup(build) {
    build.onResolve({ filter: /^three(?:\/|$)/ }, ({ path }) => ({
      path: path === 'three' ? join(dependencyRoot, 'build/three.module.js') : path.replace('three/addons/', join(dependencyRoot, 'examples/jsm/')),
    }));
  } }],
});
if (!result.success) throw new Error(result.logs.map(String).join('\n'));
if (test) {
  const child = Bun.spawn(['bun', 'test', join(outdir, 'scene-collisions.test.js')], {
    env: { ...process.env, AERO_SCENE_MODEL: join(root, 'public/aero-scene.glb') },
    stdout: 'inherit', stderr: 'inherit',
  });
  if (await child.exited !== 0) throw new Error('Scene collision tests failed.');
} else console.log('Built interactive scene');
