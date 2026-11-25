import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { listShippingOptionsForCartWithPricingWorkflow } from "@medusajs/medusa/core-flows"
import { POST as defaultCalculate } from "@medusajs/medusa/api/store/shipping-options/[id]/calculate/route"

type CalculateBody = { cart_id: string; data?: Record<string, unknown> }

// Medusa 2.11/2.17's calculate-only workflow omits currency_code from context.
// Use the full cart pricing workflow for SF, keeping eligibility checks and the
// same context used when the method is actually added to/refreshed on the cart.
export async function POST(req: MedusaRequest<CalculateBody>, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: options } = await query.graph({
    entity: "shipping_option",
    fields: Array.from(new Set([...(req.queryConfig?.fields ?? []), "id", "provider_id", "price_type"])),
    filters: { id: req.params.id },
  })
  const option = options[0]
  if (!option) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Shipping option not found")
  }
  if (!option.provider_id?.startsWith("fulfillment-sfexpress_")) {
    return defaultCalculate(req, res)
  }
  if (option.price_type !== "calculated") {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Only calculated shipping options can be quoted")
  }
  const { result } = await listShippingOptionsForCartWithPricingWorkflow(req.scope).run({
    input: { cart_id: req.validatedBody.cart_id, options: [{ id: option.id, data: req.validatedBody.data }] },
  })
  const priced = result.find((candidate) => candidate.id === option.id)
  if (!priced) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "SF-Express shipping option is unavailable for this cart")
  }
  return res.json({ shipping_option: {
    ...option,
    amount: priced.amount,
    is_tax_inclusive: priced.is_tax_inclusive,
    calculated_price: priced.calculated_price,
  } })
}
