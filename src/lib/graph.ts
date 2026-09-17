import type { Workspace } from '../types';
// A branch follows source → target. Shared descendants and everything below
// them survive; deleting a branch must not swallow an unrelated parent graph.
export function branchNodeIds(workspace: Workspace, root: string): Set<string> {
  const reachable = new Set([root]);
  const children = new Map<string, string[]>();
  for (const edge of workspace.edges) children.set(edge.source, [...(children.get(edge.source) || []), edge.target]);
  const visit = (start: string, set: Set<string>, allowed?: Set<string>) => {
    const queue = [start];
    for (let i = 0; i < queue.length; i++) for (const child of children.get(queue[i]) || []) {
      if (child !== root && !set.has(child) && (!allowed || allowed.has(child))) { set.add(child); queue.push(child); }
    }
  };
  visit(root, reachable);
  const protectedNodes = new Set<string>();
  for (const edge of workspace.edges) if (edge.target !== root && reachable.has(edge.target) && !reachable.has(edge.source)) {
    protectedNodes.add(edge.target); visit(edge.target, protectedNodes, reachable);
  }
  return new Set([...reachable].filter(id => !protectedNodes.has(id)));
}
