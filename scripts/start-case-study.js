#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const { setTimeout } = require('timers/promises');

async function checkDocker() {
  try {
    execSync('docker info', { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

function getDockerComposeCommand() {

  try {
    execSync('docker compose version', { stdio: 'ignore' });
    return 'docker compose';
  } catch (e) {
    return 'docker-compose';
  }
}

async function waitForDatabase(maxAttempts = 30) {
  const dockerCompose = getDockerComposeCommand();
  for (let i = 0; i < maxAttempts; i++) {
    try {
      execSync(`${dockerCompose} exec -T db pg_isready -U postgres -d appostrophe`, { stdio: 'ignore' });
      return true;
    } catch (e) {
      await setTimeout(1000);
    }
  }
  return false;
}

async function main() {
  console.log('🚀 Starting Appostrophe Backend Case Study...\n');

  // Check Docker
  if (!(await checkDocker())) {
    console.error('❌ Docker is not running. Please start Docker and try again.');
    process.exit(1);
  }

  // Start database
  console.log('📦 Starting PostgreSQL database...');
  try {
    const dockerCompose = getDockerComposeCommand();
    execSync(`${dockerCompose} up -d`, { stdio: 'inherit' });
  } catch (e) {
    console.error('❌ Failed to start database');
    process.exit(1);
  }

  // Wait for database
  console.log('⏳ Waiting for database to be ready...');
  const dbReady = await waitForDatabase();
  if (!dbReady) {
    console.error('❌ Database failed to start after 30 seconds');
    process.exit(1);
  }
  console.log('✅ Database is ready!');

  // Give init scripts time to run
  await setTimeout(2000);

  // Start backend
  console.log('\n🔧 Starting backend server...');
  console.log('   Server will be available at http://localhost:5003');
  console.log('   Press Ctrl+C to stop\n');

  const server = spawn('node', ['index.js'], {
    stdio: 'inherit',
    cwd: process.cwd()
  });

  // Handle shutdown
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down...');
    server.kill();
    process.exit(0);
  });

  server.on('exit', (code) => {
    process.exit(code || 0);
  });
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
