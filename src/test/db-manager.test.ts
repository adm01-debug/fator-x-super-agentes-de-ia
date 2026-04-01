import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  exportToCSV,
  exportToJSON,
  parseCSV,
  downloadFile,
  generateCreateTableSQL,
  generateAlterTableSQL,
  generateDropTableSQL,
  generateEnableRLSSQL,
  extractForeignKeys,
  sanitizeIdentifier,
  logOperation,
  getOperationLog,
  clearOperationLog,
} from '@/services/dbManager';

// ═══ exportToCSV ═══

describe('exportToCSV', () => {
  it('returns empty string for empty data', () => {
    expect(exportToCSV([], 'test')).toBe('');
  });

  it('exports normal data with headers and rows', () => {
    const data = [
      { id: 1, name: 'Alice', age: 30 },
      { id: 2, name: 'Bob', age: 25 },
    ];
    const csv = exportToCSV(data, 'users');
    const lines = csv.split('\n');
    expect(lines[0]).toBe('id,name,age');
    expect(lines[1]).toBe('1,Alice,30');
    expect(lines[2]).toBe('2,Bob,25');
    expect(lines).toHaveLength(3);
  });

  it('wraps values containing commas in double quotes', () => {
    const data = [{ note: 'hello, world' }];
    const csv = exportToCSV(data, 't');
    expect(csv).toBe('note\n"hello, world"');
  });

  it('escapes double quotes by doubling them', () => {
    const data = [{ note: 'she said "hi"' }];
    const csv = exportToCSV(data, 't');
    expect(csv).toBe('note\n"she said ""hi"""');
  });

  it('wraps values containing newlines in double quotes', () => {
    const data = [{ note: 'line1\nline2' }];
    const csv = exportToCSV(data, 't');
    expect(csv).toBe('note\n"line1\nline2"');
  });

  it('converts null values to empty string', () => {
    const data = [{ id: 1, name: null }];
    const csv = exportToCSV(data, 't');
    const lines = csv.split('\n');
    expect(lines[1]).toBe('1,');
  });

  it('handles single row of data', () => {
    const data = [{ x: 'only' }];
    const csv = exportToCSV(data, 't');
    expect(csv).toBe('x\nonly');
  });

  it('handles values with both commas and quotes', () => {
    const data = [{ val: 'a "b", c' }];
    const csv = exportToCSV(data, 't');
    expect(csv).toBe('val\n"a ""b"", c"');
  });
});

// ═══ exportToJSON ═══

describe('exportToJSON', () => {
  it('returns empty array JSON for empty input', () => {
    expect(exportToJSON([])).toBe('[]');
  });

  it('returns pretty-printed JSON for normal data', () => {
    const data = [{ id: 1, name: 'Alice' }];
    const result = exportToJSON(data);
    expect(JSON.parse(result)).toEqual(data);
    // Verify it is indented with 2 spaces
    expect(result).toContain('  "id": 1');
  });

  it('handles multiple rows', () => {
    const data = [
      { a: 1 },
      { a: 2 },
      { a: 3 },
    ];
    const parsed = JSON.parse(exportToJSON(data));
    expect(parsed).toHaveLength(3);
    expect(parsed[2].a).toBe(3);
  });
});

// ═══ parseCSV ═══

describe('parseCSV', () => {
  it('parses valid CSV with headers and rows', () => {
    const csv = 'name,age\nAlice,30\nBob,25';
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ name: 'Alice', age: '30' });
    expect(rows[1]).toEqual({ name: 'Bob', age: '25' });
  });

  it('returns empty array for empty string', () => {
    expect(parseCSV('')).toEqual([]);
  });

  it('returns empty array for headers only (single line)', () => {
    expect(parseCSV('name,age')).toEqual([]);
  });

  it('converts empty values to null', () => {
    const csv = 'a,b\n1,\n,2';
    const rows = parseCSV(csv);
    expect(rows[0]).toEqual({ a: '1', b: null });
    expect(rows[1]).toEqual({ a: null, b: '2' });
  });

  it('strips surrounding quotes from header and values', () => {
    const csv = '"name","age"\n"Alice","30"';
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ name: 'Alice', age: '30' });
  });

  it('trims whitespace from headers and values', () => {
    const csv = ' name , age \n Alice , 30 ';
    const rows = parseCSV(csv);
    expect(rows[0]).toEqual({ name: 'Alice', age: '30' });
  });

  it('handles commas inside quoted fields', () => {
    const csv = 'city,state\n"New York, NY",US\n"São Paulo, SP",BR';
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ city: 'New York, NY', state: 'US' });
    expect(rows[1]).toEqual({ city: 'São Paulo, SP', state: 'BR' });
  });

  it('handles escaped double quotes inside fields', () => {
    const csv = 'name,note\nAlice,"She said ""hello"""\nBob,normal';
    const rows = parseCSV(csv);
    expect(rows[0]).toEqual({ name: 'Alice', note: 'She said "hello"' });
    expect(rows[1]).toEqual({ name: 'Bob', note: 'normal' });
  });

  it('skips empty lines', () => {
    const csv = 'a,b\n1,2\n\n3,4\n';
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(2);
  });
});

// ═══ downloadFile ═══

describe('downloadFile', () => {
  let createObjectURLMock: ReturnType<typeof vi.fn>;
  let revokeObjectURLMock: ReturnType<typeof vi.fn>;
  let clickMock: ReturnType<typeof vi.fn>;
  let originalBlob: typeof Blob;

  beforeEach(() => {
    createObjectURLMock = vi.fn().mockReturnValue('blob:mock-url');
    revokeObjectURLMock = vi.fn();
    clickMock = vi.fn();

    global.URL.createObjectURL = createObjectURLMock;
    global.URL.revokeObjectURL = revokeObjectURLMock;

    // Replace Blob with a plain constructor function to avoid jsdom class issues
    originalBlob = global.Blob;
    const FakeBlob = vi.fn().mockImplementation(function (parts: unknown[], opts: unknown) {
      return { parts, opts };
    });
    global.Blob = FakeBlob as unknown as typeof Blob;

    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click: clickMock,
    } as unknown as HTMLAnchorElement);
  });

  afterEach(() => {
    global.Blob = originalBlob;
  });

  it('creates a Blob with the correct content and mime type', () => {
    downloadFile('test content', 'file.csv', 'text/csv');
    expect(global.Blob).toHaveBeenCalledWith(['test content'], { type: 'text/csv' });
  });

  it('creates an anchor element and triggers click', () => {
    downloadFile('data', 'export.json', 'application/json');
    expect(document.createElement).toHaveBeenCalledWith('a');
    expect(clickMock).toHaveBeenCalledOnce();
  });

  it('sets correct download filename', () => {
    const anchor = { href: '', download: '', click: clickMock } as unknown as HTMLAnchorElement;
    vi.spyOn(document, 'createElement').mockReturnValue(anchor);
    downloadFile('data', 'my-file.csv', 'text/csv');
    expect(anchor.download).toBe('my-file.csv');
  });

  it('revokes the object URL after click', () => {
    downloadFile('data', 'file.txt', 'text/plain');
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url');
  });
});

// ═══ generateCreateTableSQL ═══

describe('generateCreateTableSQL', () => {
  it('generates SQL for a single column', () => {
    const sql = generateCreateTableSQL('items', [
      { name: 'id', type: 'UUID', nullable: false },
    ]);
    expect(sql).toBe('CREATE TABLE public.items (\n  id UUID NOT NULL\n);');
  });

  it('generates SQL for multiple columns', () => {
    const sql = generateCreateTableSQL('users', [
      { name: 'id', type: 'UUID', nullable: false, isPrimary: true },
      { name: 'name', type: 'TEXT', nullable: false },
      { name: 'email', type: 'TEXT', nullable: true },
    ]);
    expect(sql).toContain('id UUID PRIMARY KEY NOT NULL');
    expect(sql).toContain('name TEXT NOT NULL');
    expect(sql).toContain('email TEXT');
    // email should NOT have NOT NULL
    expect(sql).not.toMatch(/email TEXT.*NOT NULL/);
  });

  it('includes PRIMARY KEY when isPrimary is true', () => {
    const sql = generateCreateTableSQL('t', [
      { name: 'pk', type: 'SERIAL', nullable: false, isPrimary: true },
    ]);
    expect(sql).toContain('pk SERIAL PRIMARY KEY NOT NULL');
  });

  it('includes DEFAULT when defaultValue is provided', () => {
    const sql = generateCreateTableSQL('t', [
      { name: 'status', type: 'TEXT', nullable: true, defaultValue: "'active'" },
    ]);
    expect(sql).toContain("status TEXT DEFAULT 'active'");
  });

  it('handles nullable columns without NOT NULL', () => {
    const sql = generateCreateTableSQL('t', [
      { name: 'bio', type: 'TEXT', nullable: true },
    ]);
    expect(sql).not.toContain('NOT NULL');
  });

  it('wraps column definitions with CREATE TABLE and semicolon', () => {
    const sql = generateCreateTableSQL('orders', [
      { name: 'id', type: 'INT', nullable: false },
    ]);
    expect(sql).toMatch(/^CREATE TABLE public\.orders \(/);
    expect(sql).toMatch(/\);$/);
  });
});

// ═══ generateAlterTableSQL ═══

describe('generateAlterTableSQL', () => {
  it('generates ADD_COLUMN with type and NOT NULL', () => {
    const sql = generateAlterTableSQL('users', 'ADD_COLUMN', {
      columnName: 'age',
      type: 'INTEGER',
      nullable: false,
    });
    expect(sql).toBe('ALTER TABLE public.users ADD COLUMN age INTEGER NOT NULL;');
  });

  it('generates ADD_COLUMN with default value', () => {
    const sql = generateAlterTableSQL('users', 'ADD_COLUMN', {
      columnName: 'status',
      type: 'TEXT',
      nullable: true,
      defaultValue: "'active'",
    });
    expect(sql).toBe("ALTER TABLE public.users ADD COLUMN status TEXT DEFAULT 'active';");
  });

  it('generates ADD_COLUMN defaulting to TEXT when no type given', () => {
    const sql = generateAlterTableSQL('t', 'ADD_COLUMN', { columnName: 'notes' });
    expect(sql).toContain('ADD COLUMN notes TEXT');
  });

  it('generates DROP_COLUMN', () => {
    const sql = generateAlterTableSQL('users', 'DROP_COLUMN', { columnName: 'legacy' });
    expect(sql).toBe('ALTER TABLE public.users DROP COLUMN legacy;');
  });

  it('generates RENAME_COLUMN', () => {
    const sql = generateAlterTableSQL('users', 'RENAME_COLUMN', {
      columnName: 'old_name',
      newName: 'new_name',
    });
    expect(sql).toBe('ALTER TABLE public.users RENAME COLUMN old_name TO new_name;');
  });

  it('generates ALTER_TYPE with USING cast', () => {
    const sql = generateAlterTableSQL('users', 'ALTER_TYPE', {
      columnName: 'age',
      type: 'BIGINT',
    });
    expect(sql).toBe('ALTER TABLE public.users ALTER COLUMN age TYPE BIGINT USING age::BIGINT;');
  });
});

// ═══ generateDropTableSQL ═══

describe('generateDropTableSQL', () => {
  it('generates DROP TABLE IF EXISTS with CASCADE', () => {
    expect(generateDropTableSQL('old_table')).toBe(
      'DROP TABLE IF EXISTS public.old_table CASCADE;'
    );
  });

  it('includes the correct table name in the schema', () => {
    const sql = generateDropTableSQL('my_data');
    expect(sql).toContain('public.my_data');
  });
});

// ═══ generateEnableRLSSQL ═══

describe('generateEnableRLSSQL', () => {
  it('generates ENABLE ROW LEVEL SECURITY statement', () => {
    expect(generateEnableRLSSQL('users')).toBe(
      'ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;'
    );
  });

  it('uses the correct table name', () => {
    const sql = generateEnableRLSSQL('secret_data');
    expect(sql).toContain('public.secret_data');
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
  });
});

// ═══ extractForeignKeys ═══

describe('extractForeignKeys', () => {
  it('detects columns ending with _id as foreign keys', () => {
    const columns = [{ id: 1, user_id: 10, project_id: 20, name: 'test' }];
    const fks = extractForeignKeys(columns);
    expect(fks).toEqual([
      { column: 'user_id', refTable: 'users' },
      { column: 'project_id', refTable: 'projects' },
    ]);
  });

  it('does not treat the "id" column itself as a foreign key', () => {
    const columns = [{ id: 1, name: 'test' }];
    const fks = extractForeignKeys(columns);
    expect(fks).toEqual([]);
  });

  it('returns empty array when no columns end with _id', () => {
    const columns = [{ name: 'Alice', email: 'a@b.com' }];
    expect(extractForeignKeys(columns)).toEqual([]);
  });

  it('returns empty array for empty columns', () => {
    expect(extractForeignKeys([])).toEqual([]);
  });

  it('maps _id suffix to pluralized table name', () => {
    const columns = [{ category_id: 5 }];
    const fks = extractForeignKeys(columns);
    expect(fks[0].refTable).toBe('categorys');
  });
});

// ═══ sanitizeIdentifier ═══

describe('sanitizeIdentifier', () => {
  it('accepts valid identifiers', () => {
    expect(sanitizeIdentifier('users')).toBe('users');
    expect(sanitizeIdentifier('order_items')).toBe('order_items');
    expect(sanitizeIdentifier('_private_table')).toBe('_private_table');
    expect(sanitizeIdentifier('Table123')).toBe('Table123');
  });

  it('rejects SQL injection attempts', () => {
    expect(() => sanitizeIdentifier('users; DROP TABLE payments--')).toThrow('Nome SQL inválido');
    expect(() => sanitizeIdentifier('a b c')).toThrow('Nome SQL inválido');
    expect(() => sanitizeIdentifier('')).toThrow('Nome SQL inválido');
    expect(() => sanitizeIdentifier('123abc')).toThrow('Nome SQL inválido');
  });

  it('rejects names starting with numbers', () => {
    expect(() => sanitizeIdentifier('1table')).toThrow();
  });

  it('trims whitespace', () => {
    expect(sanitizeIdentifier('  users  ')).toBe('users');
  });

  it('blocks names over 63 characters', () => {
    const long = 'a'.repeat(64);
    expect(() => sanitizeIdentifier(long)).toThrow();
  });

  it('allows names exactly 63 characters', () => {
    const exact = 'a'.repeat(63);
    expect(sanitizeIdentifier(exact)).toBe(exact);
  });
});

// ═══ generateCreateTableSQL with sanitization ═══

describe('generateCreateTableSQL sanitization', () => {
  it('rejects malicious table name', () => {
    expect(() => generateCreateTableSQL('users; DROP TABLE x', [
      { name: 'id', type: 'UUID', nullable: false, isPrimary: true },
    ])).toThrow('Nome SQL inválido');
  });

  it('rejects malicious column name', () => {
    expect(() => generateCreateTableSQL('safe_table', [
      { name: 'col; DROP TABLE y', type: 'TEXT', nullable: true },
    ])).toThrow('Nome SQL inválido');
  });
});

// ═══ Operation Log ═══

describe('operationLog', () => {
  beforeEach(() => clearOperationLog());

  it('logs operations and retrieves them', () => {
    logOperation('INSERT', 'users', 'test insert', 1);
    logOperation('DELETE', 'orders', 'test delete', 5);
    const log = getOperationLog();
    expect(log).toHaveLength(2);
    expect(log[0].operation).toBe('DELETE'); // most recent first
    expect(log[1].operation).toBe('INSERT');
  });

  it('clears the log', () => {
    logOperation('INSERT', 'users', 'test', 1);
    clearOperationLog();
    expect(getOperationLog()).toHaveLength(0);
  });

  it('limits to 200 entries', () => {
    for (let i = 0; i < 210; i++) {
      logOperation('INSERT', 'users', `row ${i}`, 1);
    }
    expect(getOperationLog()).toHaveLength(200);
  });
});
