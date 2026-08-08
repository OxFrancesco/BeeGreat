import { convexTest } from 'convex-test'
import { makeFunctionReference } from 'convex/server'
import { expect, test } from 'vitest'
import schema from './schema'
import { modules } from './test.setup'

const getLocator = makeFunctionReference<
  'query',
  { chainId: number; sugarContractAddress: string; poolAddress: string },
  { offset: number } | null
>('sugarPoolLocators:get')
const putLocator = makeFunctionReference<
  'mutation',
  {
    chainId: number
    sugarContractAddress: string
    poolAddress: string
    offset: number
  },
  null
>('sugarPoolLocators:put')
const deleteLocator = makeFunctionReference<
  'mutation',
  { chainId: number; sugarContractAddress: string; poolAddress: string },
  null
>('sugarPoolLocators:remove')

const key = {
  chainId: 8453,
  sugarContractAddress: '0x69dd9db6d8f8e7d83887a704f447b1a584b599a1',
  poolAddress: '0x7f670f78b17dec44d5ef68a48740b6f8849cc2e6',
}

test('pool locator can be updated and invalidated through its interface', async () => {
  const t = convexTest(schema, modules)

  expect(await t.query(getLocator, key)).toBeNull()
  await t.mutation(putLocator, { ...key, offset: 42 })
  expect(await t.query(getLocator, key)).toEqual({ offset: 42 })
  await t.mutation(putLocator, { ...key, offset: 43 })
  expect(await t.query(getLocator, key)).toEqual({ offset: 43 })
  await t.mutation(deleteLocator, key)
  expect(await t.query(getLocator, key)).toBeNull()
})
