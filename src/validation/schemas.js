const { z } = require('zod');

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

module.exports = {
  IdQuerySchema,
  PaginationSchema,
  LoginBodySchema,
  CreateTemplateBodySchema,
  UpdateTemplateBodySchema,
  CreateCategoryBodySchema,
  SearchQuerySchema
};
