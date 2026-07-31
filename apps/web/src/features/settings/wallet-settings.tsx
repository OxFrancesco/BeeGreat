import { api } from '@beegreat/backend/convex/_generated/api'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'

/**
 * Wallets card for the settings page (shown while the Web3 power-up is on):
 * the Bee smart wallet address (copyable) and the user's own linked EOA.
 * The EOA is an address-only link — BeeGreat never holds its keys; Bee uses
 * it to build unsigned DeFi plans the user signs in their own wallet app.
 */
export function WalletSettings() {
  const wallets = useQuery(api.wallets.myWallets)
  const linkEoa = useMutation(api.wallets.linkEoa)
  const unlinkEoa = useMutation(api.wallets.unlinkEoa)
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string>()
  const [copied, setCopied] = useState(false)

  if (wallets === undefined) return null

  const copyAddress = (address: string) => {
    void navigator.clipboard.writeText(address).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const saveEoa = async () => {
    if (working) return
    setWorking(true)
    setError(undefined)
    try {
      await linkEoa({ address: draft })
      setDraft('')
      setEditing(false)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Couldn’t link that address.',
      )
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
              ? `${shorten(wallets.smartWallet.address)} · ${wallets.smartWallet.chain}`
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
          <h3>Your own wallet</h3>
          <p>
            {wallets.eoa
              ? shorten(wallets.eoa.address)
              : 'Link an address so Bee can build DeFi plans you sign yourself'}
          </p>
        </div>
        {wallets.eoa ? (
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
            className="button button--quiet"
            type="button"
            onClick={() => {
              setEditing(!editing)
              setError(undefined)
            }}
          >
            {editing ? 'Cancel' : 'Link'}
          </button>
        )}
      </div>

      {editing && !wallets.eoa ? (
        <div className="wallet-settings-editor">
          <input
            aria-label="Wallet address"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="0x…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button
            className="button button--primary"
            type="button"
            disabled={working || draft.trim().length === 0}
            onClick={() => void saveEoa()}
          >
            {working ? 'Saving…' : 'Save'}
          </button>
        </div>
      ) : null}

      {error ? <p className="inline-error">{error}</p> : null}
    </div>
  )
}

function shorten(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}
