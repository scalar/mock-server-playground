# Scalar Mock Server Playground

This repository contains a playground for the Scalar Mock Server. It boots a local API server that responds with fake data generated from an OpenAPI document (`documents/example.yaml`). Use this repo to experiment with endpoints, custom request handlers, and seeded data.

## Overview

The Scalar Mock Server is a powerful Node.js mock server that automatically generates realistic API responses from your OpenAPI/Swagger documents. It creates fully-functional endpoints with mock data, handles authentication, and respects content types - making it perfect for frontend development, API prototyping, and integration testing.

### Key Features

- Perfect for frontend development and testing
- Creates endpoints automatically from OpenAPI documents
- Generates realistic mock data based on your schemas
- Handles authentication and responds with defined HTTP headers
- Supports Swagger 2.0 and OpenAPI 3.x documents
- Write custom JavaScript handlers for dynamic responses
- Automatically seed initial data on server startup

## Repository Setup

The mock server is configured in `server/index.ts`:

```typescript
import { serve } from '@hono/node-server'
import { createMockServer } from '@scalar/mock-server'
import { readFileSync } from 'node:fs'
import { Scalar } from '@scalar/hono-api-reference'

// OpenAPI document
const document = readFileSync('documents/example.yaml', 'utf8')

// Create the mocked routes
const app = await createMockServer({
  document,
  // Custom logging
  onRequest({ context, operation }) {
    console.log(context.req.method, context.req.path)
  },
})

app.get('/', Scalar({ url: '/openapi.yaml' }))

// Start the server
serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Listening on http://localhost:${info.port}`)
  },
)
```

The OpenAPI document is located at `documents/example.yaml` and is automatically exposed at:
- `/openapi.json` and `/openapi.yaml`

## Custom Request Handlers (x-handler)

The `x-handler` extension allows you to write custom JavaScript code directly in your OpenAPI operations to handle requests dynamically. This gives you full control over request processing, data persistence, and response generation.

### When to Use x-handler

Use `x-handler` when you need:
- **Persistent data** across requests (CRUD operations)
- **Dynamic responses** based on request data
- **Custom business logic** in your mock server
- **Realistic data generation** using Faker

Without `x-handler`, the mock server returns static example data. With `x-handler`, you can build fully functional mock APIs that behave like real backends.

### Available Helpers

When writing `x-handler` code, you have access to several helpers:

#### `store` - Data Persistence

The `store` helper provides an in-memory database for your mock data. Data persists during the server lifetime but resets on restart.

```javascript
// List all items in a collection
store.list('Post')

// Get a single item by ID
store.get('Post', 'post-id-123')

// Create a new item (auto-generates ID if not provided)
store.create('Post', { title: 'My Post', content: '...' })

// Update an existing item
store.update('Post', 'post-id-123', { title: 'Updated Title' })

// Delete an item
store.delete('Post', 'post-id-123')

// Clear a collection or all data
store.clear('Post')  // Clear specific collection
store.clear()        // Clear all collections
```

#### `faker` - Data Generation

The `faker` helper provides access to [Faker.js](https://fakerjs.dev/) for generating realistic fake data.

```javascript
faker.string.uuid()           // Generate UUIDs
faker.lorem.sentence()         // Generate sentences
faker.lorem.paragraphs(3)     // Generate paragraphs
faker.person.fullName()       // Generate names
faker.date.past()             // Generate dates
faker.internet.email()        // Generate emails
// ... and many more
```

#### `req` - Request Object

Access request data through the `req` object:

```javascript
req.body      // Parsed request body (JSON, form data, etc.)
req.params    // Path parameters (e.g., { id: '123' })
req.query     // Query string parameters (e.g., { page: '1' })
req.headers   // Request headers
```

#### `res` - Response Examples

The `res` object contains example responses for each status code defined in your OpenAPI spec:

```javascript
res['200']  // Example for 200 status
res['201']  // Example for 201 status
res['404']  // Example for 404 status
```

### Example: Complete CRUD API

Here's a complete example of a blog posts API using `x-handler`:

```yaml
openapi: 3.1.0
info:
  title: Blog API
  version: 1.0.0
paths:
  /posts:
    get:
      summary: List all posts
      operationId: listPosts
      x-handler: |
        return store.list('Post')
      responses:
        '200':
          description: List of posts
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Post'

    post:
      summary: Create a new post
      operationId: createPost
      x-handler: |
        return store.create('Post', {
          id: faker.string.uuid(),
          title: req.body.title,
          content: req.body.content,
          author: req.body.author || faker.person.fullName(),
          publishedAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        })
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/NewPost'
      responses:
        '201':
          description: Post created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Post'

  /posts/{id}:
    parameters:
      - name: id
        in: path
        required: true
        schema:
          type: string
    get:
      summary: Get a post by ID
      operationId: getPost
      x-handler: |
        return store.get('Post', req.params.id)
      responses:
        '200':
          description: Post found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Post'
        '404':
          description: Post not found

    put:
      summary: Update a post
      operationId: updatePost
      x-handler: |
        return store.update('Post', req.params.id, {
          ...req.body,
          updatedAt: new Date().toISOString()
        })
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UpdatePost'
      responses:
        '200':
          description: Post updated
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Post'
        '404':
          description: Post not found

    delete:
      summary: Delete a post
      operationId: deletePost
      x-handler: |
        return store.delete('Post', req.params.id)
      responses:
        '204':
          description: Post deleted
        '404':
          description: Post not found
```

### Automatic Status Code Determination

The mock server automatically determines HTTP status codes based on the store operation used:

- **`store.get()`**: Returns `200` if item found, `404` if `null` or `undefined`
- **`store.create()`**: Always returns `201` (Created)
- **`store.update()`**: Returns `200` if item found, `404` if `null` or `undefined`
- **`store.delete()`**: Returns `204` (No Content) if deleted, `404` if not found
- **`store.list()`**: Always returns `200`

### Custom Responses

You can return any value from your handler. The mock server will serialize it as JSON:

```yaml
x-handler: |
  const posts = store.list('Post')
  return {
    data: posts,
    total: posts.length,
    page: parseInt(req.query.page || '1'),
    perPage: 10
  }
```

### Error Handling

If your handler throws an error, the server returns a `500` status with an error message:

```yaml
x-handler: |
  if (!req.body.title) {
    throw new Error('Title is required')
  }
  return store.create('Post', req.body)
```

The error response will be:

```json
{
  "error": "Handler execution failed",
  "message": "Title is required"
}
```

## Data Seeding (x-seed)

The `x-seed` extension allows you to automatically populate initial data when the mock server starts. This is perfect for having realistic test data available immediately without manual setup.

### When to Use x-seed

Use `x-seed` when you need:
- **Initial test data** available on server startup
- **Realistic sample data** for development and testing
- **Consistent starting state** across server restarts
- **Quick prototyping** without manual data entry

### How It Works

1. **Automatic execution**: Seed code runs automatically when the server starts
2. **Idempotent**: Only seeds if the collection is empty (won't duplicate data on restart)
3. **Schema-based**: Each schema can have its own seed code
4. **Collection naming**: The schema key name is used as the collection name

### Seed Helper

The `seed` helper provides a Laravel-inspired API for creating data. It automatically uses the schema key as the collection name.

#### `seed.count(n, factory)` - Create Multiple Items

Create `n` items using a factory function:

```yaml
components:
  schemas:
    Post:
      type: object
      properties:
        id: { type: string }
        title: { type: string }
        content: { type: string }
        author: { type: string }
        publishedAt: { type: string, format: date-time }
      x-seed: |
        seed.count(5, () => ({
          id: faker.string.uuid(),
          title: faker.lorem.sentence(),
          content: faker.lorem.paragraphs(3),
          author: faker.person.fullName(),
          publishedAt: faker.date.past().toISOString()
        }))
```

#### `seed(array)` - Create from Array

Create items from an array of objects:

```yaml
components:
  schemas:
    Post:
      type: object
      x-seed: |
        seed([
          {
            id: '1',
            title: 'Getting Started with Scalar',
            content: 'Learn how to use Scalar...',
            author: 'Jane Doe'
          },
          {
            id: '2',
            title: 'Advanced API Documentation',
            content: 'Take your docs to the next level...',
            author: 'John Smith'
          }
        ])
```

#### `seed(factory)` - Create Single Item

Create a single item using a factory function (shorthand for `seed.count(1, factory)`):

```yaml
components:
  schemas:
    Post:
      type: object
      x-seed: |
        seed(() => ({
          id: faker.string.uuid(),
          title: faker.lorem.sentence(),
          content: faker.lorem.paragraphs(2),
          author: faker.person.fullName(),
          publishedAt: new Date().toISOString()
        }))
```

### Available Context

When writing `x-seed` code, you have access to:

- **`store`**: The same store helper as `x-handler` (for advanced use cases)
- **`faker`**: Faker.js for generating realistic data
- **`seed`**: The seed helper function (described above)
- **`schema`**: The schema key name (useful for debugging)

### Example: Blog Posts with Seeding

Here's a complete example that combines `x-seed` for initial data and `x-handler` for endpoints:

```yaml
openapi: 3.1.0
info:
  title: Blog API
  version: 1.0.0
paths:
  /posts:
    get:
      summary: List all posts
      operationId: listPosts
      x-handler: |
        return store.list('Post')
      responses:
        '200':
          description: List of posts
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Post'

    post:
      summary: Create a new post
      operationId: createPost
      x-handler: |
        return store.create('Post', {
          id: faker.string.uuid(),
          ...req.body,
          createdAt: new Date().toISOString()
        })
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/NewPost'
      responses:
        '201':
          description: Post created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Post'

components:
  schemas:
    Post:
      type: object
      properties:
        id:
          type: string
        title:
          type: string
        content:
          type: string
        author:
          type: string
        publishedAt:
          type: string
          format: date-time
        createdAt:
          type: string
          format: date-time
      x-seed: |
        seed.count(10, () => ({
          id: faker.string.uuid(),
          title: faker.lorem.sentence(),
          content: faker.lorem.paragraphs(4),
          author: faker.person.fullName(),
          publishedAt: faker.date.past().toISOString(),
          createdAt: faker.date.past().toISOString()
        }))
```

When the server starts, it will automatically create 10 blog posts. You can immediately call `GET /posts` to see them.

### Multiple Schemas

You can seed multiple collections by adding `x-seed` to multiple schemas:

```yaml
components:
  schemas:
    Post:
      type: object
      x-seed: |
        seed.count(5, () => ({
          id: faker.string.uuid(),
          title: faker.lorem.sentence(),
          content: faker.lorem.paragraphs(3)
        }))

    Author:
      type: object
      x-seed: |
        seed.count(3, () => ({
          id: faker.string.uuid(),
          name: faker.person.fullName(),
          email: faker.internet.email(),
          bio: faker.person.bio()
        }))

    Category:
      type: object
      x-seed: |
        seed([
          { id: '1', name: 'Technology' },
          { id: '2', name: 'Design' },
          { id: '3', name: 'Business' }
        ])
```

Each schema seeds independently, and all collections are populated when the server starts.

### Idempotent Behavior

The seed code only runs if the collection is empty. This means:

- **First start**: Seeds the data
- **Subsequent starts**: Skips seeding if data exists
- **After clearing**: Seeds again on next start

This prevents duplicate data and ensures consistent behavior. If you need to reseed, you can clear the collection using `store.clear('Post')` in an `x-handler` endpoint, or restart the server after clearing.

## Common Patterns

### Seeding with Relationships

```yaml
Post:
  type: object
  x-seed: |
    // First create authors
    const authors = seed.count(3, () => ({
      id: faker.string.uuid(),
      name: faker.person.fullName()
    }))

    // Then create posts with author references
    seed.count(10, () => ({
      id: faker.string.uuid(),
      title: faker.lorem.sentence(),
      authorId: faker.helpers.arrayElement(authors).id
    }))
```

### Seeding with Varied Data

```yaml
Post:
  type: object
  x-seed: |
    seed.count(10, () => {
      const isPublished = faker.datatype.boolean()
      return {
        id: faker.string.uuid(),
        title: faker.lorem.sentence(),
        content: faker.lorem.paragraphs(3),
        published: isPublished,
        publishedAt: isPublished ? faker.date.past().toISOString() : null
      }
    })
```

## Best Practices

### For x-handler

1. **Use meaningful collection names**: Match your schema names (e.g., `'Post'` for a `Post` schema)
2. **Generate IDs**: Use `faker.string.uuid()` for consistent ID generation
3. **Handle missing data**: Check for `null` or `undefined` when using `store.get()`
4. **Use Faker for realistic data**: Generate realistic test data instead of hardcoding values

### For x-seed

1. **Use meaningful counts**: Seed enough data to be useful but not overwhelming (5-20 items is usually good)
2. **Generate realistic data**: Use Faker to create believable test data
3. **Match schema structure**: Ensure seeded data matches your schema properties
4. **Use factories**: Prefer factory functions over hardcoded arrays for flexibility
5. **Combine with x-handler**: Use `x-seed` for initial data and `x-handler` for CRUD operations

## Authentication

You can define security schemes in your OpenAPI document and the mock server will validate the authentication:

```yaml
paths:
  /secret:
    get:
      security:
        - bearerAuth: []
        - apiKey: []
      responses:
        '200':
          description: OK
          content:
            application/json:
              example:
                foo: 'bar'
        '401':
          description: Unauthorized
          content:
            application/json:
              example:
                error: 'Unauthorized'

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
    apiKey:
      type: apiKey
      in: header
      name: X-API-Key
```
