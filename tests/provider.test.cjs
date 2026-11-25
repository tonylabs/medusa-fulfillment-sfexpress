const { test } = require('node:test')
const assert = require('node:assert/strict')
const artifact = process.env.SFEXPRESS_TEST_ARTIFACT
const Provider = require(artifact ? artifact + '/service.js' : '../src/providers/fulfillment-sfexpress/service.ts').default
const { formatSFDateTime } = require(artifact ? artifact + '/utils.js' : '../src/providers/fulfillment-sfexpress/utils.ts')
const context = () => ({
  currency_code: 'cny',
  shipping_address: { province: '广东省', city: '广州市', address_1: '西湖路38号', address_2: '越秀区' },
  from_location: { address: { province: '广东省', city: '深圳市', address_1: '科技园1号', address_2: '南山区' } },
  items: [{ quantity: 2, variant: { weight: 750 } }],
})
const response = (fee, businessType = '2') => ({ apiResultData: { msgData: { deliverTmDto: [{ businessType, fee }] } } })
function provider(options = {}) {
  const service = new Provider({ logger: { error() {}, warn() {}, info() {} } }, options)
  service.client.post = async () => { throw new Error('Unexpected carrier call') }
  return service
}
for (const data of [
  { id: 'sf-standard', data: { businessType: 'standard' } },
  { id: 'sf-standard', businessType: '2' },
  { business_type: 'standard' }, { productCode: 2 }, { id: 'sf-standard' },
]) {
  test(`Medusa option shape ${JSON.stringify(data)}`, async () => {
    const service = provider()
    service.client.post = async (code, payload) => {
      assert.equal(code, 'EXP_RECE_QUERY_DELIVERTM')
      assert.equal(payload.businessType, '2')
      assert.equal(payload.weight, 1.5)
      assert.equal(payload.srcAddress.city, '深圳市')
      assert.equal(payload.destAddress.district, '越秀区')
      return response(18.5)
    }
    assert.equal(await service.validateOption(data), true)
    const result = await service.calculatePrice(data, { businessType: '1', amount: 0 }, context())
    assert.deepEqual(result, { calculated_amount: 18.5, is_calculated_price_tax_inclusive: false })
  })
}
for (const fee of [null, undefined, '', ' ', false, true, -1, '-1', 'invalid', Infinity, NaN]) {
  test(`Reject missing/invalid fee ${String(fee)}`, async () => {
    const service = provider(); service.client.post = async () => response(fee)
    await assert.rejects(service.calculatePrice({ id: 'sf-standard' }, {}, context()), /no price/)
  })
}
test('Accept genuine zero quote and numeric strings without scaling CNY into cents', async () => {
  const service = provider()
  for (const fee of [0, '0', '18.50']) {
    service.client.post = async () => response(fee)
    assert.equal((await service.calculatePrice({ id: 'sf-standard' }, {}, context())).calculated_amount, Number(fee))
  }
})
test('Match requested service instead of using the first returned price', async () => {
  const service = provider()
  service.client.post = async () => ({ apiResultData: { msgData: { deliverTmDto: [
    { businessType: '1', fee: 0 }, { businessType: 2, fee: 25 },
  ] } } })
  assert.equal((await service.calculatePrice({ id: 'sf-standard' }, {}, context())).calculated_amount, 25)
  service.client.post = async () => response(10, '1')
  await assert.rejects(service.calculatePrice({ id: 'sf-standard' }, {}, context()), /no price/)
})
test('Flat options validate without contacting SF; unknown calculated services fail validation', async () => {
  const service = provider()
  for (const option of await service.getFulfillmentOptions()) {
    assert.equal(await service.validateOption(option), true)
    assert.equal(await service.canCalculate({ data: option }), true)
    assert.deepEqual(await service.validateFulfillmentData(option, { reference: 'test' }),
      { reference: 'test', businessType: option.businessType })
  }
  for (const data of [null, {}, { id: 'unknown' }, { businessType: 'nonsense' }, { businessType: '-1' }]) {
    assert.equal(await service.validateOption(data), false)
    assert.equal(await service.canCalculate({ data }), false)
  }
})
test('Product recommendation catalog uses carrier product codes', async () => {
  const route = { origin: { province: '广东省', city: '深圳市', address: '科技园1号' },
    destination: { province: '广东省', city: '广州市', address: '西湖路38号' } }
  const service = provider({ product_recommendation: route })
  service.client.getRecommendProduct = async (input) => {
    assert.deepEqual(input, route)
    return [{ businessType: '2', productName: '顺丰标快' }, { productCode: '5', productName: '次晨' }]
  }
  const options = await service.getFulfillmentOptions()
  assert.deepEqual(options.map((o) => o.id), ['sf-standard', 'sf-5'])
  assert.equal(await service.validateOption(options[1]), true)
})
test('Fail before network for wrong currency or incomplete addresses', async () => {
  const service = provider()
  const usd = context(); usd.currency_code = 'usd'
  await assert.rejects(service.calculatePrice({ id: 'sf-standard' }, {}, usd), /CNY/)
  const overseas = context(); overseas.shipping_address.country_code = 'us'
  await assert.rejects(service.calculatePrice({ id: 'sf-standard' }, {}, overseas), /mainland China/)
  const origin = context(); origin.from_location.address = {}
  await assert.rejects(service.calculatePrice({ id: 'sf-standard' }, {}, origin), /origin/)
  const destination = context(); destination.shipping_address.city = ''
  await assert.rejects(service.calculatePrice({ id: 'sf-standard' }, {}, destination), /destination/)
})
test('Product weight fallback and missing weights are counted per unit', async () => {
  const service = provider({ default_item_weight_grams: 500, monthly_card: 'test-monthly-card' })
  const input = context()
  input.items = [
    { quantity: 2, variant: { weight: 0 }, product: { weight: 750 } },
    { quantity: 3, variant: {} },
    { quantity: 1, variant: { product: { weight: 250 } } },
  ]
  service.client.post = async (_, payload) => {
    assert.equal(payload.weight, 3.25)
    assert.equal(payload.monthlyCard, 'test-monthly-card')
    return response(20)
  }
  await service.calculatePrice({ id: 'sf-standard' }, {}, input)
})
test('Reject negative weight and invalid configured fallback', async () => {
  assert.throws(() => provider({ default_item_weight_grams: -1 }), /positive/)
  const service = provider(); const input = context(); input.items[0].variant.weight = -1
  await assert.rejects(service.calculatePrice({ id: 'sf-standard' }, {}, input), /weight/)
})
test('SF timestamps are in Asia/Shanghai even when the host is in UTC', () => {
  assert.equal(formatSFDateTime(new Date('2026-11-25T20:30:00Z')), '2026-11-26 04:30:00')
})

test('Manual fulfillment returns Medusa labels shape without pretending to book a waybill', async () => {
  const service = provider()
  const result = await service.createFulfillment({ businessType: '2' }, [{ quantity: 1 }], { id: 'order_test' }, { id: 'ful_test' })
  assert.deepEqual(result.labels, [])
  assert.equal(result.data.booking_status, 'manual')
  assert.equal(result.data.order_reference, 'order_test')
})
