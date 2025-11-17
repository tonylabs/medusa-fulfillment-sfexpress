import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import SFExpressFulfillmentProviderService from "./service"

export default ModuleProvider(Modules.FULFILLMENT, {
  services: [SFExpressFulfillmentProviderService],
})