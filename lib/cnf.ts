export type CnfGrade = { ok: boolean; message: string };

type ParsedCnf = { variables: number; clauses: number[][] };

function parseDimacs(source: string): ParsedCnf {
  if (source.length > 32768) throw new Error('Exercise limit: 32 KiB of DIMACS input.');
  const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const header = lines.find((line) => line.startsWith('p '));
  if (lines.filter((line) => line.startsWith('p ')).length > 1) throw new Error('Use exactly one DIMACS header.');
  if (!header) throw new Error('Missing `p cnf <variables> <clauses>` header.');
  const match = header.match(/^p\s+cnf\s+(\d+)\s+(\d+)$/i);
  if (!match) throw new Error('Invalid DIMACS header.');
  const variables = Number(match[1]);
  const declaredClauses = Number(match[2]);
  const tokens = lines.filter((line) => !line.startsWith('c') && !line.startsWith('p ')).join(' ').split(/\s+/).map(Number);
  const clauses: number[][] = [];
  let clause: number[] = [];
  for (const literal of tokens) {
    if (!Number.isInteger(literal)) throw new Error('CNF contains a non-integer token.');
    if (literal === 0) { if (!clause.length) throw new Error('Empty clauses are not used in this exercise.'); clauses.push(clause); clause = []; continue; }
    if (Math.abs(literal) > variables) throw new Error(`Literal ${literal} exceeds the declared variable count.`);
    clause.push(literal);
  }
  if (clause.length) throw new Error('Every DIMACS clause must end with 0.');
  if (clauses.length !== declaredClauses) throw new Error(`Header declares ${declaredClauses} clauses, but ${clauses.length} were parsed.`);
  return { variables, clauses };
}

function clauseValue(clause: number[], assignment: Map<number, boolean>) {
  let unresolved = false;
  for (const literal of clause) {
    const value = assignment.get(Math.abs(literal));
    if (value === undefined) { unresolved = true; continue; }
    if ((literal > 0 && value) || (literal < 0 && !value)) return true;
  }
  return unresolved ? undefined : false;
}

function solveDpll(clauses: number[][], variables: number, seed = new Map<number, boolean>()): Map<number, boolean> | null {
  const assignment = new Map(seed);
  while (true) {
    let unit: number | null = null;
    for (const clause of clauses) {
      if (clauseValue(clause, assignment) === false) return null;
      const open = clause.filter((literal) => assignment.get(Math.abs(literal)) === undefined);
      if (clauseValue(clause, assignment) === undefined && open.length === 1) { unit = open[0]; break; }
    }
    if (unit === null) break;
    const variable = Math.abs(unit);
    const value = unit > 0;
    if (assignment.has(variable) && assignment.get(variable) !== value) return null;
    assignment.set(variable, value);
  }
  if (clauses.every((clause) => clauseValue(clause, assignment) === true)) return assignment;
  let next = 1;
  while (next <= variables && assignment.has(next)) next += 1;
  if (next > variables) return null;
  for (const value of [false, true]) {
    const branch = new Map(assignment); branch.set(next, value);
    const solved = solveDpll(clauses, variables, branch);
    if (solved) return solved;
  }
  return null;
}

export function gradeXorCnf(source: string, locale: 'zh' | 'en'): CnfGrade {
  try {
    const parsed = parseDimacs(source);
    if (parsed.variables !== 3) throw new Error('This exercise requires exactly three variables: 1=a, 2=b, 3=x.');
    const model = solveDpll(parsed.clauses, parsed.variables);
    if (!model) return { ok: false, message: locale === 'zh' ? 'SAT solver 回報 UNSAT；XOR 關係本來應該有四組合法模型。' : 'The SAT solver returned UNSAT, but XOR should have four legal models.' };
    for (let mask = 0; mask < 8; mask += 1) {
      const values = new Map([[1, Boolean(mask & 1)], [2, Boolean(mask & 2)], [3, Boolean(mask & 4)]]);
      const formula = parsed.clauses.every((clause) => clauseValue(clause, values) === true);
      const expected = values.get(3) === (values.get(1) !== values.get(2));
      if (formula !== expected) {
        const counterexample = `a=${Number(values.get(1))}, b=${Number(values.get(2))}, x=${Number(values.get(3))}`;
        return { ok: false, message: locale === 'zh' ? `SAT/真值檢查找到反例：${counterexample}。你的 CNF 與 x=a XOR b 不等價。` : `SAT/truth-table checking found a counterexample: ${counterexample}. Your CNF is not equivalent to x=a XOR b.` };
      }
    }
    const modelText = [1, 2, 3].map((variable) => `${['', 'a', 'b', 'x'][variable]}=${Number(Boolean(model.get(variable)))}`).join(', ');
    return { ok: true, message: locale === 'zh' ? `CNF 等價檢查通過。瀏覽器內 DPLL solver 找到其中一組 SAT model：${modelText}。其餘不符合 XOR 的 assignment 都被 clauses 排除。` : `CNF equivalence passed. The in-browser DPLL solver found one SAT model: ${modelText}. Every non-XOR assignment is excluded by the clauses.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
