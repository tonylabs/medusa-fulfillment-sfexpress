import { randomUUID } from "crypto"
import { MedusaError } from "@medusajs/framework/utils"
import { Options } from "./service"
import { ProductRecommendation, SFExpressResponse } from "./types"

type RequestPayload = Record<string, unknown>

const SF_PRODUCTION_URL = "https://bspgw.sf-express.com/std/service"
const SF_SANDBOX_URL = "https://sfapi-sbox.sf-express.com/std/service"
const SF_AUTH_PRODUCTION_URL = "https://sfapi.sf-express.com/oauth2/accessToken"
const SF_AUTH_SANDBOX_URL = "https://sfapi-sbox.sf-express.com/oauth2/accessToken"

export class Client {
  protected options: Options
  protected baseUrl: string
  protected timeout: number
  protected accessToken?: string
  protected tokenExpiresAt?: number
  protected tokenRequest?: Promise<string>

  constructor(options: Options = {}) {
    this.options = { debug: false, ...(options ?? {}) }
    this.baseUrl = this.options.sandbox ? SF_SANDBOX_URL : SF_PRODUCTION_URL
    this.timeout = this.options.timeout ?? 15000
  }

  async post(
    serviceCode: string,
    msgData: RequestPayload = {},
    allowRetryOnAuthError = true
  ): Promise<SFExpressResponse> {
    if (!this.options.partner_id) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "partner_id is required for SF-Express client")
    }

    const partnerId = this.options.partner_id
    const accessToken = await this.getAccessToken()
    const timestamp = Date.now().toString()
    const msgDataString = JSON.stringify(msgData ?? {})
    const bodyParams = new URLSearchParams()
    bodyParams.append("partnerID", partnerId)
    bodyParams.append("requestID", randomUUID())
    bodyParams.append("serviceCode", serviceCode)
    bodyParams.append("timestamp", timestamp)
    bodyParams.append("msgData", msgDataString)
    bodyParams.append("accessToken", accessToken)
    const body = bodyParams.toString()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
        body,
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          `SF-Express request failed with status ${response.status}`,
        )
      }

      const rawText = await response.text()
      const rawJson = this.safeParseJSON(rawText)

      if (rawJson?.apiResultCode === "A1002" && allowRetryOnAuthError) {
        this.invalidateAccessToken()
        return this.post(serviceCode, msgData, false)
      }

      const parsed = this.parseResponse(rawJson)

      if (this.options.debug) {
        // eslint-disable-next-line no-console
        console.debug("[SF-Express] Response:", JSON.stringify(parsed, null, 2))
      }

      return parsed
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          "SF-Express request timed out"
        )
      }
      throw error
    } finally {
      clearTimeout(timer)
    }
  }

  async getRecommendProduct(): Promise<ProductRecommendation[]> {
    const payload = this.buildProductRecommendPayload()
    const response = await this.post("EXP_RECE_PSDS_PRODUCT_RECOMMEND", payload)
    const data = response.apiResultData
    const list =
      data?.msgData?.productList ??
      data?.msgData?.recommendList ??
      data?.msgData?.products ??
      data?.productList ??
      []

    if (!Array.isArray(list)) {
      return []
    }

    return list.map((item: any) => ({
      businessType: item.businessType ?? item.productCode ?? item.businessTypeCode,
      productName: item.productName ?? item.productDesc,
      fee: item.fee,
      productCode: item.productCode,
      raw: item,
    }))
  }

  protected parseResponse(rawResponse: any): SFExpressResponse {
    const apiResultCode = rawResponse?.apiResultCode
    const apiErrorMsg = rawResponse?.apiErrorMsg
    const apiResponseID = rawResponse?.apiResponseID

    const rawResultData = rawResponse?.apiResultData
    const resultData = typeof rawResultData === "string" ? this.safeParseJSON(rawResultData) : rawResultData

    if (apiResultCode !== "A1000") {
      const reason = apiErrorMsg || resultData?.errorMsg || "SF-Express API error"
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `SF-Express error ${apiResultCode}: ${reason}`)
    }

    if (resultData && typeof resultData === "object" && "success" in resultData && resultData.success === false) {
      const reason = resultData.errorMsg || resultData.msg || "SF-Express business call failed"
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, reason)
    }

    return {
      apiErrorMsg,
      apiResultCode,
      apiResponseID,
      apiResultData: resultData,
    }
  }

  protected async getAccessToken(): Promise<string> {
    const now = Date.now()
    if (this.accessToken && this.tokenExpiresAt && now < this.tokenExpiresAt) {
      return this.accessToken
    }

    if (this.tokenRequest) {
      return this.tokenRequest
    }

    const tokenPromise = this.requestAccessToken()
    this.tokenRequest = tokenPromise
    tokenPromise.finally(() => {
      this.tokenRequest = undefined
    })
    return tokenPromise
  }

  protected async requestAccessToken(): Promise<string> {
    const partnerId = this.options.partner_id
    if (!partnerId) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "partner_id is required for SF-Express client")
    }

    const secret = this.options.sandbox ? this.options.secret_sandbox : this.options.secret_production

    if (!secret) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "SF-Express secret is missing. Provide secret_sandbox or secret_production.",
      )
    }

    const bodyParams = new URLSearchParams()
    bodyParams.append("partnerID", partnerId)
    bodyParams.append("secret", secret)
    bodyParams.append("grantType", "password")
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(this.options.sandbox ? SF_AUTH_SANDBOX_URL : SF_AUTH_PRODUCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
        body: bodyParams.toString(),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          `SF-Express token request failed with status ${response.status}`,
        )
      }

      const rawText = await response.text()
      const rawJson = this.safeParseJSON(rawText)
      const apiResultCode = rawJson?.apiResultCode
      const token = rawJson?.accessToken
      const expiresIn = Number(rawJson?.expiresIn ?? 7200)

      if (apiResultCode !== "A1000" || !token) {
        const reason = rawJson?.apiErrorMsg || "Unable to retrieve SF-Express access token"
        throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `SF-Express auth error ${apiResultCode}: ${reason}`)
      }

      const bufferMs = 60_000
      const expiresAt = Date.now() + Math.max(expiresIn * 1000 - bufferMs, 0)
      this.accessToken = token
      this.tokenExpiresAt = expiresAt

      if (this.options.debug) {
        // eslint-disable-next-line no-console
        console.debug("[SF-Express] Access token refreshed. Expires in (s):", expiresIn)
      }

      return token
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "SF-Express token request timed out")
      }
      throw error
    } finally {
      clearTimeout(timer)
    }
  }

  protected invalidateAccessToken(): void {
    this.accessToken = undefined
    this.tokenExpiresAt = undefined
    this.tokenRequest = undefined
  }

  protected safeParseJSON(value: string): any {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }

  protected buildProductRecommendPayload(): Record<string, unknown> {
    const now = new Date()
    const sendTime = this.options.default_send_time ?? this.formatDateTime(now)

    const required = [
      this.options.default_src_province,
      this.options.default_src_city,
      this.options.default_dest_province,
      this.options.default_dest_city,
      this.options.default_payment_terms,
    ]

    if (required.some((val) => !val)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Missing required SF-Express defaults for product recommendations (source/destination/payment terms).",
      )
    }

    return {
      srcProvince: this.options.default_src_province,
      srcCity: this.options.default_src_city,
      srcCounty: this.options.default_src_district,
      destProvince: this.options.default_dest_province,
      destCity: this.options.default_dest_city,
      destCounty: this.options.default_dest_district,
      sendTime,
      weight: 1,
      paymentTerms: this.options.default_payment_terms,
      srcAddress: this.options.default_src_address,
      destAddress: this.options.default_dest_address,
    }
  }

  protected formatDateTime(date: Date): string {
    const pad = (n: number) => `${n}`.padStart(2, "0")
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  }
}
