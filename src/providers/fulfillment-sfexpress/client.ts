import { randomUUID } from "crypto"
import { MedusaError } from "@medusajs/framework/utils"
import type { Options } from "./service"
import { ProductRecommendation, SFExpressResponse, RecommendationRoute } from "./types"
import { formatSFDateTime } from "./utils"

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
    this.options = { debug: false, default_payment_terms: "1", ...(options ?? {}) }
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
        console.debug("[SF-Express] Response:", { serviceCode, apiResultCode: parsed.apiResultCode, apiResponseID: parsed.apiResponseID })
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

  async getRecommendProduct(
    route: RecommendationRoute
  ): Promise<ProductRecommendation[]> {
    const payload = this.buildProductRecommendPayload(route)
    const response = await this.post("EXP_RECE_PSDS_PRODUCT_RECOMMEND", payload)
    const data = response.apiResultData
    const list =
      data?.msgData?.productList ??
      data?.msgData?.recommendList ??
      data?.msgData?.products ??
      data?.productList ??
      (Array.isArray(data?.msgData) ? data.msgData : [])

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

    if (!resultData || typeof resultData !== "object" || Array.isArray(resultData)) {
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "SF-Express returned invalid business response data")
    }
    if (typeof resultData.msgData === "string") {
      resultData.msgData = this.safeParseJSON(resultData.msgData)
    }
    if (resultData.success === false || resultData.success === "false") {
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
    try {
      return await tokenPromise
    } finally {
      // Avoid an unobserved rejected promise from tokenPromise.finally().
      if (this.tokenRequest === tokenPromise) this.tokenRequest = undefined
    }
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

      if (apiResultCode !== "A1000" || typeof token !== "string" || !token || !Number.isFinite(expiresIn) || expiresIn <= 0) {
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

  protected buildProductRecommendPayload(route: RecommendationRoute): Record<string, unknown> {
    const { origin, destination, weight = 1 } = route
    const required = [origin?.province, origin?.city, origin?.address,
      destination?.province, destination?.city, destination?.address]
    if (required.some((value) => !value?.trim()) || !Number.isFinite(weight) || weight <= 0) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA,
        "SF-Express product recommendations require complete origin/destination addresses and positive weight")
    }
    if (!["1", "2", "3", "4"].includes(this.options.default_payment_terms!)) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid SF-Express payment terms")
    }
    return {
      srcProvince: origin.province, srcCity: origin.city, srcCounty: origin.district,
      srcAddress: origin.address, destProvince: destination.province,
      destCity: destination.city, destCounty: destination.district,
      destAddress: destination.address, weight,
      sendTime: this.options.default_send_time ?? formatSFDateTime(new Date()),
      paymentTerms: this.options.default_payment_terms,
      ...(this.options.monthly_card ? { monthlyCard: this.options.monthly_card } : {}),
    }
  }
}
