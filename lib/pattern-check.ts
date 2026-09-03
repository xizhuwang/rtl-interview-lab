type Rule = { pattern: string; flags?: string; reject?: boolean };

// Preserve string literals (e.g. uvm_macros.svh); discard only actual comments.
export function patternFailures<T extends Rule>(source: string, rules: T[]): T[] {
  const code = source.replace(/"(?:\\.|[^"\\])*"|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (token) => token.startsWith('"') ? token : ' ');
  return rules.filter((rule) => {
    const matches = new RegExp(rule.pattern, rule.flags).test(code);
    return rule.reject ? matches : !matches;
  });
}
