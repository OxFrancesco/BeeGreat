import { useEffect, useState } from 'react'
import {
  SignIn,
  UserButton,
  useAuth,
  useUser,
} from '@clerk/tanstack-react-start'
import {
  CrossmintProvider,
  CrossmintWalletProvider,
  useCrossmint,
} from '@crossmint/client-sdk-react-ui'
import { WalletPanel } from './wallet-panel'
import { readPairing } from './bridge'

function AuthenticatedWallet() {
  const { getToken } = useAuth()
  const { setJwt } = useCrossmint()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    const sync = async () => {
      try {
        const template = import.meta.env.VITE_CROSSMINT_JWT_TEMPLATE
        const token = await getToken(template ? { template } : undefined)
        if (!token) throw new Error('Sign in again to continue.')
        if (active) {
          setJwt(token)
          setReady(true)
          setError('')
        }
      } catch {
        if (active) {
          setReady(false)
          setJwt(undefined)
          setError('Your login expired. Sign in again to continue.')
        }
      }
    }
    void sync()
    const refresh = window.setInterval(() => {
      void sync()
    }, 30_000)
    return () => {
      active = false
      window.clearInterval(refresh)
      setJwt(undefined)
    }
  }, [getToken, setJwt])
  return error ? (
    <p role="alert">{error}</p>
  ) : ready ? (
    <WalletPanel />
  ) : (
    <p>Connecting your account...</p>
  )
}

export default function WalletPage() {
  const { isLoaded, isSignedIn, user } = useUser()
  useState(() => {
    if (typeof window !== 'undefined') readPairing()
    return null
  })
  const key = import.meta.env.VITE_CROSSMINT_CLIENT_API_KEY
  return (
    <main className="mx-auto min-h-screen max-w-2xl space-y-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">EVM wallet</h1>
        <UserButton />
      </div>
      {!isLoaded ? (
        <p>Loading account...</p>
      ) : !isSignedIn ? (
        <SignIn
          routing="hash"
          forceRedirectUrl={
            typeof window === 'undefined' ? '/evm-wallet' : window.location.href
          }
        />
      ) : !key ? (
        <p role="alert">
          Smart-wallet access is not configured for this BeeGreat deployment.
          Existing browser wallets remain available in the toolkit.
        </p>
      ) : (
        <CrossmintProvider key={user.id} apiKey={key}>
          <CrossmintWalletProvider>
            <AuthenticatedWallet />
          </CrossmintWalletProvider>
        </CrossmintProvider>
      )}
    </main>
  )
}
