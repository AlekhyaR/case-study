const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Appostrophe Template API',
    version: '1.0.0',
    description: 'REST API for managing design templates and categories'
  },
  servers: [{ url: 'http://localhost:5003', description: 'Local development' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    },
    schemas: {
      Template: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          title: { type: 'string', example: 'Instagram Story Minimal' },
          source: { type: 'object', example: { type: 'canvas', width: 1080, height: 1920 } },
          order_index: { type: 'integer', example: 1 },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
          categories: { type: 'array', items: { type: 'string' }, example: ['instagram', 'story'] }
        }
      },
      Category: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          slug: { type: 'string', example: 'instagram' }
        }
      },
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 50 },
          total: { type: 'integer', example: 100 },
          totalPages: { type: 'integer', example: 2 }
        }
      },
      Error: {
        type: 'object',
        properties: {
          ok: { type: 'boolean', example: false },
          error: { type: 'string' },
          type: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' }
        }
      }
    }
  },
  paths: {
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Obtain a JWT token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password'],
                properties: {
                  username: { type: 'string', example: 'admin' },
                  password: { type: 'string', minLength: 6, example: 'secret123' }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        token: { type: 'string' },
                        expiresIn: { type: 'string', example: '24h' }
                      }
                    },
                    timestamp: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          },
          400: { description: 'Invalid credentials format', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } }
        }
      }
    },
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        responses: {
          200: { description: 'Service healthy' },
          503: { description: 'Database unavailable' }
        }
      }
    },
    '/stats': {
      get: {
        tags: ['System'],
        summary: 'Request stats',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Stats returned' },
          401: { description: 'Unauthorized' }
        }
      }
    },
    '/get-templates': {
      get: {
        tags: ['Templates'],
        summary: 'List all templates (paginated)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Page number (1-based)' },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 100 }, description: 'Results per page (max 100)' }
        ],
        responses: {
          200: {
            description: 'Paginated template list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    data: { type: 'array', items: { $ref: '#/components/schemas/Template' } },
                    pagination: { $ref: '#/components/schemas/Pagination' },
                    timestamp: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          },
          401: { description: 'Unauthorized' }
        }
      }
    },
    '/get-template': {
      get: {
        tags: ['Templates'],
        summary: 'Get a single template by ID',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'query', required: true, schema: { type: 'integer' }, description: 'Template ID' }
        ],
        responses: {
          200: { description: 'Template found', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, data: { $ref: '#/components/schemas/Template' }, timestamp: { type: 'string' } } } } } },
          400: { description: 'Invalid ID' },
          401: { description: 'Unauthorized' },
          404: { description: 'Template not found' }
        }
      }
    },
    '/create-template': {
      post: {
        tags: ['Templates'],
        summary: 'Create a new template',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['id', 'title', 'source'],
                properties: {
                  id: { type: 'integer', example: 42 },
                  title: { type: 'string', example: 'My Template' },
                  source: { type: 'object', example: { type: 'canvas', width: 1080, height: 1080 } },
                  order_index: { type: 'integer', example: 10 },
                  categories: { type: 'array', items: { type: 'string' }, example: ['instagram'] }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Template created' },
          400: { description: 'Validation error' },
          401: { description: 'Unauthorized' },
          409: { description: 'Template ID already exists' }
        }
      }
    },
    '/update-template': {
      post: {
        tags: ['Templates'],
        summary: 'Update an existing template',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['id'],
                properties: {
                  id: { type: 'integer', example: 42 },
                  title: { type: 'string' },
                  source: { type: 'object' },
                  order_index: { type: 'integer' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Update result' },
          400: { description: 'Invalid ID' },
          401: { description: 'Unauthorized' }
        }
      }
    },
    '/delete-template': {
      delete: {
        tags: ['Templates'],
        summary: 'Delete a template',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'query', required: true, schema: { type: 'integer' }, description: 'Template ID' }
        ],
        responses: {
          200: { description: 'Deletion result' },
          400: { description: 'Invalid ID' },
          401: { description: 'Unauthorized' }
        }
      }
    },
    '/search-templates': {
      get: {
        tags: ['Templates'],
        summary: 'Search templates by title or ID (paginated)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Search term' },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 100 } }
        ],
        responses: {
          200: { description: 'Matching templates', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, data: { type: 'array', items: { $ref: '#/components/schemas/Template' } }, pagination: { $ref: '#/components/schemas/Pagination' } } } } } },
          401: { description: 'Unauthorized' }
        }
      }
    },
    '/get-template-categories': {
      get: {
        tags: ['Categories'],
        summary: 'List all categories',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Category list', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, data: { type: 'array', items: { $ref: '#/components/schemas/Category' } } } } } } },
          401: { description: 'Unauthorized' }
        }
      }
    },
    '/create-template-category': {
      post: {
        tags: ['Categories'],
        summary: 'Create a new category',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['slug'],
                properties: {
                  slug: { type: 'string', pattern: '^[a-z0-9-]+$', example: 'landscape' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Category created' },
          400: { description: 'Invalid slug format' },
          401: { description: 'Unauthorized' },
          409: { description: 'Slug already exists' }
        }
      }
    }
  }
};

module.exports = swaggerDocument;
