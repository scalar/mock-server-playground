import { serve } from '@hono/node-server'
import { createMockServer } from '@scalar/mock-server'
import { readFileSync } from 'node:fs'

// OpenAPI document
const document = readFileSync('documents/example.json', 'utf8')

// Create the mocked routes
const app = await createMockServer({
  document,
  // Custom logging
  onRequest({ context, operation }) {
    console.log(context.req.method, context.req.path)
  },
})

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
