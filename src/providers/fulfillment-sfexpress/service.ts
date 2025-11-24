import { AbstractFulfillmentProviderService } from "@medusajs/framework/utils"
import {
  CalculatedShippingOptionPrice,
  CalculateShippingOptionPriceContext,
  CalculateShippingOptionPriceDTO,
  CreateShippingOptionDTO,
  FulfillmentDTO,
  FulfillmentItemDTO,
  FulfillmentOption,
  FulfillmentOrderDTO,
  Logger,
} from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"

import { Client } from "./client"
import { SFExpressResponse } from "./types"

type InjectedDependencies = {
  logger: Logger
}

export type Options = {
  partner_id?: string
  secret_sandbox?: string
  secret_production?: string
  sandbox?: boolean
  debug?: boolean
  timeout?: number
  default_src_province?: string
  default_src_city?: string
  default_src_district?: string
  default_src_address?: string
  default_dest_province?: string
  default_dest_city?: string
  default_dest_district?: string
  default_dest_address?: string
  default_payment_terms?: string
  default_send_time?: string
}

type ShippingAddressPayload = {
  province?: string
  city?: string
  district?: string
  address?: string
  code?: string
}

type NormalizedOption = {
  id: string
  name: string
  businessType?: string
  raw?: any
}

class SFExpressFulfillmentProviderService extends AbstractFulfillmentProviderService {
  static identifier = "fulfillment-sfexpress"
  protected logger: Logger
  protected options: Options
  protected client: Client

  constructor({ logger }: InjectedDependencies, options: Options) {
    super()
    this.logger = logger
    this.options = options
    this.client = new Client(options)
  }

  //https://docs.medusajs.com/resources/references/fulfillment/provider#getfulfillmentoptions
  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return [
      {
        id: "sf-standard",
        name: "顺丰标准",
        data: {
          businessType: "standard",
        },
      },
      {
        id: "sf-express",
        name: "顺丰特快",
        data: {
          businessType: "express",
        },
      },
    ]
  }

  async validateFulfillmentData(optionData: any, data: any): Promise<any> {
    const normalized = this.resolveOption(optionData)
    if (!normalized) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Unknown SF-Express fulfillment option")
    }
    return data ?? {}
  }

  async validateOption(data: any): Promise<boolean> {
    return Boolean(this.resolveOption(data))
  }

  // https://docs.medusajs.com/resources/references/fulfillment/provider#cancalculate
  async canCalculate(option: CreateShippingOptionDTO): Promise<boolean> {
    return true
  }

  // https://docs.medusajs.com/resources/references/fulfillment/provider#calculateprice
  async calculatePrice(
    optionData: CalculateShippingOptionPriceDTO["optionData"],
    _data: CalculateShippingOptionPriceDTO["data"],
    context: CalculateShippingOptionPriceContext
  ): Promise<CalculatedShippingOptionPrice> {
    const normalizedOption = this.resolveOption(optionData.data)
    if (!normalizedOption?.businessType) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Missing SF-Express business type for price calculation")
    }
    try {
      const deliverPayload = this.buildDeliverQueryPayload(normalizedOption.businessType, context)
      const response = await this.client.post("EXP_RECE_QUERY_DELIVERTM", deliverPayload)
      const amount = this.extractFee(response)

      return {
        calculated_amount: amount ?? 0,
        is_calculated_price_tax_inclusive: false,
      }
    } catch (error) {
      this.logger.error(`SF-Express calculatePrice failed: ${(error as Error)?.message}`)
      return {
        calculated_amount: 0,
        is_calculated_price_tax_inclusive: false,
      }
    }
  }

  /*
  *Reference URL: https://docs.medusajs.com/resources/references/fulfillment/createFulfillment
  */
  async createFulfillment(
    data: Record<string, unknown>,
    items: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[],
    order: Partial<FulfillmentOrderDTO> | undefined,
    fulfillment: Partial<FulfillmentDTO>
  ): Promise<any> {
    // Shipping label creation is not covered by provided docs; store metadata for tracking.
    this.logger.info(`SF-Express createFulfillment invoked with ${items.length} items.`)
    return {
      data: {
        ...data,
        order_reference: order?.id,
        fulfillment_id: fulfillment.id,
      },
    }
  }

  /*
  *Reference URL: https://docs.medusajs.com/resources/references/fulfillment/cancelFulfillment
  */
  async cancelFulfillment(fulfillment: Record<string, unknown>): Promise<any> {
    this.logger.info("SF-Express cancelFulfillment called; no remote action implemented.")
    return { id: fulfillment.id, canceled: true }
  }

  async createReturnFulfillment(fulfillment: Record<string, unknown>): Promise<any> {
    this.logger.info("SF-Express createReturnFulfillment called; passthrough only.")
    return { data: fulfillment }
  }

  async getFulfillmentDocuments(
    data: Record<string, unknown>
  ): Promise<any> {
    // assuming you contact a client to
    // retrieve the document
    return []
  }

  async getReturnDocuments(
    data: Record<string, unknown>
  ): Promise<any> {
    // assuming you contact a client to
    // retrieve the document
    return []
  }

  async getShipmentDocuments(
    data: Record<string, unknown>
  ): Promise<any> {
    // assuming you contact a client to
    // retrieve the document
    return []
  }

  async retrieveDocuments(
    fulfillmentData: Record<string, unknown>,
    documentType: "invoice" | "label"
  ): Promise<any> {
    return
  }

  /* Helpers */

  protected resolveOption(data: any): NormalizedOption | null {
    if (!data || typeof data !== "object") {
      return null
    }

    const businessType = this.normalizeBusinessType(
      data.businessType || data.business_type || data.productCode
    )

    if (this.options.debug)
    {
      if (businessType == "1") {
        this.logger.warn(`SF-Express business type: 顺丰速运`)
      }

      if (businessType == "2") {
        this.logger.warn(`SF-Express business type: 顺丰陆运`)
      }

    }

    const id = businessType || data.id
    if (!id) {
      return null
    }
    return {
      id,
      name: data.name || data.productName || "SF Express",
      businessType,
      raw: data,
    }
  }

  protected buildDeliverQueryPayload(
    businessType: string,
    context: CalculateShippingOptionPriceContext
  ): Record<string, unknown> {
    const weight = this.getTotalWeight(context?.items)
    const consignedTime = this.options.default_send_time ?? this.formatDateTime(new Date())
    const destAddress = this.resolveAddressFromContext(context)
    const srcAddress: ShippingAddressPayload = {
      province: this.options.default_src_province,
      city: this.options.default_src_city,
      district: this.options.default_src_district,
      address: this.options.default_src_address,
    }

    return {
      businessType,
      searchPrice: "1",
      consignedTime,
      weight,
      srcAddress,
      destAddress,
    }
  }

  protected resolveAddressFromContext(context: CalculateShippingOptionPriceContext): ShippingAddressPayload {
    const addr = context?.shipping_address ?? {}
    const province = (addr as any).province ?? (addr as any).region ?? this.options.default_dest_province
    const city = (addr as any).city ?? this.options.default_dest_city
    const district =
      (addr as any).metadata?.district ??
      (addr as any).county ??
      (addr as any).address_2 ??
      this.options.default_dest_district
    const address =
      (addr as any).address_1 ??
      (addr as any).address ??
      this.options.default_dest_address ??
      (addr as any).address_2

    return {
      province,
      city,
      district,
      address,
    }
  }

  protected extractFee(response: SFExpressResponse): number | undefined {
    const data = response.apiResultData
    const deliverList = data?.msgData?.deliverTmDto ?? data?.deliverTmDto ?? []
    const first = Array.isArray(deliverList) ? deliverList[0] : undefined
    if (!first) {
      return undefined
    }
    const fee = Number(first.fee)
    return Number.isFinite(fee) ? fee : undefined
  }

  protected getTotalWeight(items: CalculateShippingOptionPriceContext["items"] | undefined): number {
    if (!items?.length) {
      return 1
    }

    let totalWeight = items.reduce((sum, item) => {
      const quantity = Number(item.quantity ?? 0) || 0
      const weightPerItem = Number((item as any).variant?.weight) || 0
      return sum + quantity * weightPerItem
    }, 0)

    // Medusa stores weight in grams; SF-Express expects kilograms.
    totalWeight = totalWeight / 1000
    return totalWeight > 0 ? totalWeight : 1
  }

  protected formatDateTime(date: Date): string {
    const pad = (n: number) => `${n}`.padStart(2, "0")
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  }

  protected normalizeBusinessType(value: any): string | undefined {
    if (value === undefined || value === null) {
      return undefined
    }
    const normalized = String(value).trim().toLowerCase()
    switch (normalized) {
      case "standard":
      case "2":
        return "2"
      case "express":
      case "1":
        return "1"
      case "next-morning":
      case "5":
        return "5"
      case "same-day":
      case "6":
        return "6"
      default:
        return String(value)
    }
  }
}

export default SFExpressFulfillmentProviderService
