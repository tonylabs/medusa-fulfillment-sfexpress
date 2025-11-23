# EXP_RECE_QUERY_DELIVERTM

Client can use this API to query the transit time and pricing for shipments from a specific origin to a specific destination.

### API Definition

#### Common Parameters

| Name | Value |
|------|--------|
| Service Code | **EXP_RECE_QUERY_DELIVERTM** |
| Batch Transactions | Not supported |
| Interface Type | Access |
| Message Format | JSON |

#### Request Parameter Structure (JSON for `msgData`)

| # | Field | Type | Required | Description |
|---|--------|--------|----------|-------------|
| 1 | businessType | String | Yes | Transit time code. If empty → returns product list of default transit times. Example: `1` express, `2` standard express, `5` next-morning, `6` same-day. |
| 2 | weight | Double | No | Total weight (kg), **>0**, precise to 2 decimals. |
| 3 | volume | Double | No | Volume (cm), precise to 2 decimals. |
| 4 | consignedTime | String | No | Format `YYYY-MM-DD HH:MM:SS`. |
| 5 | searchPrice | String | No | `1` include price, `0` exclude price. Only 0/1/omit allowed. |
| 6 | destAddress | Object | Yes | Destination address. |
| 7 | srcAddress | Object | Yes | Origin address. |
| 8 | monthlyCard | String | Conditional | Required when querying certain products (personalized pricing). |

#### `destAddress`

| # | Field | Type | Required | Description |
|---|--------|--------|----------|-------------|
| 1 | province | String(30) | Conditional | Standard province name, required if `code` is empty. |
| 2 | city | String(100) | Conditional | Standard city name, required if `code` is empty. |
| 3 | district | String(100) | No | Standard district name. |
| 4 | address | String(450) | No | Full detailed address (recommended for best parsing). |
| 5 | code | String(30) | Conditional | Area code; if provided, province/city/district are ignored. |

#### `srcAddress`

| # | Field | Type | Required | Description |
|---|--------|---------|----------|-------------|
| 1 | province | String(30) | Conditional | Required if `code` and `address` are empty. |
| 2 | city | String(100) | Conditional | Required if `code` and `address` are empty. |
| 3 | district | String(100) | No | Standard district name. |
| 4 | address | String(450) | Conditional | Required if `code` is empty and province/city are incomplete. |
| 5 | code | String(30) | Conditional | If provided, province/city/address ignored. |

#### Request Example (JSON)

```json
{
    "businessType": "2",
    "consignedTime": "2020-09-30 17: 01: 48",
    "destAddress": {
        "address": "北京街道西湖路38号首层102号东南铺江博士",
        "city": "广州市",
        "district": "越秀区",
        "province": "广东省"
    },
    "searchPrice": "1",
    "srcAddress": {
        "address": "琶洲街道琶洲蟠龙新街2号保利广场购物中心3层3036号江博士专卖铺",
        "city": "广州市",
        "district": "海珠区",
        "province": "广东省"
    },
    "weight": 1
}
```

### Common Response Parameters

| # | Field | Type | Required | Description |
|---|--------|----------|----------|-------------|
| 1 | success | String | Yes | `true` = success, `false` = failure |
| 2 | errorCode | String | Yes | Error code (`S0000` indicates success) |
| 3 | errorMsg | String | Yes | Error message |
| 4 | msgData | String | Yes | Detailed response data |

#### Response Structure (msgData)

| # | Field | Type | Description |
|---|--------|---------|-------------|
| 1 | businessType | String | Product code |
| 2 | businessTypeDesc | String | Product description |
| 3 | deliverTime | String | Commitment time |
| 4 | fee | Double | Price (null = no pricing or pricing not requested) |
| 5 | searchPrice | String | `1` price included, `0` price excluded |
| 6 | closeTime | String | Cutoff time |

#### Success Response Example

```json
{
    "success": true,
    "errorCode": "S0000",
    "errorMsg": null,
    "msgData": {
        "deliverTmDto": [
            {
                "businessType": "2",
                "businessTypeDesc": "顺丰特惠",
                "deliverTime": "2020-10-20 18:00:00,2020-10-20 18:00:00",
                "fee": 119,
                "searchPrice": "1",
                "closeTime": null
            }
        ]
    }
}
```

#### Failed Response Example

```json
{
    "success": false,
    "errorCode": "S0001",
    "errorMsg": "非法的JSON格式",
    "msgData": null
}
```

### API Response Error Codes

| Code  | Description | Solution |
|--------|-------------|-----------|
| **A1000** | Platform validation succeeded, backend invoked. Does **not** mean business succeeded. Check `apiResultData`. | Call succeeded normally. |
| **A1001** | Required parameters missing. | 1. Check required fields.<br>2. Ensure header `Content-type: application/x-www-form-urlencoded`.<br>3. Check for spaces in parameter keys.<br>4. Ensure all parameters are URL-encoded.<br>5. `msgData` must be valid JSON.<br>6. Entire request must be form-data. |
| **A1002** | Request expired. | `accessToken` expired (valid for 2 hours). Refresh using OAuth2 authentication. |
| **A1003** | Invalid IP. | Remove IP binding or call from a bound/whitelisted IP. |
| **A1004** | No permission for requested service. | Associate API in console; verify correct environment (sandbox/production); wait 2 minutes for config to take effect. |
| **A1005** | Rate limited. | Limit: **30 calls/s**, **3000 calls/day** per API. Avoid stress testing. |
| **A1006** | Invalid digital signature. | Verify checkword, signature process, special characters, and form-data format. Consider switching to OAuth2. |
| **A1007** | Duplicate request. | Ensure `orderId` in `msgData` is unique for each request. |
| **A1008** | Data decryption failed. | Contact support. |
| **A1009** | Downstream service unreachable. | Contact support. |
| **A1010** | Sandbox test status. | Occurs mainly for old customers. Contact support. |
| **A1099** | System error. | Contact support. |

### Business Response Error Codes

| # | Code   | Description |
|---|--------|-------------|
| 1 | **S0000** | Success |
| 2 | **S0001** | Invalid JSON format |
| 3 | **S0002** | Required parameter `%s` is empty |
| 4 | **S0003** | Data error or runtime exception |
| 5 | **S0004** | Parameter `%s` exceeds maximum length `%d` |
| 6 | **S0005** | Parameter exceeds maximum allowed value |
| 7 | **S0006** | Parameter `%s` cannot be less than `%d` |
| 8 | **S0007** | Incorrect data type for parameter `%s` |