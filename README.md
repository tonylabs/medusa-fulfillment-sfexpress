<p align="center">
  <a href="https://www.medusajs.com">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://user-images.githubusercontent.com/59018053/229103275-b5e482bb-4601-46e6-8142-244f531cebdb.svg">
    <source media="(prefers-color-scheme: light)" srcset="https://user-images.githubusercontent.com/59018053/229103726-e5b529a3-9b3f-4970-8a1f-c6af37f087bf.svg">
    <img alt="Medusa logo" src="https://user-images.githubusercontent.com/59018053/229103726-e5b529a3-9b3f-4970-8a1f-c6af37f087bf.svg">
    </picture>
  </a>
</p>
<h1 align="center">
  Medusa SF-Express Fulfillment
</h1>

<h4 align="center">
  <a href="https://docs.medusajs.com">Documentation</a> |
  <a href="https://www.medusajs.com">Website</a>
</h4>

<p align="center">
  Building blocks for digital commerce
</p>

## Compatibility

This plugin is compatible with versions >= 2.11.x of `@medusajs/medusa`.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
    - [Configuration Options](#configuration-options)
    - [Environment Variables](#environment-variables)

## Prerequisites
- Node.js v20 or higher
- Medusa server v2.11.3 or higher
- [SF-Express](https://open.sf-express.com/) account and API credential

## Installation

```bash
yarn add @gerbergpt/medusa-fulfillment-sfexpress
```

## Configuration
Add the provider module in your `medusa-config.ts` file:

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
            id: "sf-express",
            resolve: "@gerbergpt/medusa-fulfillment-sfexpress/providers",
            options: {
              sandbox: process.env.SFEXPRESS_ENV === "sandbox",
              partner_id: process.env.SFEXPRESS_PARTNER_ID,
              secret_sandbox: process.env.SFEXPRESS_SECRET_SANDBOX,
              secret_production: process.env.SFEXPRESS_SECRET_PRODUCTION,
            },
          },
        ],
      },
    },
  ]
})
```

## Environment Variables
Create or update your `.env` file with the following variables:

```bash
SFEXPRESS_ENV=sandbox | production
SFEXPRESS_PARTNER_ID=
SFEXPRESS_SECRET_SANDBOX=
SFEXPRESS_SECRET_PRODUCTION=
```
