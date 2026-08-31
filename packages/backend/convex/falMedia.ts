import { v } from 'convex/values'
import { env, internalAction } from './_generated/server'
import {
  createFalMediaClient,
  DEFAULT_FAL_MEDIA_MODELS,
  type FalMediaModels,
} from './falMediaClient'

const operationValidator = v.union(
  v.literal('generate_image'),
  v.literal('edit_image'),
  v.literal('generate_video'),
  v.literal('edit_video'),
)

const resultValidator = v.object({
  operation: operationValidator,
  kind: v.union(v.literal('image'), v.literal('video')),
  url: v.string(),
  requestId: v.string(),
})

function configuredClient() {
  const credentials = env.FAL_KEY?.trim()
  if (!credentials) {
    throw new Error(
      'Imagine is not configured. Set FAL_KEY in the Convex environment.',
    )
  }
  const models: Partial<FalMediaModels> = {
    generate_image:
      env.FAL_IMAGE_GENERATION_MODEL?.trim() ||
      DEFAULT_FAL_MEDIA_MODELS.generate_image,
    edit_image:
      env.FAL_IMAGE_EDIT_MODEL?.trim() ||
      DEFAULT_FAL_MEDIA_MODELS.edit_image,
    generate_video:
      env.FAL_VIDEO_GENERATION_MODEL?.trim() ||
      DEFAULT_FAL_MEDIA_MODELS.generate_video,
    edit_video:
      env.FAL_VIDEO_EDIT_MODEL?.trim() ||
      DEFAULT_FAL_MEDIA_MODELS.edit_video,
  }
  return createFalMediaClient({ credentials, models })
}

export const execute = internalAction({
  args: {
    operation: operationValidator,
    prompt: v.string(),
    sourceUrl: v.optional(v.string()),
  },
  returns: resultValidator,
  handler: async (_ctx, input) => {
    return await configuredClient().generate({
      operation: input.operation,
      prompt: input.prompt,
      sourceUrl: input.sourceUrl,
    })
  },
})
