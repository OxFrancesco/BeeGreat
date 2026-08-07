import { createFileRoute } from '@tanstack/react-router'

import { RealtimeVoicePage } from '~/features/bee/realtime-voice-page'

export const Route = createFileRoute('/_app/voice')({
  component: RealtimeVoicePage,
})
