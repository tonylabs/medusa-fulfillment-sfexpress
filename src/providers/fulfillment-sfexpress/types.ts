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

export type SFAddress = {
  province: string
  city: string
  district?: string
  address: string
}

export type RecommendationRoute = {
  origin: SFAddress
  destination: SFAddress
  weight?: number
}
