import { Options } from "./service"
import { MedusaError } from "@medusajs/framework/utils"

export class SFExpressClient {

  options: Options

  constructor(options) {
    this.options = options
  }

  private async sendRequest(url: string, data?: RequestInit): Promise<any> {

  }
}