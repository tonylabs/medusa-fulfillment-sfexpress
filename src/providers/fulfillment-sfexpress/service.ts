import { AbstractFulfillmentProviderService } from "@medusajs/framework/utils"
import {
  Logger,
  CalculatedShippingOptionPrice,
  CalculateShippingOptionPriceContext,
  CalculateShippingOptionPriceDTO,
  CreateShippingOptionDTO,
  FulfillmentDTO,
  FulfillmentItemDTO,
  FulfillmentOption,
  FulfillmentOrderDTO,
} from "@medusajs/framework/types"

import { Client } from "./client"

type InjectedDependencies = {
  logger: Logger
}

export type Options = {
  partner_id?: string
  secret_sandbox?: string
  secret_production?: string
  sandbox?: boolean
  debug?: boolean
}

type LogisticsProduct = Record<string, any>
type PriceType = "flat" | "calculated"

class SFExpressFulfillmentProviderService extends AbstractFulfillmentProviderService {
  static identifier = "fulfillment-sfexpress"
  protected logger: Logger
  protected options: Options
  protected client: Client

  constructor(
    { logger }: InjectedDependencies,
    options: Options
  ) {
    super()
    this.logger = logger
    this.options = options
    this.client = new Client(options)
  }

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    const products = await this.retrieveLogisticsProducts()
    return products.map((product) => this.toFulfillmentOption(product))
  }

  async validateFulfillmentData(optionData: any, data: any, context: any): Promise<any> {
    try {
      // Validate the fulfillment data
      this.logger.info(`Validating fulfillment data: ${JSON.stringify({ optionData, data })}`)

      const normalizedOption = this.resolveOption(optionData)
      if (!normalizedOption) {
        throw new Error("Unknown SF Express fulfillment option.")
      }

      if (!data) {
        throw new Error("Missing required fulfillment data.")
      }

      return data
    } catch (error) {
      this.logger.error(`Fulfillment validation error: ${error.message}`)
      throw error
    }
  }

  async validateOption(data: any): Promise<boolean> {
    try {
      // Validate if the option is available
      this.logger.info(`Validating option: ${JSON.stringify(data)}`)

      const normalizedOption = this.resolveOption(data)
      if (!normalizedOption) {
        this.logger.warn("Attempted to use an unknown SF Express fulfillment option.")
        return false
      }

      return Boolean(normalizedOption)
    } catch (error) {
      this.logger.error(`Option validation error: ${error.message}`)
      return false
    }
  }

  async canCalculate(option: CreateShippingOptionDTO): Promise<boolean> {
    try {
      this.logger.info(`Checking if provider can calculate: ${JSON.stringify(option)}`)

      if (option.price_type !== "calculated") {
        // Fixed price shipping options don't need calculation logic.
        return true
      }

      const normalizedOption = this.resolveOption(option.data)
      if (!normalizedOption) {
        this.logger.warn("No SF Express option data found for calculated price.")
        return false
      }

      const canCalculate = normalizedOption.supported_price_types.includes("calculated")
      if (!canCalculate) {
        this.logger.warn(`SF Express option ${normalizedOption.id} does not support calculated pricing.`)
      }

      return canCalculate
    } catch (error) {
      this.logger.error(`Can calculate check error: ${error.message}`)
      return false
    }
  }

  async calculatePrice(
    optionData: CalculateShippingOptionPriceDTO["optionData"],
    data: CalculateShippingOptionPriceDTO["data"],
    context: CalculateShippingOptionPriceContext
  ): Promise<CalculatedShippingOptionPrice> {
    try {
      this.logger.info(`Calculating price for: ${JSON.stringify({ optionData, data })}`)

      const normalizedOption = this.resolveOption(optionData)
      if (!normalizedOption) {
        throw new Error("Missing SF Express option data for price calculation.")
      }
      const currencyCode = (
        (
          context as
            | {
                currency_code?: string
              }
            | undefined
        )?.currency_code ?? "usd"
      ).toLowerCase()
      const rateConfig = this.resolveRateConfig(normalizedOption, currencyCode)
      const quantity = this.getTotalItemQuantity(context?.items)

      let calculatedAmount =
        rateConfig.base_amount +
        Math.max(quantity - 1, 0) * (rateConfig.per_item_rate ?? 0)

      if (normalizedOption.type === "express") {
        // Express services get an additional handling fee.
        calculatedAmount += Math.round(calculatedAmount * 0.15)
      }

      calculatedAmount += this.resolveInternationalSurcharge(
        rateConfig,
        context?.shipping_address?.country_code
      )
      calculatedAmount += this.getRemoteAreaSurcharge(
        rateConfig,
        context?.shipping_address?.country_code
      )

      if (rateConfig.min_amount) {
        calculatedAmount = Math.max(calculatedAmount, rateConfig.min_amount)
      }

      const result = {
        calculated_amount: calculatedAmount,
        is_calculated_price_tax_inclusive: rateConfig.tax_inclusive ?? false,
      }

      this.logger.info(`Price calculated: ${JSON.stringify(result)}`)
      return result
    } catch (error) {
      this.logger.error(`Price calculation error: ${error.message}`)
      // Return a default price instead of throwing to prevent checkout failure
      return {
        calculated_amount: 500,
        is_calculated_price_tax_inclusive: false,
      }
    }
  }

  async createFulfillment(
    data: Record<string, unknown>,
    items: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[],
    order: Partial<FulfillmentOrderDTO> | undefined,
    fulfillment: Partial<FulfillmentDTO>
  ): Promise<any> {
    // Create fulfillment with your provider
    this.logger.info(`Creating fulfillment: ${JSON.stringify({ data, items, order })}`)
    
    // Here you would integrate with your fulfillment provider's API
    // For now, return a mock response
    return {
      id: `custom_${Date.now()}`,
      tracking_number: `TRACK${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      status: "pending",
    }
  }

  async cancelFulfillment(fulfillment: Record<string, unknown>): Promise<any> {
    // Cancel fulfillment with your provider
    this.logger.info(`Canceling fulfillment: ${JSON.stringify(fulfillment)}`)
    
    return {
      id: fulfillment.id,
      status: "canceled",
    }
  }

  async createReturn(returnOrder: any): Promise<any> {
    // Handle return creation
    this.logger.info(`Creating return: ${JSON.stringify(returnOrder)}`)
    return {
      id: `return_${Date.now()}`,
      status: "pending",
    }
  }

  async getFulfillmentDocuments(data: any): Promise<any> {
    // Return fulfillment documents (labels, invoices, etc.)
    return []
  }

  async getReturnDocuments(data: any): Promise<any> {
    // Return return documents
    return []
  }

  async getShipmentDocuments(data: any): Promise<any> {
    // Return shipment documents
    return []
  }

  async retrieveDocuments(fulfillmentData: any, documentType: string): Promise<any> {
    // Retrieve specific documents
    return []
  }

  protected async retrieveLogisticsProducts(): Promise<LogisticsProduct[]> {
    if (this.productsCache && this.productsCache.expires_at > Date.now()) {
      return this.productsCache.items
    }

    const payload: Record<string, unknown> = this.compactObject({
      page_no: 1,
      page_size: 200,
      transport_mode: this.options_.default_transport_mode ?? "1",
      source_country_code: this.options_.default_origin_country,
      source_warehouse_code: this.options_.default_warehouse_code,
      dest_country_code: this.options_.default_destination_country,
    })

    try {
      const response = await this.client.post(
        "ds.xms.logistics_product.getlist",
        payload
      )

      this.debug(
        "[4PX] logistics_product.getlist raw response:",
        JSON.stringify(response)
      )

      const list = this.extractList(response?.data ?? response)
      this.productsCache = {
        items: list,
        expires_at: Date.now() + 5 * 60 * 1000,
      }
      return list
    } catch (error) {
      this.logger_.error(
        `Failed to load 4PX logistics products: ${
          (error as Error)?.message ?? error
        }`
      )
      throw error
    }
  }


  protected getTotalItemQuantity(
    items: CalculateShippingOptionPriceContext["items"] | undefined
  ): number {
    if (!items?.length) {
      return 1
    }

    const total = items.reduce((sum, item) => {
      const quantityValue = Number(item.quantity ?? 0)
      return sum + (Number.isFinite(quantityValue) ? quantityValue : 0)
    }, 0)
    return total > 0 ? total : 1
  }

}

export default SFExpressFulfillmentProviderService
