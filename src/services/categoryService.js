const { client } = require('../config/database');
const { queryWithRetry } = require('../utils/database');

async function getAllCategories() {
  const result = await queryWithRetry(() =>
    client.query('SELECT id, slug FROM categories ORDER BY id ASC')
  );
  
  return result;
}

async function createCategory(slug) {
  const result = await queryWithRetry(() =>
    client.query('INSERT INTO categories (slug) VALUES ($1) RETURNING id', [slug])
  );
  
  return result;
}

module.exports = {
  getAllCategories,
  createCategory
};