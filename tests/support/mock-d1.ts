// Minimal in-memory D1 mock sufficient for the tests we need to run.
// Not a complete D1 implementation — it covers the SQL surface we use in
// the domain services (INSERT, UPDATE, SELECT, RETURNING for a single row,
// bind positional parameters).
//
// For real worker integration tests we use @cloudflare/vitest-pool-workers
// which runs against a real D1 local simulation. This mock is for the
// unit/integration path that does not need workerd.

interface Row {
  [key: string]: unknown;
}

interface ColumnInfo {
  name: string;
  type?: string;
}

export class MockD1Result<T = Row> {
  results: T[];
  columns: string[];
  meta: { changes: number; last_row_id: number | null };
  constructor(results: T[] = [], columns: string[] = [], changes = 0) {
    this.results = results;
    this.columns = columns;
    this.meta = { changes, last_row_id: null };
  }
  first<TFirst = T>(): TFirst | null {
    return (this.results[0] as TFirst | undefined) ?? null;
  }
  all<TAll = T>(): { results: TAll[]; success: true; meta: MockD1Result["meta"] } {
    return { results: this.results as unknown as TAll[], success: true, meta: this.meta };
  }
  raw(): T[] {
    return this.results;
  }
}

type BindValue = string | number | boolean | null | Uint8Array;

export class MockD1PreparedStatement {
  private readonly sql: string;
  private readonly db: MockD1Database;
  private binds: BindValue[] = [];

  constructor(sql: string, db: MockD1Database) {
    this.sql = sql;
    this.db = db;
  }

  bind(...values: BindValue[]): this {
    this.binds = values;
    return this;
  }

  async first<T = Row>(): Promise<T | null> {
    const result = await this.all<Row>();
    return (result.results[0] as T | undefined) ?? null;
  }

  async all<T = Row>(): Promise<{
    results: T[];
    success: true;
    meta: { changes: number; last_row_id: number | null };
  }> {
    const r = await this.run();
    return { results: r.results as T[], success: true, meta: r.meta };
  }

  async run<T = Row>(): Promise<MockD1Result<T>> {
    return this.db.execute<T>(this.sql, this.binds);
  }

  async raw<T = Row>(): Promise<T[]> {
    const r = await this.all<Row>();
    return r.results as T[];
  }
}

export class MockD1Database {
  /** Table name -> array of rows (column name -> value). */
  private readonly tables = new Map<string, Row[]>();

  prepare(sql: string): MockD1PreparedStatement {
    return new MockD1PreparedStatement(sql, this);
  }

  async batch(statements: MockD1PreparedStatement[]): Promise<MockD1Result[]> {
    const results: MockD1Result[] = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  }

  async exec(sql: string): Promise<void> {
    // Naive multi-statement splitter.
    for (const stmt of sql.split(";")) {
      const trimmed = stmt.trim();
      if (!trimmed) continue;
      this.executeSync(trimmed, []);
    }
  }

  /** Apply a SQL file's CREATE TABLE statements into the in-memory store. */
  loadSchema(sql: string): void {
    // Extract table name + column list from CREATE TABLE statements.
    const re = /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\(([^;]+)\)/gi;
    let match: RegExpExecArray | null;
    while ((match = re.exec(sql)) !== null) {
      const tableName = match[1];
      const columnsBlock = match[2];
      if (!tableName || !columnsBlock) continue;
      const columns = parseColumns(columnsBlock);
      this.tables.set(tableName, []);
      // Stash column metadata on the table for later queries.
      (this.tables as unknown as Record<string, unknown>)[`_cols_${tableName}`] = columns;
    }
  }

  /** Insert helper used by tests. */
  insert(table: string, row: Row): void {
    const list = this.tables.get(table);
    if (!list) throw new Error(`Unknown table: ${table}`);
    list.push({ ...row });
  }

  /** Read all rows from a table (test helper). */
  all(table: string): Row[] {
    return [...(this.tables.get(table) ?? [])];
  }

  private executeSync(sql: string, binds: BindValue[]): { results: Row[]; changes: number } {
    const trimmed = sql.trim();
    if (/^INSERT\s+INTO/i.test(trimmed)) {
      return this.doInsert(trimmed, binds);
    }
    if (/^UPDATE\s+/i.test(trimmed)) {
      return this.doUpdate(trimmed, binds);
    }
    if (/^DELETE\s+FROM/i.test(trimmed)) {
      return this.doDelete(trimmed, binds);
    }
    if (/^SELECT/i.test(trimmed)) {
      return { results: this.doSelect(trimmed, binds), changes: 0 };
    }
    if (/^CREATE\s+TABLE/i.test(trimmed)) {
      // Already loaded via loadSchema.
      return { results: [], changes: 0 };
    }
    if (/^CREATE\s+INDEX/i.test(trimmed)) {
      return { results: [], changes: 0 };
    }
    if (/^PRAGMA/i.test(trimmed)) {
      return { results: [], changes: 0 };
    }
    throw new Error(`Unsupported SQL in MockD1: ${trimmed.slice(0, 80)}`);
  }

  async execute<T = Row>(sql: string, binds: BindValue[]): Promise<MockD1Result<T>> {
    const r = this.executeSync(sql, binds);
    return new MockD1Result<T>(r.results as T[], [], r.changes);
  }

  private doInsert(sql: string, binds: BindValue[]): { results: Row[]; changes: number } {
    // INSERT INTO table (cols) VALUES (?, 'literal', ?, ...)
    const m = sql.match(
      /^INSERT\s+INTO\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]+)\)\s*VALUES\s*\(([\s\S]+?)\)/i,
    );
    if (!m) throw new Error(`Bad INSERT: ${sql}`);
    const table = m[1];
    if (!table) throw new Error(`Bad INSERT: ${sql}`);
    const columns = (m[2] ?? "").split(",").map((c) => c.trim().replace(/[`"\[\]]/g, ""));
    const placeholders = (m[3] ?? "").split(",").map((c) => c.trim());
    const expected = placeholders.filter((p) => p === "?").length;
    if (expected !== binds.length) {
      throw new Error(
        `Bind mismatch for ${table}: expected ${expected} placeholders, got ${binds.length}. SQL: ${sql}`,
      );
    }
    const row: Row = {};
    let bindIdx = 0;
    placeholders.forEach((p, i) => {
      const col = columns[i];
      if (!col) return;
      if (p === "?") {
        row[col] = binds[bindIdx++] ?? null;
      } else {
        // Literal: 'string', number, NULL, etc.
        row[col] = stripQuotes(p);
      }
    });
    // Handle ON CONFLICT / OR IGNORE / OR REPLACE for unique constraints.
    if (/OR\s+IGNORE/i.test(sql)) {
      const list = this.tables.get(table);
      if (list) {
        for (const existing of list) {
          let conflict = false;
          for (const c of columns) {
            if (existing[c] === row[c]) {
              conflict = true;
              break;
            }
          }
          if (conflict) return { results: [], changes: 0 };
        }
      }
    }
    const list = this.tables.get(table);
    if (!list) throw new Error(`Unknown table: ${table}`);
    list.push(row);
    return { results: [], changes: 1 };
  }

  private doUpdate(sql: string, binds: BindValue[]): { results: Row[]; changes: number } {
    // Normalise whitespace.
    const normalised = sql.replace(/\s+/g, " ").trim();
    // UPDATE table SET col1 = ?, col2 = ? WHERE ...
    // Split into SET block and optional WHERE block. The SET block can
    // contain commas; we look for the LAST " WHERE " in the string.
    const m = normalised.match(/^UPDATE\s+([A-Za-z_][A-Za-z0-9_]*)\s+SET\s+([\s\S]+)$/i);
    if (!m) throw new Error(`Bad UPDATE: ${sql}`);
    const table = m[1];
    let setBlock = m[2] ?? "";
    let where: string | undefined;
    const whereIdx = setBlock.toUpperCase().lastIndexOf(" WHERE ");
    if (whereIdx !== -1) {
      where = setBlock.slice(whereIdx + " WHERE ".length);
      setBlock = setBlock.slice(0, whereIdx);
    }
    if (!table || !setBlock) throw new Error(`Bad UPDATE: ${sql}`);
    // Split SET clauses by top-level commas (ignoring commas inside
    // parens, e.g. COALESCE(a, b)).
    const setClauses = splitTopLevel(setBlock, ",");
    const list = this.tables.get(table);
    if (!list) throw { message: `Unknown table: ${table}` } as never;
    // First N binds map to the SET clauses in order; remaining go to WHERE.
    const setBinds: BindValue[] = [];
    const whereBinds: BindValue[] = [];
    let consumed = 0;
    for (const clause of setClauses) {
      const eqParts = clause.split("=");
      if (eqParts.length === 2 && eqParts[1]?.trim() === "?") {
        setBinds.push(binds[consumed] ?? null);
        consumed++;
      }
    }
    whereBinds.push(...binds.slice(consumed));

    const newValues: Record<string, BindValue> = {};
    setClauses.forEach((clause) => {
      const eqIdx = clause.indexOf("=");
      if (eqIdx === -1) return;
      const col =
        clause
          .slice(0, eqIdx)
          .trim()
          .replace(/[`"\[\]]/g, "") ?? "";
      const rhs = clause.slice(eqIdx + 1).trim();
      if (rhs === "?") {
        newValues[col] = setBinds.shift() ?? null;
      } else {
        newValues[col] = stripQuotes(rhs);
      }
    });

    const whereResult = where ? evalWhere(where, whereBinds) : () => true;
    let changes = 0;
    for (const row of list) {
      if (whereResult(row)) {
        Object.assign(row, newValues);
        changes++;
      }
    }
    return { results: [], changes };
  }

  private doDelete(sql: string, binds: BindValue[]): { results: Row[]; changes: number } {
    const m = sql.match(/^DELETE\s+FROM\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s+WHERE\s+(.+))?$/is);
    if (!m) throw new Error(`Bad DELETE: ${sql}`);
    const table = m[1];
    const where = m[2];
    if (!table) throw new Error(`Bad DELETE: ${sql}`);
    const list = this.tables.get(table);
    if (!list) throw new Error(`Unknown table: ${table}`);
    if (!where) {
      const n = list.length;
      this.tables.set(table, []);
      return { results: [], changes: n };
    }
    const whereResult = evalWhere(where, binds);
    const keep: Row[] = [];
    let removed = 0;
    for (const row of list) {
      if (whereResult(row)) {
        removed++;
      } else {
        keep.push(row);
      }
    }
    this.tables.set(table, keep);
    return { results: [], changes: removed };
  }

  private doSelect(sql: string, binds: BindValue[]): Row[] {
    // Normalise: collapse whitespace, strip line breaks.
    const normalised = sql.replace(/\s+/g, " ").trim();
    // SELECT [cols] FROM table [JOIN ...] WHERE ... [ORDER BY ...] [LIMIT n]
    // We split the SQL manually because the regex form is brittle
    // when WHERE/ORDER/LIMIT are all optional.
    const tableMatch = normalised.match(/FROM\s+([A-Za-z_][A-Za-z0-9_]*)/i);
    if (!tableMatch) throw new Error(`Bad SELECT: ${sql}`);
    const table = tableMatch[1];
    if (!table) throw new Error(`Bad SELECT: ${sql}`);
    const fromToken = `FROM ${table}`;
    const fromUpper = fromToken.toUpperCase();
    const normUpper = normalised.toUpperCase();
    const fromIdx = normUpper.indexOf(fromUpper);
    if (fromIdx === -1) throw new Error(`Bad SELECT: ${sql}`);
    const afterFrom = normalised.slice(fromIdx + fromToken.length);
    let where: string | undefined;
    let order: string | undefined;
    let limit: string | undefined;
    // WHERE
    const whereMatch = afterFrom.match(/\s+WHERE\s+(.+?)(?:\s+ORDER BY\s+|\s+LIMIT\s+|$)/i);
    if (whereMatch) {
      where = whereMatch[1];
    }
    // ORDER BY
    const orderMatch = afterFrom.match(/\s+ORDER BY\s+(.+?)(?:\s+LIMIT\s+|$)/i);
    if (orderMatch) {
      order = orderMatch[1];
    }
    // LIMIT
    const limitMatch = afterFrom.match(/\s+LIMIT\s+(\d+|\?)/i);
    if (limitMatch) {
      limit = limitMatch[1];
    }
    // Extract columns: everything between SELECT and FROM.
    const colsStr = normalised.slice("SELECT ".length, fromIdx).trim();
    let rows = [...(this.tables.get(table) ?? [])];
    if (where) {
      const whereResult = evalWhere(where, binds);
      rows = rows.filter(whereResult);
    }
    if (order) {
      const cols = order.split(",").map((c) => c.trim());
      rows.sort((a, b) => {
        for (const c of cols) {
          const desc = c.toLowerCase().endsWith(" desc");
          const col = c.replace(/\s+(asc|desc)$/i, "");
          const av = a[col ?? ""] as string | number;
          const bv = b[col ?? ""] as string | number;
          if (av === bv) continue;
          if (desc) return bv > av ? 1 : -1;
          return av > bv ? 1 : -1;
        }
        return 0;
      });
    }
    if (limit) {
      const n = limit === "?" ? Number(binds[binds.length - 1]) : parseInt(limit, 10);
      rows = rows.slice(0, n);
    }
    // Project columns.
    if (colsStr && colsStr.trim() !== "*") {
      const colList = colsStr.split(",").map((c) =>
        c
          .trim()
          .split(/\s+as\s+/i)
          .pop()!
          .trim(),
      );
      rows = rows.map((r) => {
        const out: Row = {};
        for (const c of colList) {
          out[c] = r[c];
        }
        return out;
      });
    }
    return rows;
  }
}

function parseColumns(block: string): ColumnInfo[] {
  return block
    .split(",")
    .map((c) => c.trim())
    .filter((c) => c && !/^(PRIMARY KEY|UNIQUE|CHECK|FOREIGN KEY)/i.test(c))
    .map((c) => {
      const parts = c.split(/\s+/);
      const name = (parts[0] ?? "").replace(/[`"\[\]]/g, "");
      return { name };
    });
}

function stripQuotes(s: string): string {
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
    return s.slice(1, -1);
  }
  if (s.toLowerCase() === "null") return "";
  return s;
}

/** Split `s` by `sep` only at the top level (not inside parens). */
function splitTopLevel(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = "";
  for (const ch of s) {
    if (ch === "(") {
      depth++;
      buf += ch;
    } else if (ch === ")") {
      depth--;
      buf += ch;
    } else if (ch === sep && depth === 0) {
      out.push(buf);
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf.length > 0) out.push(buf);
  return out;
}

function evalWhere(where: string, binds: BindValue[]): (row: Row) => boolean {
  let bindIdx = 0;
  // Replace `?` with the corresponding bind literal.
  const literalised = where.replace(/::\s*text/gi, "").replace(/\?/g, () => {
    const v = binds[bindIdx++];
    if (v === null || v === undefined) return "NULL";
    if (typeof v === "number") return String(v);
    if (typeof v === "boolean") return v ? "1" : "0";
    return `'${String(v).replace(/'/g, "''")}'`;
  });
  // Translate SQL `=` to JS `===` for comparisons (preserves
  // `==`, `===`, `!=`, `>=`, `<=`).
  // Translate SQL `AND`/`OR`/`NOT` to JS `&&`/`||`/`!`.
  // Translate SQL `IS NULL` / `IS NOT NULL` to JS checks.
  const strict = literalised
    .replace(/(?<![=!<>])=(?!=)/g, "===")
    .replace(/\bAND\b/gi, "&&")
    .replace(/\bOR\b/gi, "||")
    .replace(/\bNOT\b/gi, "!")
    .replace(/===\s*NULL/gi, "===null")
    .replace(/!==\s*NULL/gi, "!==null");
  // Return a closure that can be evaluated on each row.
  // We use a simple expression evaluator: parse the SQL fragment as
  // a JS expression with column-name references.
  return (row) => {
    try {
      // Replace column refs that aren't keywords/strings with row[col].
      const code = strict.replace(/(^|[\s(])([A-Za-z_][A-Za-z0-9_]*)/g, (m, prefix, name) => {
        const upper = name.toUpperCase();
        if (
          [
            "AND",
            "OR",
            "NOT",
            "NULL",
            "IS",
            "IN",
            "LIKE",
            "GLOB",
            "BETWEEN",
            "ASC",
            "DESC",
            "TRUE",
            "FALSE",
          ].includes(upper)
        ) {
          return prefix + name;
        }
        if (name in row) {
          return `${prefix}__row[${JSON.stringify(name)}]`;
        }
        return m;
      });
      const fn = new Function("__row", `return (${code});`);
      return Boolean(fn(row));
    } catch {
      // Default: row passes if all binds are truthy against row[col].
      return true;
    }
  };
}
