const { z } = require('zod');

// ─── Request schemas ──────────────────────────────────────────────────────────

const IdQuerySchema = z.object({
  id: z.string().min(1, 'id is required')
});

const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50)
});

const LoginBodySchema = z.object({
  username: z.string().trim().min(1, 'username is required'),
  password: z.string().min(6, 'password must be at least 6 characters')
});

const CreateTemplateBodySchema = z.object({
  id: z.string().min(1, 'id is required').max(100),
  title: z.string().trim().min(1, 'title must be a non-empty string'),
  source: z.object({}).passthrough(),
  order_index: z.number().int().nonnegative().optional().default(0),
  categories: z.array(z.string()).optional().default([])
});

const UpdateTemplateBodySchema = z.object({
  id: z.string().min(1, 'id is required'),
  title: z.string().trim().min(1).optional(),
  source: z.object({}).passthrough().optional(),
  order_index: z.number().int().nonnegative().optional()
}).refine(
  ({ title, source, order_index }) => title !== undefined || source !== undefined || order_index !== undefined,
  { message: 'at least one of title, source, or order_index must be provided' }
);

const CreateCategoryBodySchema = z.object({
  slug: z.string().min(1, 'slug is required')
    .regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric (hyphens allowed)')
});

const SearchQuerySchema = PaginationSchema.extend({
  q: z.string().optional().default('')
});

// ─── Database row shapes ──────────────────────────────────────────────────────
// pg returns TIMESTAMPTZ as Date, JSONB as object, bigint counts as strings.

const TemplateRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  source: z.object({}).passthrough(),
  order_index: z.number().int(),
  created_at: z.date(),
  updated_at: z.date(),
  categories: z.array(z.string()).nullable(),
  total_count: z.coerce.number().optional()  // bigint string from COUNT(*) OVER()
});

// Client-facing shape: total_count stripped, categories always an array
const TemplateDTOSchema = TemplateRowSchema.omit({ total_count: true }).extend({
  categories: z.array(z.string())
});

const CategoryRowSchema = z.object({
  id: z.number().int(),
  slug: z.string()
});

// ─── Response shapes ──────────────────────────────────────────────────────────

const SuccessResponseSchema = z.object({
  ok: z.literal(true),
  data: z.unknown(),
  timestamp: z.string()
});

const PaginatedResponseSchema = SuccessResponseSchema.extend({
  pagination: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative()
  })
});

const ErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
  type: z.string(),
  timestamp: z.string()
});

module.exports = {
  // Request
  IdQuerySchema,
  PaginationSchema,
  LoginBodySchema,
  CreateTemplateBodySchema,
  UpdateTemplateBodySchema,
  CreateCategoryBodySchema,
  SearchQuerySchema,
  // DB rows
  TemplateRowSchema,
  TemplateDTOSchema,
  CategoryRowSchema,
  // Responses
  SuccessResponseSchema,
  PaginatedResponseSchema,
  ErrorResponseSchema
};
