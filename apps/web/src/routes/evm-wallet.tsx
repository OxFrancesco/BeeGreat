import { createFileRoute } from '@tanstack/react-router'
import { Suspense, lazy } from 'react'

const WalletPage = lazy(() => import('~/features/evm-wallet/wallet-page'))

export const Route = createFileRoute('/evm-wallet')({
  ssr: false,
  head: () => ({ meta: [{ title: 'EVM wallet | BeeGreat' }] }),
  component: () => (
    <Suspense fallback={<p className="p-8">Opening wallet...</p>}>
      <WalletPage />
    </Suspense>
  ),
})
