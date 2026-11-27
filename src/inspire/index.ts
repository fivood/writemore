/**
 * 灵感模块：只有数据和纯函数，不依赖 React、store、Dexie、Supabase、localStorage，
 * 也不 import 本目录以外的文件，整个目录可以直接拷给别的项目用（需要打包器支持 import JSON）。
 *
 * 会随机的函数都收可选 rng（默认 Math.random）。
 */
export * from './types';
export * from './words';
export * from './scenes';
export * from './challenges';
export * from './characters';
export * from './prompts';
