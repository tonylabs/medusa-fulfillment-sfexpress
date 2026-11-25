const { test, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const artifact = process.env.SFEXPRESS_TEST_ARTIFACT
const { Client } = require(artifact ? artifact + '/client.js' : '../src/providers/fulfillment-sfexpress/client.ts')
const offlineFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = offlineFetch })
const client = () => new Client({ partner_id: 'test-partner', secret_sandbox: 'test-secret', sandbox: true })
const json = (value, status = 200) => new Response(JSON.stringify(value), { status })
const token = () => json({ apiResultCode: 'A1000', accessToken: 'test-token', expiresIn: 7200 })
const success = () => json({ apiResultCode: 'A1000', apiResultData: JSON.stringify({ success: true, msgData: { deliverTmDto: [] } }) })
test('Form encoded requests and concurrent token caching', async () => {
  let tokens = 0, calls = 0
  globalThis.fetch = async (url, init) => {
    const body = new URLSearchParams(init.body)
    assert.match(init.headers['Content-Type'], /application\/x-www-form-urlencoded/)
    if (String(url).includes('/oauth2/')) {
      tokens++; assert.equal(body.get('secret'), 'test-secret'); return token()
    }
    calls++
    assert.equal(body.get('accessToken'), 'test-token')
    assert.equal(body.get('serviceCode'), 'EXP_RECE_QUERY_DELIVERTM')
    assert.deepEqual(JSON.parse(body.get('msgData')), { address: '广东 & 深圳 + 1号' })
    return success()
  }
  const api = client()
  await Promise.all(Array.from({ length: 5 }, () => api.post('EXP_RECE_QUERY_DELIVERTM', { address: '广东 & 深圳 + 1号' })))
  assert.equal(tokens, 1); assert.equal(calls, 5)
})
test('Expired access token refreshes once; repeated expiry is surfaced', async () => {
  let tokens = 0, calls = 0
  globalThis.fetch = async (url) => {
    if (String(url).includes('/oauth2/')) { tokens++; return token() }
    calls++; return json({ apiResultCode: 'A1002', apiErrorMsg: 'expired' })
  }
  await assert.rejects(client().post('test'), /A1002/)
  assert.equal(tokens, 2); assert.equal(calls, 2)
})
test('Rejected token requests are observed and a later attempt can recover', async () => {
  const api = client()
  globalThis.fetch = async () => json({ apiResultCode: 'A1011', apiErrorMsg: 'bad credentials' })
  await assert.rejects(api.post('test'), /A1011/)
  globalThis.fetch = async (url) => String(url).includes('/oauth2/') ? token() : success()
  await api.post('test')
  // node:test fails on an unhandled rejection from any orphan .finally promise.
  await new Promise((resolve) => setImmediate(resolve))
})
for (const value of [false, 'false']) {
  test(`Business failure ${JSON.stringify(value)} is rejected`, async () => {
    globalThis.fetch = async (url) => String(url).includes('/oauth2/') ? token() : json({ apiResultCode: 'A1000',
      apiResultData: JSON.stringify({ success: value, errorMsg: 'route unavailable' }) })
    await assert.rejects(client().post('test'), /route unavailable/)
  })
}
test('Malformed business payload is rejected', async () => {
  globalThis.fetch = async (url) => String(url).includes('/oauth2/') ? token() : json({ apiResultCode: 'A1000', apiResultData: 'bad-json' })
  await assert.rejects(client().post('test'), /invalid business response/)
})
test('Recommendation payload includes both addresses and defaults payment terms', async () => {
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('/oauth2/')) return token()
    const form = new URLSearchParams(init.body)
    assert.equal(form.get('serviceCode'), 'EXP_RECE_PSDS_PRODUCT_RECOMMEND')
    const data = JSON.parse(form.get('msgData'))
    assert.equal(data.srcCity, '深圳市'); assert.equal(data.destAddress, '西湖路38号')
    assert.equal(data.paymentTerms, '1'); assert.equal(data.weight, 2.5)
    return json({ apiResultCode: 'A1000', apiResultData: { success: true,
      msgData: JSON.stringify({ productList: [{ productCode: '2', productName: '标快' }] }) } })
  }
  const products = await client().getRecommendProduct({
    origin: { province: '广东省', city: '深圳市', address: '科技园1号' },
    destination: { province: '广东省', city: '广州市', address: '西湖路38号' }, weight: 2.5,
  })
  assert.equal(products[0].businessType, '2')
})
test('HTTP failures and aborts are surfaced', async () => {
  globalThis.fetch = async () => json({}, 503)
  await assert.rejects(client().post('test'), /503/)
  globalThis.fetch = async () => { throw new DOMException('Aborted', 'AbortError') }
  await assert.rejects(client().post('test'), /timed out/)
})
