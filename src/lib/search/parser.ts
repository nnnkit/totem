/**
 * Recursive-descent parser for the bookmark search grammar.
 *
 * Total parser: every input parses to *some* AST. Malformed operators fall
 * through to free-text terms. We never throw to the UI.
 *
 * Grammar (PRD §9):
 *   expression  := or_expr
 *   or_expr     := and_expr ( "OR" and_expr )*
 *   and_expr    := not_expr ( ("AND" | implicit) not_expr )*
 *   not_expr    := ("-" | "NOT")? atom
 *   atom        := operator | phrase | term | "(" expression ")"
 *   operator    := KEY ":" VALUE
 *   phrase      := "\"" .* "\""
 *
 * Implicit AND between adjacent atoms.
 */

export type Ast =
  | AndNode
  | OrNode
  | NotNode
  | TermNode
  | PhraseNode
  | OperatorNode
  | EmptyNode;

export interface AndNode {
  kind: "and";
  children: Ast[];
}
export interface OrNode {
  kind: "or";
  children: Ast[];
}
export interface NotNode {
  kind: "not";
  child: Ast;
}
export interface TermNode {
  kind: "term";
  value: string;
}
export interface PhraseNode {
  kind: "phrase";
  value: string;
}
export interface OperatorNode {
  kind: "operator";
  key: OperatorKey;
  /** Original (case-preserved) operator value as the user typed it. */
  value: string;
}
export interface EmptyNode {
  kind: "empty";
}

export type OperatorKey =
  | "from"
  | "to"
  | "tag"
  | "site"
  | "url"
  | "since"
  | "until"
  | "within"
  | "older_than"
  | "min_faves"
  | "min_retweets"
  | "min_replies"
  | "has"
  | "filter"
  | "is"
  | "lang";

const OPERATOR_KEYS: ReadonlySet<string> = new Set<OperatorKey>([
  "from",
  "to",
  "tag",
  "site",
  "url",
  "since",
  "until",
  "within",
  "older_than",
  "min_faves",
  "min_retweets",
  "min_replies",
  "has",
  "filter",
  "is",
  "lang",
]);

const OPERATOR_ALIASES: Record<string, OperatorKey> = {
  // Twitter advanced-search compat
  min_likes: "min_faves",
  min_reposts: "min_retweets",
  within_time: "within",
};

// ---------- Tokenization ----------

type Tok =
  | { type: "lparen" }
  | { type: "rparen" }
  | { type: "or" }
  | { type: "and" }
  | { type: "not" }
  | { type: "minus" }
  | { type: "phrase"; value: string }
  | { type: "operator"; key: OperatorKey; value: string }
  | { type: "word"; value: string };

function lex(input: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const n = input.length;

  while (i < n) {
    const c = input[i];

    if (c === " " || c === "\t" || c === "\n") {
      i++;
      continue;
    }
    if (c === "(") {
      toks.push({ type: "lparen" });
      i++;
      continue;
    }
    if (c === ")") {
      toks.push({ type: "rparen" });
      i++;
      continue;
    }
    if (c === '"') {
      // Quoted phrase
      let j = i + 1;
      while (j < n && input[j] !== '"') j++;
      const value = input.slice(i + 1, j);
      toks.push({ type: "phrase", value });
      i = j < n ? j + 1 : j;
      continue;
    }
    if (c === "-") {
      // "-" is exclusion when at the start of an atom (followed by word/operator/paren/quote).
      const next = input[i + 1];
      if (
        next != null &&
        next !== " " &&
        next !== "\t" &&
        next !== ")" &&
        next !== ""
      ) {
        toks.push({ type: "minus" });
        i++;
        continue;
      }
    }

    // Read a "word run" — sequence of non-whitespace chars up to the next
    // top-level boundary. May contain ":" for operators.
    let j = i;
    while (
      j < n &&
      input[j] !== " " &&
      input[j] !== "\t" &&
      input[j] !== "\n" &&
      input[j] !== "(" &&
      input[j] !== ")" &&
      input[j] !== '"'
    ) {
      j++;
    }
    const raw = input.slice(i, j);
    i = j;

    // Special words: AND / OR / NOT (case-sensitive uppercase per Twitter convention)
    if (raw === "OR") {
      toks.push({ type: "or" });
      continue;
    }
    if (raw === "AND") {
      toks.push({ type: "and" });
      continue;
    }
    if (raw === "NOT") {
      toks.push({ type: "not" });
      continue;
    }

    // Operator? "key:value"
    const colonAt = raw.indexOf(":");
    if (colonAt > 0 && colonAt < raw.length - 1) {
      const keyRaw = raw.slice(0, colonAt).toLowerCase();
      const value = raw.slice(colonAt + 1);
      const aliased = OPERATOR_ALIASES[keyRaw] ?? (keyRaw as OperatorKey);
      if (OPERATOR_KEYS.has(aliased)) {
        toks.push({ type: "operator", key: aliased, value });
        continue;
      }
    }

    // @handle or #tag at the start of a word — sugar for `from:` / `tag:`.
    if (raw.length > 1 && raw[0] === "@") {
      toks.push({ type: "operator", key: "from", value: raw.slice(1) });
      continue;
    }

    if (raw.length > 0) {
      toks.push({ type: "word", value: raw });
    }
  }

  return toks;
}

// ---------- Parser ----------

class Parser {
  private toks: Tok[];
  private pos = 0;

  constructor(toks: Tok[]) {
    this.toks = toks;
  }

  parse(): Ast {
    if (this.toks.length === 0) return { kind: "empty" };
    const ast = this.parseOr();
    return ast;
  }

  private peek(): Tok | null {
    return this.toks[this.pos] ?? null;
  }

  private consume(): Tok | null {
    return this.toks[this.pos++] ?? null;
  }

  private parseOr(): Ast {
    const first = this.parseAnd();
    const branches: Ast[] = [first];
    while (this.peek()?.type === "or") {
      this.consume();
      branches.push(this.parseAnd());
    }
    if (branches.length === 1) return first;
    return { kind: "or", children: branches };
  }

  private parseAnd(): Ast {
    const first = this.parseNot();
    const children: Ast[] = [first];
    while (true) {
      const next = this.peek();
      if (!next) break;
      if (next.type === "or" || next.type === "rparen") break;
      // Explicit AND or implicit (any next atom)
      if (next.type === "and") this.consume();
      children.push(this.parseNot());
    }
    if (children.length === 1) return first;
    return { kind: "and", children };
  }

  private parseNot(): Ast {
    const next = this.peek();
    if (next && (next.type === "minus" || next.type === "not")) {
      this.consume();
      const child = this.parseAtom();
      return { kind: "not", child };
    }
    return this.parseAtom();
  }

  private parseAtom(): Ast {
    const next = this.consume();
    if (!next) return { kind: "empty" };
    switch (next.type) {
      case "lparen": {
        const inner = this.parseOr();
        // Tolerate missing closing paren — parser is total.
        if (this.peek()?.type === "rparen") this.consume();
        return inner;
      }
      case "phrase":
        return { kind: "phrase", value: next.value };
      case "operator":
        return { kind: "operator", key: next.key, value: next.value };
      case "word":
        return { kind: "term", value: next.value };
      case "rparen":
        return { kind: "empty" };
      // Misplaced operators — treat as term.
      default:
        return { kind: "term", value: "" };
    }
  }
}

export function parseQuery(input: string): Ast {
  const trimmed = input.trim();
  if (!trimmed) return { kind: "empty" };
  const toks = lex(trimmed);
  return new Parser(toks).parse();
}

// ---------- AST helpers ----------

/**
 * Walk the AST and collect free-text terms (and phrase values) for highlighting.
 * Operator values aren't included — they get matched structurally, not as text.
 */
export function collectFreeTextTerms(ast: Ast): string[] {
  const out: string[] = [];
  const walk = (node: Ast, negated: boolean) => {
    switch (node.kind) {
      case "term":
        if (!negated && node.value) out.push(node.value);
        return;
      case "phrase":
        if (!negated && node.value) out.push(node.value);
        return;
      case "and":
      case "or":
        for (const c of node.children) walk(c, negated);
        return;
      case "not":
        walk(node.child, !negated);
        return;
      case "operator":
      case "empty":
        return;
    }
  };
  walk(ast, false);
  return out;
}

/**
 * Recompose the free-text portion of a query (drops operators) so we can
 * pass it to MiniSearch. Negations are dropped — MiniSearch handles AND/OR
 * via combineWith and we model NOT structurally above.
 */
export function freeTextQuery(ast: Ast): string {
  const terms = collectFreeTextTerms(ast);
  return terms.join(" ");
}
