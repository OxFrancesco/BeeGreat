import * as Schema from 'effect/Schema'
import { v } from 'convex/values'
import { action, internalMutation, query } from './_generated/server'
import { api, internal } from './_generated/api.js'

const placeholderPostsSchema = Schema.Array(
  Schema.Struct({
    id: Schema.Number,
    title: Schema.String,
    body: Schema.String,
  }),
)
const decodePlaceholderPosts = Schema.decodeUnknownSync(placeholderPostsSchema)

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('posts').collect()
  },
})

export const insert = internalMutation({
  args: {
    post: v.object({ id: v.string(), title: v.string(), body: v.string() }),
  },
  handler: (ctx, { post }) => ctx.db.insert('posts', post),
})

export const populate = action({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.runQuery(api.posts.list)
    if (existing.length) {
      return
    }
    const posts = decodePlaceholderPosts(
      await (await fetch('https://jsonplaceholder.typicode.com/posts')).json(),
    )
    await Promise.all(
      posts.slice(0, 10).map((post) =>
        ctx.runMutation(internal.posts.insert, {
          post: {
            id: post.id.toString(),
            body: post.body,
            title: post.title,
          },
        }),
      ),
    )
  },
})
