import { v } from 'convex/values'

export const raindropItem = v.object({
  id: v.number(), url: v.string(), title: v.string(), excerpt: v.string(), note: v.string(),
  tags: v.array(v.string()), collectionId: v.number(), important: v.boolean(), cover: v.string(), updatedAt: v.string(),
})
export const raindropCollection = v.object({ id: v.number(), title: v.string(), parentId: v.union(v.number(), v.null()) })
