import { createFileRoute } from '@tanstack/react-router'

import { SitesPage } from '~/features/sites/sites-page'

export const Route = createFileRoute('/_app/sites')({
  component: SitesPage,
})
