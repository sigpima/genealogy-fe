import type { FamilyMember } from './types';

// Dev-only fixture for load-testing the tree canvas (see `?synthetic=N` in app/page.tsx).
export function generateSyntheticTree(count: number, seed = 1): FamilyMember {
  let state = seed >>> 0;
  const nextRandom = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };

  const root: FamilyMember = { id: 1, name: 'Nguyễn Văn 1' };
  const queue: FamilyMember[] = [root];
  let created = 1;
  let head = 0;

  while (created < count) {
    const parent = queue[head++];
    if (!parent) break;
    const remaining = count - created;
    // Never let the frontier run dry before `count` is reached.
    const minChildren = head >= queue.length ? 1 : 0;
    const childCount = Math.min(remaining, Math.max(minChildren, Math.floor(nextRandom() * 5)));
    if (childCount === 0) continue;
    parent.children = [];
    for (let i = 0; i < childCount; i++) {
      created++;
      const child: FamilyMember = { id: created, name: `Nguyễn Văn ${created}` };
      parent.children.push(child);
      queue.push(child);
    }
  }
  return root;
}
