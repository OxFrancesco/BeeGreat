# Imagine subagent

BeeGreat's built-in Imagine subagent generates and edits images and videos through
FAL. It is available to Bee in every conversation; users do not install, connect,
or enable a power-up first. Every provider call is made by a guarded Convex action,
so FAL credentials and model IDs never reach the web app, mobile app, agent prompt,
or tool arguments.

## Capability

- Generates one image from a text prompt.
- Edits one image from a public HTTPS source URL and an edit prompt.
- Generates one video from a text prompt.
- Edits one video from a public HTTPS source URL and an edit prompt.
- Uses FAL's queue interface for long-running work and returns only after the
  provider reports completion.
- Validates model IDs, source URLs, queue callback URLs, queue states, and
  output URLs before returning a result.

Image or video editing currently requires a public HTTPS source URL. Flue can
show an attached image to the Imagine specialist, but BeeGreat's chat clients do
not yet publish attachment bytes to an external media URL. The specialist must
not invent a URL when the user supplied only an attachment.

## Convex environment

Set the server-only FAL credential once per Convex deployment:

```sh
bunx convex env set FAL_KEY 'key_id:key_secret'
```

The default model policy is:

| Operation | Default FAL endpoint |
| --- | --- |
| Generate image | `google/nano-banana-2-lite` |
| Edit image | `openai/gpt-image-2/edit` |
| Generate video | `fal-ai/kling-video/v3/pro/text-to-video` |
| Edit video | `fal-ai/kling-video/o3/standard/video-to-video/edit` |

Override any endpoint without changing agent code:

```sh
bunx convex env set FAL_IMAGE_GENERATION_MODEL 'owner/model'
bunx convex env set FAL_IMAGE_EDIT_MODEL 'owner/model/edit'
bunx convex env set FAL_VIDEO_GENERATION_MODEL 'owner/model/text-to-video'
bunx convex env set FAL_VIDEO_EDIT_MODEL 'owner/model/video-to-video'
```

An override must accept the normalized fields used by the matching operation:

- generation: `prompt`
- image editing: `prompt`, `image_urls`
- video editing: `prompt`, `video_url`

## Use

Ask Bee to generate or edit an image or video. Bee automatically delegates the
explicit request to Imagine because every run is billable. For an edit, include a
public HTTPS URL and describe what should change and what must be preserved.

FAL output URLs are provider-hosted. BeeGreat does not currently copy generated
media into Convex storage or a user gallery.
