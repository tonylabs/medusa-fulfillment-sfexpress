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

import { SFExpressClient } from "./client"

type InjectedDependencies = {
  logger: Logger
}

export type Options = {
  api_url_production: 'https://bspgw.sf-express.com/std/service'
  api_url_sandbox: 'https://sfapi-sbox.sf-express.com/std/service'
  token_url_production: 'https://sfapi.sf-express.com/oauth2/accessToken'
  token_url_sandbox: 'https://sfapi-sbox.sf-express.com/oauth2/accessToken'
  mode?: string
  client_id?: string
  secret_sandbox?: string
  secret_production?: string
}

type ShippingPriceType = "flat" | "calculated"

type CurrencyRateConfig = {
  base_amount: number
  per_item_rate?: number
  min_amount?: number
  remote_area_surcharge?: number
  international_surcharge_pct?: number
  tax_inclusive?: boolean
}

type SfExpressFulfillmentOption = FulfillmentOption & {
  type: "standard" | "express"
  description: string
  lead_time_days: string
  supported_price_types: ShippingPriceType[]
  rate_config: {
    default: CurrencyRateConfig
    [currencyCode: string]: CurrencyRateConfig
  }
}

const REMOTE_AREA_COUNTRIES = new Set(["cn", "us", "hk", "br", "cl", "za", "au", "nz"])

const SF_EXPRESS_OPTIONS: SfExpressFulfillmentOption[] = [
  {
    id: "sf-standard-shipping",
    name: "SF Standard Shipping",
    type: "standard",
    description: "Economical delivery for non-urgent consignments.",
    lead_time_days: "3-5",
    is_return: false,
    supported_price_types: ["flat", "calculated"],
    rate_config: {
      default: {
        base_amount: 1,
        per_item_rate: 120,
        min_amount: 1,
        remote_area_surcharge: 400,
        international_surcharge_pct: 0.2,
      },
      usd: {
        base_amount: 1,
        per_item_rate: 120,
        min_amount: 1,
        remote_area_surcharge: 1,
        international_surcharge_pct: 0.2,
      },
      cny: {
        base_amount: 1,
        per_item_rate: 80,
        min_amount: 1,
        remote_area_surcharge: 1,
        international_surcharge_pct: 0.12,
      },
    },
  },
  {
    id: "sf-express-shipping",
    name: "SF Express Shipping",
    type: "express",
    description: "Priority handling with the fastest transit times.",
    lead_time_days: "1-2",
    is_return: false,
    supported_price_types: ["flat", "calculated"],
    rate_config: {
      default: {
        base_amount: 1500,
        per_item_rate: 250,
        min_amount: 1500,
        remote_area_surcharge: 600,
        international_surcharge_pct: 0.35,
      },
      usd: {
        base_amount: 1500,
        per_item_rate: 250,
        min_amount: 1500,
        remote_area_surcharge: 600,
        international_surcharge_pct: 0.35,
      },
      cny: {
        base_amount: 900,
        per_item_rate: 150,
        min_amount: 900,
        remote_area_surcharge: 400,
        international_surcharge_pct: 0.25,
      },
    },
  },
]

class SFExpressFulfillmentProviderService extends AbstractFulfillmentProviderService {
  static identifier = "sfexpress-fulfillment"
  protected logger_: Logger
  protected options_: Options
  protected client: SFExpressClient

  constructor(
    { logger }: InjectedDependencies,
    options: Options
  ) {
    super()
    this.logger_ = logger
    this.options_ = options
    this.client = new SFExpressClient(options)
  }

  async getFulfillmentOptions(): Promise<any[]> {
    return SF_EXPRESS_OPTIONS.map((option) => ({ ...option }))
  }

  async validateFulfillmentData(optionData: any, data: any, context: any): Promise<any> {
    try {
      // Validate the fulfillment data
      this.logger_.info(`Validating fulfillment data: ${JSON.stringify({ optionData, data })}`)

      const normalizedOption = this.resolveOption(optionData)
      if (!normalizedOption) {
        throw new Error("Unknown SF Express fulfillment option.")
      }

      if (!data) {
        throw new Error("Missing required fulfillment data.")
      }

      return data
    } catch (error) {
      this.logger_.error(`Fulfillment validation error: ${error.message}`)
      throw error
    }
  }

  async validateOption(data: any): Promise<boolean> {
    try {
      // Validate if the option is available
      this.logger_.info(`Validating option: ${JSON.stringify(data)}`)

      const normalizedOption = this.resolveOption(data)
      if (!normalizedOption) {
        this.logger_.warn("Attempted to use an unknown SF Express fulfillment option.")
        return false
      }

      return Boolean(normalizedOption)
    } catch (error) {
      this.logger_.error(`Option validation error: ${error.message}`)
      return false
    }
  }

  async canCalculate(option: CreateShippingOptionDTO): Promise<boolean> {
    try {
      this.logger_.info(`Checking if provider can calculate: ${JSON.stringify(option)}`)

      if (option.price_type !== "calculated") {
        // Fixed price shipping options don't need calculation logic.
        return true
      }

      const normalizedOption = this.resolveOption(option.data)
      if (!normalizedOption) {
        this.logger_.warn("No SF Express option data found for calculated price.")
        return false
      }

      const canCalculate = normalizedOption.supported_price_types.includes("calculated")
      if (!canCalculate) {
        this.logger_.warn(`SF Express option ${normalizedOption.id} does not support calculated pricing.`)
      }

      return canCalculate
    } catch (error) {
      this.logger_.error(`Can calculate check error: ${error.message}`)
      return false
    }
  }

  async calculatePrice(
    optionData: CalculateShippingOptionPriceDTO["optionData"],
    data: CalculateShippingOptionPriceDTO["data"],
    context: CalculateShippingOptionPriceContext
  ): Promise<CalculatedShippingOptionPrice> {
    try {
      this.logger_.info(`Calculating price for: ${JSON.stringify({ optionData, data })}`)

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

      this.logger_.info(`Price calculated: ${JSON.stringify(result)}`)
      return result
    } catch (error) {
      this.logger_.error(`Price calculation error: ${error.message}`)
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
    this.logger_.info(`Creating fulfillment: ${JSON.stringify({ data, items, order })}`)
    
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
    this.logger_.info(`Canceling fulfillment: ${JSON.stringify(fulfillment)}`)
    
    return {
      id: fulfillment.id,
      status: "canceled",
    }
  }

  async createReturn(returnOrder: any): Promise<any> {
    // Handle return creation
    this.logger_.info(`Creating return: ${JSON.stringify(returnOrder)}`)
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

  protected resolveOption(
    optionData?: Record<string, unknown> | null
  ): SfExpressFulfillmentOption | undefined {
    if (!optionData || typeof optionData !== "object") {
      return undefined
    }

    const { id } = optionData as { id?: string }
    if (!id) {
      return undefined
    }

    return SF_EXPRESS_OPTIONS.find((option) => option.id === id)
  }

  protected resolveRateConfig(
    option: SfExpressFulfillmentOption,
    currencyCode?: string
  ): CurrencyRateConfig {
    const normalizedCurrency = (currencyCode ?? "usd").toLowerCase()
    return option.rate_config[normalizedCurrency] ?? option.rate_config.default
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

  protected resolveInternationalSurcharge(
    rateConfig: CurrencyRateConfig,
    destinationCountry?: string
  ): number {
    if (!destinationCountry) {
      return 0
    }

    const normalizedCountry = destinationCountry.toLowerCase()
    if (normalizedCountry === "cn") {
      return 0
    }

    if (!rateConfig.international_surcharge_pct) {
      return 0
    }

    return Math.round(rateConfig.base_amount * rateConfig.international_surcharge_pct)
  }

  protected getRemoteAreaSurcharge(
    rateConfig: CurrencyRateConfig,
    destinationCountry?: string
  ): number {
    if (!destinationCountry || !rateConfig.remote_area_surcharge) {
      return 0
    }

    if (REMOTE_AREA_COUNTRIES.has(destinationCountry.toLowerCase())) {
      return rateConfig.remote_area_surcharge
    }

    return 0
  }
}

export default SFExpressFulfillmentProviderService
