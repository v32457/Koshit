/**
 * KOSH INNOVATIONS — RESTRICTED CHARGE FORMULA EVALUATOR
 * Pure recursive-descent tokenizer & AST evaluator.
 * SECURITY INVARIANT: Never uses eval(), new Function(), or dynamic code execution.
 * Only permits numeric literals, arithmetic (+, -, *, /), parentheses,
 * strictly whitelisted variables, and safe math functions (min, max, round, ceil, floor, abs).
 */

import { RoundingRule } from '../types/chargeManagement';

export interface FormulaVariables {
  materialValue: number;
  totalPoMaterialValue: number;
  quantity: number;
  receivedQuantity: number;
  grossWeightKg: number;
  netWeightKg: number;
  weightMt: number;
  volumeCbm: number;
  distanceKm: number;
  shipments: number;
  trips: number;
  days: number;
  rate: number;
  customsValue: number;
  invoiceAmount: number;
}

const ALLOWED_VARIABLES = new Set<keyof FormulaVariables>([
  'materialValue',
  'totalPoMaterialValue',
  'quantity',
  'receivedQuantity',
  'grossWeightKg',
  'netWeightKg',
  'weightMt',
  'volumeCbm',
  'distanceKm',
  'shipments',
  'trips',
  'days',
  'rate',
  'customsValue',
  'invoiceAmount',
]);

const ALLOWED_FUNCTIONS = new Set(['min', 'max', 'round', 'ceil', 'floor', 'abs']);

type Token =
  | { type: 'NUMBER'; value: number }
  | { type: 'IDENT'; value: string }
  | { type: 'OP'; value: '+' | '-' | '*' | '/' }
  | { type: 'LPAREN' }
  | { type: 'RPAREN' }
  | { type: 'COMMA' };

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = expr.trim();
  if (!s) throw new Error('Formula expression cannot be empty.');
  if (s.length > 500) throw new Error('Formula expression exceeds maximum allowed length (500 characters).');

  // Block any forbidden characters or constructs immediately
  if (/[;{}\[\]`$"'\\=<>!&|?~^%]/.test(s)) {
    throw new Error('Formula contains disallowed syntax or control characters.');
  }

  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch >= '0' && ch <= '9' || ch === '.') {
      let numStr = '';
      let dotCount = 0;
      while (i < s.length && ((s[i] >= '0' && s[i] <= '9') || s[i] === '.')) {
        if (s[i] === '.') dotCount++;
        if (dotCount > 1) throw new Error('Invalid numeric literal in formula.');
        numStr += s[i++];
      }
      const val = Number(numStr);
      if (!Number.isFinite(val)) throw new Error(`Invalid number "${numStr}" in formula.`);
      tokens.push({ type: 'NUMBER', value: val });
      continue;
    }
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
      let ident = '';
      while (
        i < s.length &&
        ((s[i] >= 'a' && s[i] <= 'z') ||
          (s[i] >= 'A' && s[i] <= 'Z') ||
          (s[i] >= '0' && s[i] <= '9') ||
          s[i] === '_')
      ) {
        ident += s[i++];
      }
      tokens.push({ type: 'IDENT', value: ident });
      continue;
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ type: 'OP', value: ch });
      i++;
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: 'LPAREN' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'RPAREN' });
      i++;
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'COMMA' });
      i++;
      continue;
    }
    throw new Error(`Unexpected character "${ch}" in formula.`);
  }
  return tokens;
}

class FormulaParser {
  private pos = 0;
  constructor(
    private readonly tokens: Token[],
    private readonly vars: FormulaVariables
  ) {}

  parse(): number {
    const val = this.parseExpression();
    if (this.pos < this.tokens.length) {
      throw new Error('Unexpected trailing token in formula.');
    }
    if (!Number.isFinite(val)) {
      throw new Error('Formula evaluation produced a non-finite result.');
    }
    return val;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    return this.tokens[this.pos++];
  }

  private parseExpression(): number {
    let left = this.parseTerm();
    while (true) {
      const t = this.peek();
      if (t && t.type === 'OP' && (t.value === '+' || t.value === '-')) {
        this.consume();
        const right = this.parseTerm();
        left = t.value === '+' ? left + right : left - right;
      } else {
        break;
      }
    }
    return left;
  }

  private parseTerm(): number {
    let left = this.parseUnary();
    while (true) {
      const t = this.peek();
      if (t && t.type === 'OP' && (t.value === '*' || t.value === '/')) {
        this.consume();
        const right = this.parseUnary();
        if (t.value === '/') {
          if (Math.abs(right) < 1e-12) {
            throw new Error('Division by zero in charge calculation formula.');
          }
          left = left / right;
        } else {
          left = left * right;
        }
      } else {
        break;
      }
    }
    return left;
  }

  private parseUnary(): number {
    const t = this.peek();
    if (t && t.type === 'OP' && (t.value === '+' || t.value === '-')) {
      this.consume();
      const val = this.parseUnary();
      return t.value === '-' ? -val : val;
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    const t = this.peek();
    if (!t) throw new Error('Unexpected end of formula expression.');

    if (t.type === 'NUMBER') {
      this.consume();
      return t.value;
    }

    if (t.type === 'LPAREN') {
      this.consume();
      const val = this.parseExpression();
      const closing = this.peek();
      if (!closing || closing.type !== 'RPAREN') {
        throw new Error('Mismatched parentheses in formula.');
      }
      this.consume();
      return val;
    }

    if (t.type === 'IDENT') {
      this.consume();
      const next = this.peek();
      // Function call?
      if (next && next.type === 'LPAREN') {
        if (!ALLOWED_FUNCTIONS.has(t.value)) {
          throw new Error(`Function "${t.value}" is not whitelisted in charge formulas.`);
        }
        this.consume(); // '('
        const args: number[] = [];
        if (this.peek()?.type !== 'RPAREN') {
          args.push(this.parseExpression());
          while (this.peek()?.type === 'COMMA') {
            this.consume();
            args.push(this.parseExpression());
          }
        }
        if (this.peek()?.type !== 'RPAREN') {
          throw new Error(`Missing closing parenthesis for function "${t.value}".`);
        }
        this.consume(); // ')'
        return this.evalFunction(t.value, args);
      }

      // Variable reference
      if (!ALLOWED_VARIABLES.has(t.value as keyof FormulaVariables)) {
        throw new Error(`Unknown or disallowed formula variable "${t.value}".`);
      }
      return Number(this.vars[t.value as keyof FormulaVariables] ?? 0);
    }

    throw new Error('Invalid syntax token in formula.');
  }

  private evalFunction(fn: string, args: number[]): number {
    if (args.length === 0) throw new Error(`Function "${fn}" requires at least 1 argument.`);
    switch (fn) {
      case 'min':
        return Math.min(...args);
      case 'max':
        return Math.max(...args);
      case 'abs':
        if (args.length !== 1) throw new Error('abs() expects exactly 1 argument.');
        return Math.abs(args[0]);
      case 'ceil':
        if (args.length !== 1) throw new Error('ceil() expects exactly 1 argument.');
        return Math.ceil(args[0]);
      case 'floor':
        if (args.length !== 1) throw new Error('floor() expects exactly 1 argument.');
        return Math.floor(args[0]);
      case 'round': {
        if (args.length === 1) return Math.round(args[0]);
        if (args.length === 2) {
          const factor = Math.pow(10, Math.min(6, Math.max(0, Math.trunc(args[1]))));
          return Math.round(args[0] * factor) / factor;
        }
        throw new Error('round() expects 1 or 2 arguments.');
      }
      default:
        throw new Error(`Unsupported function "${fn}".`);
    }
  }
}

export function roundWithRule(value: number, precision = 2, rule: RoundingRule = 'HALF_UP'): number {
  if (!Number.isFinite(value)) return 0;
  const safePrec = Math.max(0, Math.min(6, Math.trunc(precision)));
  const factor = Math.pow(10, safePrec);
  const scaled = value * factor;

  switch (rule) {
    case 'FLOOR':
      return Math.floor(scaled + 1e-9) / factor;
    case 'CEIL':
      return Math.ceil(scaled - 1e-9) / factor;
    case 'BANKERS': {
      const floorVal = Math.floor(scaled);
      const frac = Math.abs(scaled - floorVal);
      if (Math.abs(frac - 0.5) < 1e-9) {
        return (floorVal % 2 === 0 ? floorVal : floorVal + 1) / factor;
      }
      return Math.round(scaled) / factor;
    }
    case 'HALF_UP':
    default:
      return Math.round((scaled + Math.sign(scaled) * 1e-9)) / factor;
  }
}

export function validateChargeFormula(expression: string): { valid: boolean; error?: string } {
  try {
    const dummyVars: FormulaVariables = {
      materialValue: 1000,
      totalPoMaterialValue: 1000,
      quantity: 10,
      receivedQuantity: 10,
      grossWeightKg: 100,
      netWeightKg: 95,
      weightMt: 0.1,
      volumeCbm: 1,
      distanceKm: 50,
      shipments: 1,
      trips: 1,
      days: 1,
      rate: 100,
      customsValue: 1000,
      invoiceAmount: 1000,
    };
    const tokens = tokenize(expression);
    const parser = new FormulaParser(tokens, dummyVars);
    parser.parse();
    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: err?.message || 'Invalid formula syntax.' };
  }
}

export function evaluateChargeFormula(
  expression: string,
  variables: Partial<FormulaVariables>
): { value: number; trace: string } {
  const fullVars: FormulaVariables = {
    materialValue: Number(variables.materialValue) || 0,
    totalPoMaterialValue: Number(variables.totalPoMaterialValue) || 0,
    quantity: Number(variables.quantity) || 0,
    receivedQuantity: Number(variables.receivedQuantity) || 0,
    grossWeightKg: Number(variables.grossWeightKg) || 0,
    netWeightKg: Number(variables.netWeightKg) || 0,
    weightMt: Number(variables.weightMt) || 0,
    volumeCbm: Number(variables.volumeCbm) || 0,
    distanceKm: Number(variables.distanceKm) || 0,
    shipments: Number(variables.shipments) || 0,
    trips: Number(variables.trips) || 0,
    days: Number(variables.days) || 0,
    rate: Number(variables.rate) || 0,
    customsValue: Number(variables.customsValue) || 0,
    invoiceAmount: Number(variables.invoiceAmount) || 0,
  };

  const tokens = tokenize(expression);
  const parser = new FormulaParser(tokens, fullVars);
  const rawResult = parser.parse();

  if (rawResult < 0) {
    throw new Error(`Charge calculation produced a negative value (${rawResult}), which is prohibited.`);
  }

  return {
    value: rawResult,
    trace: `expr="${expression}" => ${rawResult}`,
  };
}
