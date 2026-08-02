import { api } from '@beegreat/backend/convex/_generated/api'
import { sameEvmAddress, signWalletLink } from '@beegreat/wallet-connect'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useRef, useState } from 'react'

import { useEoaWallet } from '~/features/web3/use-eoa-wallet'

/** Wallet settings for Bee's smart wallet and a verified WalletConnect EOA. */
export function WalletSettings() {
  const wallets = useQuery(api.wallets.myWallets)
  const beginEoaLink = useMutation(api.wallets.beginEoaLink)
  const linkEoa = useMutation(api.wallets.linkEoa)
  const unlinkEoa = useMutation(api.wallets.unlinkEoa)
  const connectedWallet = useEoaWallet()
  const [linkRequested, setLinkRequested] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string>()
  const [copied, setCopied] = useState(false)
  const linking = useRef(false)

  const linkedAddress = wallets?.eoa?.address
  const sessionMatches = Boolean(
    linkedAddress &&
    connectedWallet.address &&
    sameEvmAddress(linkedAddress, connectedWallet.address),
  )

  useEffect(() => {
    if (
      !linkRequested ||
      linking.current ||
      !connectedWallet.address ||
      !connectedWallet.provider
    ) {
      return
    }
    linking.current = true
    setWorking(true)
    setError(undefined)
    void (async () => {
      try {
        const challenge = await beginEoaLink({
          address: connectedWallet.address!,
        })
        const signature = await signWalletLink(
          connectedWallet.provider!,
          connectedWallet.address!,
          challenge.message,
        )
        await linkEoa({
          challengeId: challenge.challengeId,
          signature,
        })
        setLinkRequested(false)
      } catch (cause) {
        setError(walletError(cause, 'Couldn’t link that wallet.'))
        setLinkRequested(false)
      } finally {
        linking.current = false
        setWorking(false)
      }
    })()
  }, [
    beginEoaLink,
    connectedWallet.address,
    connectedWallet.provider,
    linkEoa,
    linkRequested,
  ])

  if (wallets === undefined) return null

  const copyAddress = (address: string) => {
    void navigator.clipboard.writeText(address).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const startLink = async () => {
    if (working) return
    setError(undefined)
    setLinkRequested(true)
    if (connectedWallet.address && connectedWallet.provider) return
    setWorking(true)
    try {
      await connectedWallet.connect()
    } catch (cause) {
      setLinkRequested(false)
      setError(walletError(cause, 'Couldn’t open WalletConnect.'))
    } finally {
      setWorking(false)
    }
  }

  const reconnect = async () => {
    if (working) return
    setWorking(true)
    setError(undefined)
    try {
      if (connectedWallet.isConnected) await connectedWallet.disconnect()
      await connectedWallet.connect()
    } catch (cause) {
      setError(walletError(cause, 'Couldn’t reconnect that wallet.'))
    } finally {
      setWorking(false)
    }
  }

  const removeEoa = async () => {
    if (working) return
    setWorking(true)
    setError(undefined)
    try {
      await unlinkEoa()
      if (connectedWallet.isConnected) await connectedWallet.disconnect()
    } catch {
      setError('Couldn’t unlink the wallet. Try again.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="wallet-settings-card">
      <div className="wallet-settings-row">
        <div>
          <h3>Bee smart wallet</h3>
          <p>
            {wallets.smartWallet
              ? `${shorten(wallets.smartWallet.address)} · ${wallets.smartWallet.supportedChains.map(formatChain).join(' · ')}`
              : 'Created the first time you ask Bee about your wallet'}
          </p>
        </div>
        {wallets.smartWallet ? (
          <button
            className="button button--quiet"
            type="button"
            onClick={() => copyAddress(wallets.smartWallet!.address)}
          >
            {copied ? 'Copied ✓' : 'Copy'}
          </button>
        ) : null}
      </div>

      <div className="wallet-settings-row">
        <div>
          <h3>Your wallet</h3>
          <p>
            {wallets.eoa
              ? `${shorten(wallets.eoa.address)} · ${sessionMatches ? 'Ready to sign' : 'Reconnect to sign'}`
              : 'Link with WalletConnect so Bee can prepare transactions for you to sign'}
          </p>
        </div>
        {wallets.eoa ? (
          sessionMatches ? (
            <button
              className="button button--quiet"
              type="button"
              disabled={working}
              onClick={() => void removeEoa()}
            >
              Unlink
            </button>
          ) : (
            <button
              className="button button--primary"
              type="button"
              disabled={working}
              onClick={() => void reconnect()}
            >
              {working ? 'Opening…' : 'Reconnect'}
            </button>
          )
        ) : (
          <button
            className="button button--primary"
            type="button"
            disabled={working}
            onClick={() => void startLink()}
          >
            {working || linkRequested ? 'Linking…' : 'Link my wallet'}
          </button>
        )}
      </div>

      {error ? (
        <p className="inline-error" aria-live="polite">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function walletError(cause: unknown, fallback: string) {
  if (cause instanceof Error && cause.message.trim()) return cause.message
  return fallback
}

function shorten(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function formatChain(chain: string) {
  return chain
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
