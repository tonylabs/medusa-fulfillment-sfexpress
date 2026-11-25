import { defineRouteConfig } from "@medusajs/admin-sdk"
import { TruckFast } from "@medusajs/icons"
import { Container, Heading, Text } from "@medusajs/ui"

const SettingsPage = () => (
  <Container className="space-y-6">
    <Heading level="h1">SF Express</Heading>
    <section className="space-y-2">
      <Heading level="h2">Checkout rates</Heading>
      <Text>Configure credentials and the sandbox environment in medusa-config.ts.
        Calculated rates use CNY. Configure flat shipping prices for other currencies.</Text>
      <Text>The origin comes from the stock location associated with each shipping option.
        Set its province, city and street address under Settings → Locations &amp; Shipping.
        Use address line 2 for the district when needed.</Text>
      <Text>Product and variant weights are in grams. Unweighed items use the configured
        default_item_weight_grams (1000 grams by default) for each unit.</Text>
    </section>
    <section className="space-y-2">
      <Heading level="h2">Services</Heading>
      <Text>Standard (business type 2) and Express (business type 1) are available by default.
        Configure product_recommendation with a representative origin and destination
        to discover services from the carrier. Checkout always quotes the actual stock
        location and customer address.</Text>
    </section>
    <section className="space-y-2">
      <Heading level="h2">Booking and labels</Heading>
      <Text>Carrier booking, cancellation and label generation are currently manual.
        Creating or cancelling a fulfillment here only updates Medusa. Book or cancel
        the shipment with SF Express separately and add its tracking details in Medusa.</Text>
    </section>
  </Container>
)

export const config = defineRouteConfig({ label: "SF Express", icon: TruckFast })
export default SettingsPage
export const handle = { breadcrumb: () => "SF Express" }
