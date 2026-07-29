import { describe, expect, test } from 'vitest'
import {
  createFalMediaClient,
  extractFalMediaUrl,
} from './falMediaClient'

describe('FAL media client', () => {
  test('submits, polls, and returns an edited image', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const responses = [
      {
        request_id: 'fal-request-1',
        status_url:
          'https://queue.fal.run/openai/gpt-image-2/edit/requests/fal-request-1/status',
        response_url:
          'https://queue.fal.run/openai/gpt-image-2/edit/requests/fal-request-1',
      },
      { status: 'IN_QUEUE' },
      { status: 'COMPLETED' },
      { images: [{ url: 'https://fal.media/generated/image.jpg' }] },
    ]
    const client = createFalMediaClient({
      credentials: 'fal-secret',
      sleep: async () => {},
      fetchImpl: async (input, init) => {
        calls.push({ url: String(input), init })
        return Response.json(responses.shift())
      },
    })

    await expect(
      client.generate({
        operation: 'edit_image',
        prompt: 'Turn the afternoon into golden hour.',
        sourceUrl: 'https://example.com/source.jpg',
      }),
    ).resolves.toEqual({
      operation: 'edit_image',
      kind: 'image',
      url: 'https://fal.media/generated/image.jpg',
      requestId: 'fal-request-1',
    })
    expect(calls[0]?.url).toBe(
      'https://queue.fal.run/openai/gpt-image-2/edit',
    )
    expect(calls[0]?.init?.headers).toMatchObject({
      authorization: 'Key fal-secret',
    })
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      prompt: 'Turn the afternoon into golden hour.',
      image_urls: ['https://example.com/source.jpg'],
    })
  })

  test('uses the configured video model and canonical input field', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const client = createFalMediaClient({
      credentials: 'fal-secret',
      models: { edit_video: 'fal-ai/hunyuan-video/video-to-video' },
      sleep: async () => {},
      fetchImpl: async (input, init) => {
        calls.push({ url: String(input), init })
        if (calls.length === 1) {
          return Response.json({ request_id: 'video-request' })
        }
        if (calls.length === 2) {
          return Response.json({ status: 'COMPLETED' })
        }
        return Response.json({
          data: { video: { url: 'https://fal.media/generated/video.mp4' } },
        })
      },
    })

    const result = await client.generate({
      operation: 'edit_video',
      prompt: 'Make this look like a hand-painted animation.',
      sourceUrl: 'https://example.com/source.mp4',
    })

    expect(result.url).toBe('https://fal.media/generated/video.mp4')
    expect(calls[0]?.url).toBe(
      'https://queue.fal.run/fal-ai/hunyuan-video/video-to-video',
    )
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      prompt: 'Make this look like a hand-painted animation.',
      video_url: 'https://example.com/source.mp4',
    })
  })

  test('rejects unsafe source and provider URLs', async () => {
    const client = createFalMediaClient({
      credentials: 'fal-secret',
      fetchImpl: async () => {
        throw new Error('should not fetch')
      },
    })
    await expect(
      client.generate({
        operation: 'edit_image',
        prompt: 'Edit it.',
        sourceUrl: 'file:///tmp/source.png',
      }),
    ).rejects.toThrow('public HTTPS source URL')
    expect(() =>
      extractFalMediaUrl(
        { images: [{ url: 'javascript:alert(1)' }] },
        'image',
      ),
    ).toThrow('usable image URL')
  })

  test('fails closed on a forged queue callback URL', async () => {
    const client = createFalMediaClient({
      credentials: 'fal-secret',
      fetchImpl: async () =>
        Response.json({
          request_id: 'request-2',
          status_url: 'https://attacker.example/status',
        }),
    })
    await expect(
      client.generate({
        operation: 'generate_image',
        prompt: 'A quiet honey-colored reading room.',
      }),
    ).rejects.toThrow('unexpected status URL')
  })
})
