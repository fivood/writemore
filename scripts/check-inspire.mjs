// 用 Vite 的 SSR 加载器跑 src/inspire/selfcheck.ts（不用装别的依赖）
import { createServer } from 'vite';

const server = await createServer({ configFile: false, appType: 'custom', logLevel: 'error', server: { middlewareMode: true, hmr: false } });
try {
  await server.ssrLoadModule('/src/inspire/selfcheck.ts');
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await server.close();
}
