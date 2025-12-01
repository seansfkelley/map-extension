// @ts-check
const esbuild = require('esbuild');
const path = require('path');

const isWatch = process.argv.includes('--watch');

/** @type {esbuild.BuildOptions} */
const buildOptions = {
  entryPoints: ['src/content.ts', 'src/background.ts'],
  bundle: true,
  outdir: 'dist',
  format: 'esm',
  metafile: true,
  plugins: [
    {
      name: 'rebuild-logger',
      setup(build) {
        /** @type {number} */
        let startTime;

        build.onStart(() => {
          startTime = Date.now();
        });

        build.onEnd((result) => {
          const duration = Date.now() - startTime;

          if (result.errors.length > 0) {
            console.error(`Build failed (${duration}ms)`);
            return;
          }

          if (result.metafile) {
            const outputs = Object.keys(result.metafile.outputs)
              .map((file) => path.basename(file))
              .join(', ');
            console.log(`Built ${outputs} in ${duration}ms`);
          }
        });
      },
    },
  ],
};

async function build() {
  if (isWatch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('Watching for changes...');
  } else {
    await esbuild.build(buildOptions);
  }
}

build().catch(() => process.exit(1));
