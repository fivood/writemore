// 灵感模块自检：src/inspire 不许引用目录外的文件，再用 Vite 的 SSR 加载器跑 selfcheck.ts（不用装别的依赖）
import { readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'vite';

const outside = readdirSync('src/inspire')
  .filter(f => /\.tsx?$/.test(f))
  .flatMap(f => [...readFileSync(`src/inspire/${f}`, 'utf8').matchAll(/from\s+['"]([^'"]+)['"]/g)]
    .map(m => m[1])
    .filter(spec => !spec.startsWith('./'))
    .map(spec => `${f} → ${spec}`));
if (outside.length) {
  console.error(`✗ src/inspire 引用了目录外的模块：\n  ${outside.join('\n  ')}`);
  process.exit(1);
}

const server = await createServer({ configFile: false, appType: 'custom', logLevel: 'error', server: { middlewareMode: true, hmr: false } });
try {
  await server.ssrLoadModule('/src/inspire/selfcheck.ts');
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await server.close();
}
