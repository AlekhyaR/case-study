// src/services/templateService.js
const { client } = require('../config/database');
const { queryWithRetry } = require('../utils/database');

// SINGLE SOURCE OF TRUTH - No duplication!
const TEMPLATE_QUERY = `
  SELECT 
    t.id,
    t.title,
    t.source,
    t.order_index,
    t.created_at,
    t.updated_at,
    json_agg(c.slug) FILTER (WHERE c.slug IS NOT NULL) as categories
  FROM templates t
  LEFT JOIN template_categories tc ON t.id = tc.template_id
  LEFT JOIN categories c ON c.id = tc.category_id
`;

async function getAllTemplates() {
  const result = await queryWithRetry(() =>
    client.query(
      TEMPLATE_QUERY + `
      GROUP BY t.id, t.title, t.source, t.order_index, t.created_at, t.updated_at
      ORDER BY t.order_index ASC
      `
    )
  );
  
  return result;
}

async function getTemplateById(id) {
  const result = await queryWithRetry(() =>
    client.query(
      TEMPLATE_QUERY + `
      WHERE t.id = $1
      GROUP BY t.id, t.title, t.source, t.order_index, t.created_at, t.updated_at
      `,
      [id]
    )
  );
  
  return result;
}

async function createTemplate(id, title, source, order_index, categories) {
  await queryWithRetry(() =>
    client.query(
      'INSERT INTO templates (id, title, source, order_index) VALUES ($1, $2, $3, $4)',
      [id, title, JSON.stringify(source), order_index || 0]
    )
  );
  
  if (categories && Array.isArray(categories)) {
    for (const catSlug of categories) {
      const catResult = await queryWithRetry(() =>
        client.query('SELECT id FROM categories WHERE slug = $1', [catSlug])
      );
      
      if (catResult.rows.length > 0) {
        await queryWithRetry(() =>
          client.query(
            'INSERT INTO template_categories (template_id, category_id) VALUES ($1, $2)',
            [id, catResult.rows[0].id]
          )
        );
      }
    }
  }
}

async function updateTemplate(id, updates) {
  let query = 'UPDATE templates SET ';
  let values = [];
  let paramCount = 1;

  if (updates.title !== undefined) {
    query += `title = $${paramCount}, `;
    values.push(updates.title);
    paramCount++;
  }
  
  if (updates.source !== undefined) {
    query += `source = $${paramCount}, `;
    values.push(JSON.stringify(updates.source));
    paramCount++;
  }
  
  if (updates.order_index !== undefined) {
    query += `order_index = $${paramCount}, `;
    values.push(updates.order_index);
    paramCount++;
  }
  
  query += `updated_at = now() WHERE id = $${paramCount}`;
  values.push(id);
  
  return queryWithRetry(() => client.query(query, values));
}

async function deleteTemplate(id) {
  return queryWithRetry(() =>
    client.query('DELETE FROM templates WHERE id = $1', [id])
  );
}

async function searchTemplates(searchTerm) {
  const result = await queryWithRetry(() =>
    client.query(
      TEMPLATE_QUERY + `
      WHERE t.title ILIKE '%' || $1 || '%' OR t.id::TEXT ILIKE '%' || $1 || '%'
      GROUP BY t.id, t.title, t.source, t.order_index, t.created_at, t.updated_at
      ORDER BY t.order_index ASC
      `,
      [searchTerm]
    )
  );
  
  return result;
}

module.exports = {
  getAllTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  searchTemplates
};