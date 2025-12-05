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
