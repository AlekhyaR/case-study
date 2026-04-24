function validateRequiredEnvironment() {
  const required = [
    'DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASS', 'DB_NAME',
    'JWT_SECRET', 'NODE_ENV'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }
  
  console.log('✅ All required environment variables found');
}

module.exports = { validateRequiredEnvironment };