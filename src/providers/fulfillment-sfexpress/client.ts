import crypto from "crypto"
import { Options } from "./service"
import { MedusaError } from "@medusajs/framework/utils"

type HttpMethod = "GET" | "POST"
type RequestParams = Record<string, unknown>

export class Client {

  protected options: Options
  protected baseUrl: string
  protected timeout: number

  constructor(options: Options = {}) {
    this.options = { debug: false, ...(options ?? {}) }
    const baseHost = this.options?.sandbox
      ? "https://open-test.4px.com"
      : "https://open.4px.com"
    this.baseUrl = `${baseHost}/router/api/service`
    this.timeout = this.options?.timeout ?? 10000
  }

  async post(
    methodName: string,
    payload: Record<string, unknown> = {},
    params: RequestParams = {}
  ) {
    return this.request(methodName, payload, "POST", params)
  }

  async get(methodName: string, params: RequestParams = {}) {
    return this.request(methodName, undefined, "GET", params)
  }

  protected async request(
    methodName: string,
    payload: Record<string, unknown> | undefined,
    httpMethod: HttpMethod,
    additionalParams: RequestParams
  ) {

  }

  protected generateSignature(
    params: RequestParams,
    payload: Record<string, unknown> | undefined
  ) {

  }


  protected parseResponse(methodName: string, rawResponse: any) {

  }
}