# Codex Guidance

## Project Overview

This repo is a Medusa V2 plugin in TypeScript, which is providing international carrier services when a Medusa administration configure and enable this plugin. When 

## Structure

- `index.ts` is the entry of this plugin
- `client.ts` is the file that should be implemented as an API client which has POST or GET methods to make API call with service code parameter like `EXP_RECE_QUERY_DELIVERTM` and return JSON format responses based on the API definition from `docs/sf-express/API.md`
- `service.ts` is the file providing services for Medusa V2 backend. You need to go through the documentation files from `docs/medusa` and understand how to provide services.
  1. This `service.ts` should provide options of `FulfillmentOption` for Medusa backend by making API query for the `EXP_RECE_PSDS_PRODUCT_RECOMMEND` service code which is defined in the `docs/sf-express/product_query.md`
  2. This `service.ts` should support both `Flat` and `Calculated` price types.
  3. The `service.ts` should load estimated cost when user is checking out by calling API with the service code `EXP_RECE_QUERY_DELIVERTM` as parameter.

## Requirements

This plugin should support both Medusa fulfillment price types: `flat` and `calculated`. If Medusa administratior setup this plugin using `calculated` price type. 

## Installation

This plugin will be installed by Medusa administrator via npm. 

## Medusa Configuration

After installation, Medusa administration needs to load this plugin by editing the `medusa-config.ts` file with the following content. The `SFEXPRESS_PARTNER_ID`, `SFEXPRESS_SECRET_SANDBOX` or `SFEXPRESS_SECRET_PRODUCTION` are required in the `.env` file of the Medusa backend.

```typescript
module.exports = defineConfig({
  projectConfig: {
    // ...
  },
  modules: [
    // ... other modules
    {
      key: Modules.FULFILLMENT,
      resolve: "@medusajs/fulfillment",
      options: {
        providers: [
          {
            id: "4px",
            resolve: "@gerbergpt/medusa-fulfillment-4px/providers/fulfillment-4px",
            options: {
              api_key: process.env.FOURPX_API_KEY,
              api_secret: process.env.FOURPX_API_SECRET,
              sandbox: process.env.FOURPX_SANDBOX === "true",
            },
          },
        ],
      },
    },
  ]
})
```

## Forbidden actions
- Never call `npm install` directly.
- Never enable network during tests.