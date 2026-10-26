// Shared AI query surface. Grid queries live with maze permissions; hunter
// policy lives in hunters.ts. The old random A* chase implementation is removed.
export { findPath, lineOfSight } from './maze';
export * from './hunters';
