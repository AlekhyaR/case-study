const {
  LoginBodySchema,
  CreateTemplateBodySchema,
  UpdateTemplateBodySchema,
  CreateCategoryBodySchema,
  PaginationSchema,
  IdQuerySchema
} = require('../src/validation/schemas');

describe('LoginBodySchema', () => {
  test('accepts valid credentials', () => {
    expect(LoginBodySchema.safeParse({ username: 'alice', password: 'secret123' }).success).toBe(true);
  });
  test('trims username whitespace', () => {
    const result = LoginBodySchema.safeParse({ username: '  alice  ', password: 'secret123' });
    expect(result.data.username).toBe('alice');
  });
  test('rejects empty username', () => {
    expect(LoginBodySchema.safeParse({ username: '   ', password: 'secret123' }).success).toBe(false);
  });
  test('rejects password shorter than 6 chars', () => {
    expect(LoginBodySchema.safeParse({ username: 'alice', password: 'abc' }).success).toBe(false);
  });
});

describe('CreateTemplateBodySchema', () => {
  const valid = { id: 'tpl_001', title: 'My Template', source: { type: 'canvas' } };

  test('accepts valid template', () => {
    expect(CreateTemplateBodySchema.safeParse(valid).success).toBe(true);
  });
  test('accepts string id (e.g. tpl_001)', () => {
    expect(CreateTemplateBodySchema.safeParse(valid).data.id).toBe('tpl_001');
  });
  test('defaults order_index to 0', () => {
    expect(CreateTemplateBodySchema.safeParse(valid).data.order_index).toBe(0);
  });
  test('defaults categories to empty array', () => {
    expect(CreateTemplateBodySchema.safeParse(valid).data.categories).toEqual([]);
  });
  test('rejects whitespace-only title', () => {
    expect(CreateTemplateBodySchema.safeParse({ ...valid, title: '   ' }).success).toBe(false);
  });
  test('rejects missing source', () => {
    const { source, ...rest } = valid;
    expect(CreateTemplateBodySchema.safeParse(rest).success).toBe(false);
  });
});

describe('UpdateTemplateBodySchema', () => {
  test('accepts update with title only', () => {
    expect(UpdateTemplateBodySchema.safeParse({ id: 'tpl_001', title: 'New Title' }).success).toBe(true);
  });
  test('accepts update with multiple fields', () => {
    expect(UpdateTemplateBodySchema.safeParse({ id: 'tpl_001', title: 'New', order_index: 5 }).success).toBe(true);
  });
  test('rejects update with no fields — prevents silent no-op', () => {
    expect(UpdateTemplateBodySchema.safeParse({ id: 'tpl_001' }).success).toBe(false);
  });
  test('rejects missing id', () => {
    expect(UpdateTemplateBodySchema.safeParse({ title: 'New' }).success).toBe(false);
  });
});

describe('CreateCategoryBodySchema', () => {
  test('accepts valid slug', () => {
    expect(CreateCategoryBodySchema.safeParse({ slug: 'my-category' }).success).toBe(true);
  });
  test('accepts alphanumeric slug', () => {
    expect(CreateCategoryBodySchema.safeParse({ slug: 'promo2024' }).success).toBe(true);
  });
  test('rejects uppercase letters', () => {
    expect(CreateCategoryBodySchema.safeParse({ slug: 'MyCategory' }).success).toBe(false);
  });
  test('rejects spaces', () => {
    expect(CreateCategoryBodySchema.safeParse({ slug: 'my category' }).success).toBe(false);
  });
  test('rejects empty string', () => {
    expect(CreateCategoryBodySchema.safeParse({ slug: '' }).success).toBe(false);
  });
});

describe('PaginationSchema', () => {
  test('coerces string query params to numbers', () => {
    const result = PaginationSchema.safeParse({ page: '2', limit: '20' });
    expect(result.data).toEqual({ page: 2, limit: 20 });
  });
  test('applies defaults when params absent', () => {
    expect(PaginationSchema.safeParse({}).data).toEqual({ page: 1, limit: 50 });
  });
  test('rejects limit above 100', () => {
    expect(PaginationSchema.safeParse({ limit: '200' }).success).toBe(false);
  });
  test('rejects non-numeric page', () => {
    expect(PaginationSchema.safeParse({ page: 'abc' }).success).toBe(false);
  });
});

describe('IdQuerySchema', () => {
  test('accepts a string id', () => {
    expect(IdQuerySchema.safeParse({ id: 'tpl_001' }).success).toBe(true);
  });
  test('rejects missing id', () => {
    expect(IdQuerySchema.safeParse({}).success).toBe(false);
  });
  test('rejects empty string id', () => {
    expect(IdQuerySchema.safeParse({ id: '' }).success).toBe(false);
  });
});
