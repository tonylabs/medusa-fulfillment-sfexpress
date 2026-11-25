# Medusa SF Express fulfillment

SF Express checkout rates for Medusa v2. Tested against the plugin's locked Medusa
2.11.3 and the Cybermaker backend's Medusa 2.17.2. Node 20+ is required.

## What works

- Flat shipping options use Medusa's configured prices and require no carrier quote.
- Calculated shipping options query `EXP_RECE_QUERY_DELIVERTM` for the actual cart,
  destination and fulfilling stock location. Rates are supported for mainland China
  routes in **CNY**; use flat prices for other routes/currencies. No currency conversion
  is performed and amounts use Medusa v2 major currency units (18.5 means CNY 18.50).
- Standard (`2`) and Express (`1`) are available in the admin catalog by default.
  Optional route-based discovery calls `EXP_RECE_PSDS_PRODUCT_RECOMMEND`.
- OAuth2 access tokens are cached, concurrent token requests are shared, and an expired
  token is refreshed once. Transport failures and unsuccessful business responses fail
  the quote rather than producing a free shipping rate.

**Carrier booking is manual.** Creating/cancelling a fulfillment only records the action
in Medusa. It does not create/cancel an SF waybill, arrange collection, generate a label,
or send a return request. Book/cancel shipments separately and enter tracking details
in Medusa. Automatic carrier order/label integration requires the corresponding SF API
contracts; this repository currently documents product discovery, rates and tracking.

## Install and configure

```bash
yarn add @gerbergpt/medusa-fulfillment-sfexpress
```

Register both the fulfillment provider and plugin (the latter adds the admin page and
legacy settings module):

```ts
import { defineConfig, Modules } from "@medusajs/framework/utils"

module.exports = defineConfig({
  // Retain your application's other configuration and providers.
  modules: [{
    key: Modules.FULFILLMENT,
    resolve: "@medusajs/medusa/fulfillment",
    options: {
      providers: [{
        id: "sf-express",
        resolve: "@gerbergpt/medusa-fulfillment-sfexpress/providers/fulfillment-sfexpress",
        options: {
          sandbox: !["prod", "production"].includes(process.env.SFEXPRESS_ENV ?? "sandbox"),
          partner_id: process.env.SFEXPRESS_PARTNER_ID,
          secret_sandbox: process.env.SFEXPRESS_SECRET_SANDBOX,
          secret_production: process.env.SFEXPRESS_SECRET_PRODUCTION,
          monthly_card: process.env.SFEXPRESS_MONTHLY_CARD, // Optional negotiated rates
          default_payment_terms: "1", // Sender pays
          default_item_weight_grams: 1000,
          debug: false,
        },
      }],
    },
  }],
  plugins: [{ resolve: "@gerbergpt/medusa-fulfillment-sfexpress", options: {} }],
})
```

Use `SFEXPRESS_ENV=sandbox` for development. Both `production` and the legacy `prod`
value select production in the example. Set the corresponding partner secret. Run
`yarn medusa db:migrate` after adding the plugin's module to a new application.

In Medusa Admin, link the provider to a stock location and create shipping options in
its service zone. Select Flat or Calculated as appropriate. Set the stock location's
province, city and street address. Origin is read from `context.from_location`; each
shipping option therefore quotes from its own location. Address line 2 (or metadata's
`district`) supplies the district. Destination comes from the cart's shipping address.
Do not configure a fallback destination for a general storefront: it could quote a
route different from the customer's address.

Set accurate variant/product weights in **grams**. Variant weight takes precedence over
product weight. Each unit of an unweighed item uses `default_item_weight_grams`; this
fallback is an estimate, not a carrier guarantee. Payload weights are converted to kg.
Carrier timestamps use Asia/Shanghai regardless of the backend's timezone.

Existing option data remains compatible:

```json
{ "id": "sf-standard", "data": { "businessType": "standard" } }
```

New configurations can use:

```json
{ "id": "sf-standard", "businessType": "2" }
```

`sf-express` / `express` maps to `1`. Numeric product codes from carrier discovery are
also supported. Checkout-supplied data cannot override the configured service or fee.

### Optional product discovery

Medusa's `getFulfillmentOptions()` catalog method receives no customer or stock location.
To query the carrier instead of using the two default catalog entries, configure a
representative route in the provider options:

```ts
product_recommendation: {
  origin: { province: "广东省", city: "深圳市", district: "南山区", address: "科技园1号" },
  destination: { province: "广东省", city: "广州市", district: "越秀区", address: "西湖路38号" },
  weight: 1, // kg
}
```

The returned products describe this representative route. Checkout still checks the
actual route; catalog discovery does not guarantee availability everywhere. A configured
discovery call that fails surfaces the error; it does not silently invent services.
The previous transport-mode/language/auto-load settings were unrelated to these SF APIs
and never affected rates. The admin page now explains the actual supported configuration;
legacy settings records/API are retained for compatibility.

## Medusa quote-endpoint compatibility

The plugin overrides `/store/shipping-options/:id/calculate` for SFExpress options.
Medusa 2.11/2.17's calculate-only workflow omits the cart currency; the adapter uses
`listShippingOptionsForCartWithPricingWorkflow` so the quote and method-selection
paths receive consistent currency, location and cart context. It also preserves cart
sales-channel/service-zone eligibility. Other carriers delegate to Medusa's original
handler. Register the plugin in `plugins` as well as the provider for this adapter to
load. App-specific overrides of the same route take precedence and must preserve this
context themselves.

## Storefront integration

Retrieve shipping options for the cart, then POST the cart ID to
`/store/shipping-options/:id/calculate` for each calculated option. The response's
`shipping_option.amount` is the quote. A failed, null or non-finite price must not appear
as free shipping or remain selectable. A genuine numeric zero is valid.

Refresh quotes when address, item quantities or currency change; ignore results from
older requests. Disable calculated choices while quoting and until a valid price exists.
Do not cache cart-specific shipping responses. Mixed-profile carts must have a valid
selected method for **every required profile**, even if a profile has no quoted options.
Medusa recalculates when adding the shipping method, so selection can also fail; show
that error and let the customer choose another method.

## Development and validation

```bash
corepack yarn install --immutable
corepack yarn test
corepack yarn exec tsc --noEmit
corepack yarn build
```

Tests mock carrier responses and block outgoing network calls, including accidental
unmocked calls. They cover fee validation, currency/route guards, Medusa option shapes,
weight conversion, origin/destination payloads, product discovery, authentication retries,
timeouts and the manual fulfillment response. No credentials are needed.

For the sibling Cybermaker repositories:

```bash
cd ../medusa-cybermaker-backend
bash scripts/use-local-sfexpress.sh
# Restart the backend to load the copied build.
```

The helper copies only the compiled plugin and manifest into ignored `node_modules`,
so it runs against the backend's own Medusa peers. It leaves registry dependencies and
lockfiles unchanged. Rerun after plugin changes or after reinstalling backend dependencies.
Run `bash scripts/dev-local.sh test:shipping` in the storefront for checkout price tests
(Node 22.6+ for the built-in TypeScript test loader).

A production release still needs a sandbox rate check with the merchant's SF
account and a real shipment verification when booking is implemented. Sandbox fees are
fixtures, not evidence of actual production prices. No npm release or deployment is
performed by local development.

References: [Medusa shipping options](https://docs.medusajs.com/resources/commerce-modules/fulfillment/shipping-option),
[SF API contracts](docs/sf-express/API.md), [rate API](docs/sf-express/express/service_query.md),
[product recommendations](docs/sf-express/express/product_query.md).
