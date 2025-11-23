## Module Providers

You can create module providers, such as Notification or File Module Providers under a sub-directory of this directory. For example, `src/providers/my-notification`.

Then, you register them in the Medusa application as `plugin-name/providers/my-notification`:

```ts
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

Learn more in [this documentation](https://docs.medusajs.com/learn/fundamentals/plugins/create).
