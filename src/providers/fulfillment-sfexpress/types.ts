export type SFExpressResponse = {
  apiErrorMsg?: string
  apiResultCode?: string
  apiResponseID?: string
  apiResultData?: any
}

export type ProductRecommendation = {
  businessType?: string
  productCode?: string
  productName?: string
  productDesc?: string
  fee?: number
  raw?: any
}
