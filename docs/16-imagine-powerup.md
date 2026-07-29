# Imagine power-up

BeeGreat's Imagine power-up generates and edits images and videos through FAL.
It is opt-in, off by default, and available to Bee as a dedicated specialist.
Every provider call is made by a guarded Convex action; FAL credentials and
model IDs never reach the web app, mobile app, agent prompt, or tool arguments.

## Capability

- Generates one image from a text prompt.
- Edits one image from a public HTTPS source URL and an edit prompt.
- Generates one video from a text prompt.
- Edits one video from a public HTTPS source URL and an edit prompt.
- Uses FAL's queue interface for long-running work and returns only after the
  provider reports completion.
- Validates model IDs, source URLs, queue callback URLs, queue states, and
  output URLs before returning a result.
- Runs only when the signed-in user has enabled the `imagine` power-up.

Image or video editing currently requires a public HTTPS source URL. Flue can
show an attached image to the Imagine specialist, but BeeGreat's chat clients do
not yet publish attachment bytes to an external media URL. The specialist must
not invent a URL when the user supplied only an attachment.

## Convex environment

Set the server-only FAL credential:

```sh
bunx convex env set FAL_KEY 'key_id:key_secret'
```

The default model policy is:

| Operation | Default FAL endpoint |
| --- | --- |
| Generate image | `openai/gpt-image-2` |
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

FAL documents queue-based long-running requests and public/base64 media inputs
in its [model API documentation](https://fal.ai/models). The current default
image editing contract is documented by
[GPT Image 2 Edit](https://fal.ai/models/openai/gpt-image-2/edit), and the
default video editing contract by
[Kling O3 Video to Video](https://fal.ai/models/fal-ai/kling-video/o3/standard/video-to-video/edit/api).

## Use

1. Open Profile → Power-ups and enable Imagine.
2. Ask Bee to generate an image or video. Bee delegates only explicit media
   requests because every run is billable.
3. For an edit, include a public HTTPS URL and describe what should change and
   what must be preserved.
4. Bee returns generated images inline as Markdown and videos as direct links.

FAL output URLs are provider-hosted. BeeGreat does not currently copy generated
media into Convex storage or a user gallery.
