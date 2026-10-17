export type Relationship = {
  kind: 'self' | 'spouse' | 'blood' | 'in_law' | 'none';
  a_is: string | null;
  b_is: string | null;
  sentence: string;
  common_ancestor: { id: number; name: string } | null;
  steps_a: number | null;
  steps_b: number | null;
};

const upper = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The lines to show for "A and B": who each is to the other, then the common ancestor. The API's `sentence` already
 * says what A is to B; the second line says what B is to A.
 */
export function relationLines(result: Relationship, aName: string, bName: string): string[] {
  if (result.kind === 'self' || result.kind === 'none') return [result.sentence];
  const lines = [result.sentence];
  if (result.b_is) lines.push(`${bName} là ${result.b_is} của ${aName}.`);
  const ancestor = result.common_ancestor;
  if (ancestor && result.kind !== 'spouse' && result.steps_a !== null && result.steps_b !== null) {
    if (ancestor.name !== aName && ancestor.name !== bName) {
      lines.push(
        `Tổ chung gần nhất: ${ancestor.name} (cách ${aName} ${result.steps_a} đời, cách ${bName} ${result.steps_b} đời).`,
      );
    }
  }
  return lines.map(upper);
}
