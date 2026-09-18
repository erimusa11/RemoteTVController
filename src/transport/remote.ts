/**
 * Metro never loads this file: it resolves `remote.web.ts` on web and
 * `remote.native.ts` on Android/iOS via platform extensions. It exists so
 * TypeScript can resolve `import remote from './transport/remote'` — both
 * implementations satisfy the same `AtvRemote` interface.
 */
export { default } from './remote.web';
