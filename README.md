# Appostrophe Backend Case Study

Welcome! In this case study, you will find a codebase that you must refactor! The codebase is full of horrible 
practices and bugs that are placed intentionally to be caught; some harder than others. Your task is to refactor and 
harden this codebase into a production-ready backend.

## Quick Start

To get everything running, you will need to initially start docker on your machine, then run:

```bash
npm install
npm run start-case-study
```

This will:
1. Start the PostgreSQL database in Docker
2. Wait for the database to be ready
3. Start the backend server on port 5003

The server will be available at `http://localhost:5003`.

## What You're Working With

This is a backend API for managing design templates and their categories.

### Database

- **Host**: `localhost`
- **Port**: `6543`
- **Database**: `appostrophe`
- **User**: `postgres`
- **Password**: `postgres`

The database schema includes:
- `templates` - Design templates with metadata
- `categories` - Template categories

Initial data is seeded automatically when the database starts.

### API Endpoints

The current API provides the following endpoints:

- `GET /get-templates` - List all templates
- `GET /get-template?id=...` - Get a single template
- `POST /create-template` - Create a new template
- `POST /update-template` - Update a template
- `GET /delete-template?id=...` - Delete a template
- `GET /search-templates?q=...` - Search templates
- `GET /get-template-categories` - List all categories
- `POST /create-template-category` - Create a new category
- `GET /stats` - Get request statistics
- `GET /health` - Health check endpoint

## Your Task

Your goal is to transform this codebase into a reliable, secure, and maintainable backend. At a high level, you should:

1. **Identify Issues**
   - Review the codebase and find problems around:
     - Security
     - Performance
     - Reliability and error handling
     - Code organization and maintainability
     - API design and consistency

2. **Eliminate avoidable runtime errors due to typing**
   - Introduce stronger typing wherever it makes sense (for example: TypeScript, a different strongly typed language, or rigorous runtime validation).
   - Define clear data shapes for:
     - Database rows
     - Request payloads
     - Responses returned from each endpoint
   - Make it difficult for type mismatches to slip through to production.

3. **Improve Data Access and Error Handling**
   - Replace unsafe queries with parameterized ones
   - Use a more robust approach to database connections (e.g. pooling, retries where appropriate)
   - Add clearer error handling and consistent error responses

4. **Implement More Thoughtful Caching**
   - Replace the naive in-memory caching with something more deliberate:
     - Define what should be cached and for how long
     - Make it easy to reason about and invalidate when data changes

5. **Add Essential Production Features**
   - Better health checks
   - Graceful shutdown behavior
   - Basic logging/observability
   - Any other improvements you think are important for a production backend

## What We're Looking For

We want to see how you approach a real-world refactoring task. There's no single "right" answer, but we're interested in:

- **Problem identification**: Can you spot issues before they crash the server in production?
- **Prioritization**: Do you focus on critical issues first?
- **Code quality**: Is your refactored code clean, maintainable, and well-organized?
- **Testing**: Do you add tests for critical functionality?
- **Documentation**: Do you document your changes and decisions?
  - We aren't looking for every function documented, but self-documenting code is a plus.

## Getting Started

1. Start docker on your machine.
2. Run `npm install` to install dependencies
2. Run `npm start-case-study` to start the database and server
3. Explore the codebase and API endpoints
4. Start refactoring!

## Notes

- Feel free to add dependencies as needed (validation libraries, testing frameworks, etc.)
- You can modify the database schema if necessary, but document why
- The current code uses Express 4.x and PostgreSQL via the `pg` library
  - Again, feel free to use ANY library, or version of your choice.

## Questions?

If you have questions about the requirements or need clarification, please ask! We're here to help.

Good luck!
