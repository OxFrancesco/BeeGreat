import type { Abi } from 'viem'
import bridgeGetFeeJson from './abis/bridge_get_fee.json'
import bridgeTransferRemoteJson from './abis/bridge_transfer_remote.json'
import erc20Json from './abis/erc20.json'
import gaugeBasicJson from './abis/gauge_basic.json'
import gaugeClJson from './abis/gauge_cl.json'
import interchainAccountRouterJson from './abis/interchain_account_router.json'
import interchainRouterJson from './abis/interchain_router.json'
import nfpmJson from './abis/nfpm.json'
import permit2Json from './abis/permit2.json'
import poolBasicJson from './abis/pool_basic.json'
import priceOracleJson from './abis/price_oracle.json'
import quoterJson from './abis/quoter.json'
import routerJson from './abis/router.json'
import slipstreamJson from './abis/slipstream.json'
import sugarJson from './abis/sugar.json'
import sugarRewardsJson from './abis/sugar_rewards.json'
import swapperJson from './abis/swapper.json'

export const abis = {
  bridgeGetFee: bridgeGetFeeJson as Abi,
  bridgeTransferRemote: bridgeTransferRemoteJson as Abi,
  erc20: erc20Json as Abi,
  gaugeBasic: gaugeBasicJson as Abi,
  gaugeCl: gaugeClJson as Abi,
  interchainAccountRouter: interchainAccountRouterJson as Abi,
  interchainRouter: interchainRouterJson as Abi,
  nfpm: nfpmJson as Abi,
  permit2: permit2Json as Abi,
  poolBasic: poolBasicJson as Abi,
  priceOracle: priceOracleJson as Abi,
  quoter: quoterJson as Abi,
  router: routerJson as Abi,
  slipstream: slipstreamJson as Abi,
  sugar: sugarJson as Abi,
  sugarRewards: sugarRewardsJson as Abi,
  swapper: swapperJson as Abi,
} as const
