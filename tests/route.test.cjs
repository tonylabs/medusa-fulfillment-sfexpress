const { test } = require('node:test')
const assert = require('node:assert/strict')
const Module = require('node:module')
let workflow, fallbackCalls = 0
const originalLoad = Module._load
Module._load = function (id, ...args) {
  if (id === '@medusajs/medusa/core-flows') return {
    listShippingOptionsForCartWithPricingWorkflow: () => ({ run: (input) => workflow(input) }),
  }
  if (id === '@medusajs/medusa/api/store/shipping-options/[id]/calculate/route') return {
    POST: async () => { fallbackCalls++; return 'default-handler' },
  }
  return originalLoad.call(this, id, ...args)
}
const artifact = process.env.SFEXPRESS_TEST_ARTIFACT
let POST
try {
  ;({ POST } = require(artifact
    ? artifact + '/../../api/store/shipping-options/[id]/calculate/route.js'
    : '../src/api/store/shipping-options/[id]/calculate/route.ts'))
} finally { Module._load = originalLoad }
function fixture(option = { id: 'so_sf', provider_id: 'fulfillment-sfexpress_sf-express', price_type: 'calculated' }) {
  const req = { params: { id: 'so_sf' }, validatedBody: { cart_id: 'cart_cny', data: { reference: 'shopper' } },
    queryConfig: { fields: ['id', 'name', 'data'] },
    scope: { resolve: () => ({ graph: async () => ({ data: option ? [option] : [] }) }) } }
  const res = { json: (body) => body }
  return { req, res }
}
test('SF quote uses cart-pricing workflow and keeps the Store API response shape', async () => {
  const { req, res } = fixture()
  workflow = async ({ input }) => {
    assert.deepEqual(input, { cart_id: 'cart_cny', options: [{ id: 'so_sf', data: { reference: 'shopper' } }] })
    return { result: [{ id: 'so_sf', amount: 18, is_tax_inclusive: false, calculated_price: { calculated_amount: 18 } }] }
  }
  const body = await POST(req, res)
  assert.equal(body.shipping_option.amount, 18)
  assert.equal(body.shipping_option.id, 'so_sf')
  assert.equal(body.shipping_option.calculated_price.calculated_amount, 18)
})
test('Other carriers retain the original Medusa calculate handler', async () => {
  const { req, res } = fixture({ id: 'so_other', provider_id: 'other-carrier', price_type: 'calculated' })
  const before = fallbackCalls
  assert.equal(await POST(req, res), 'default-handler')
  assert.equal(fallbackCalls, before + 1)
})
test('A service outside the cart sales channel/zone is not quotable', async () => {
  workflow = async () => ({ result: [] })
  const { req, res } = fixture()
  await assert.rejects(POST(req, res), /unavailable for this cart/)
})
test('Flat SF options cannot use the calculate endpoint', async () => {
  const { req, res } = fixture({ id: 'so_flat', provider_id: 'fulfillment-sfexpress_sf-express', price_type: 'flat' })
  await assert.rejects(POST(req, res), /Only calculated/)
})
test('Unknown option is rejected before pricing', async () => {
  const { req, res } = fixture(null)
  await assert.rejects(POST(req, res), /not found/)
})
