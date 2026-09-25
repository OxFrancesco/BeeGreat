'use node'

import { EVMWallet } from '@crossmint/wallets-sdk'
import { executeSugarAction } from '@beegreat/sugar'
import { getSocketStatus } from '../socketSwap'
import type { prepareAndApproveCrossmintBatch } from '../web3Execution'
import { walletForUser } from './crossmintWallet'
import type { CrossmintWalletChain } from './shared'

export type ExecutionWallet = Parameters<typeof prepareAndApproveCrossmintBatch>[0]['wallet'] & Pick<EVMWallet, 'send' | 'sendTransaction'>

/** Provider boundaries; authorization, persistence and retry policy stay in the workflows. */
export interface Web3ExecutionServices {
  wallet(userId: string, chain?: CrossmintWalletChain): Promise<ExecutionWallet>
  buildPlan: typeof executeSugarAction
  socketStatus: typeof getSocketStatus
}

export const web3ExecutionServices: Web3ExecutionServices = {
  wallet: async (userId, chain) => EVMWallet.from(await walletForUser(userId, chain)),
  buildPlan: executeSugarAction,
  socketStatus: getSocketStatus,
}
