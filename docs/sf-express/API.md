# SF-Express API Overview

## Purpose of This Document

This document mainly standardizes the common aspects involved in system integration between the SF Unified Access Platform and cooperative partners, such as basic parameters, data security, and unified error codes.  
For details of each business interface, please refer to the data definition of the specific business interface.

## Communication Conventions

Request URLs (HTTPS only):
``
| Environment | URL |
|-------------|-----|
| Production | https://bspgw.sf-express.com/std/service |
| Hong Kong Production URL | https://sfapi-hk.sf-express.com/std/service |
| Sandbox | https://sfapi-sbox.sf-express.com/std/service |

---

## API Service Code Descriptions

| Service Code | Interface Name | Description |
|--------------|----------------|-------------|
| **EXP_RECE_QUERY_GIS_DEPARTMENT** | SF Service Outlet Query Interface | Query SF Express service outlets. |
| **EXP_RECE_VALIDATE_WAYBILLNO** | Waybill Number Validation Interface | Validate the legality of an SF waybill number. |
| **EXP_RECE_SEARCH_PROMITM** | Estimated Delivery Time Query Interface | Query the estimated delivery time. |
| **EXP_RECE_PSDS_PRODUCT_RECOMMEND** | Product Recommendation Interface | Provides product recommendation capabilities. |
| **EXP_EXCE_CHECK_PICKUP_TIME** | Pickup Service Time Query Interface | Query the available pickup service time. |
| **EXP_RECE_PSDS_RECOMMEND_VAS** | Value-Added Service Recommendation Interface | Provides recommendation of applicable value-added services. |
| **EXP_RECE_SEARCH_ROUTES** | Route Query Interface | Returns all routing node information as of the current time. |
| **EXP_RECE_FILTER_ORDER_BSP** | Order Filtering Interface | Determines whether the sender/receiver address is within SF’s service coverage. |
| **EXP_RECE_QUERY_DELIVERTM** | Transit Time & Price Query Interface | Provides transit time and pricing information. |

---

### Common Request Parameters

The following parameters are required for all API requests and must be included at the top level of the request (outside `msgData`):

| # | Parameter | Type | Required | Description |
|---|-----------|-------|----------|-------------|
| 1 | partnerID | String(64) | Yes | Partner / Customer code |
| 2 | requestID | String(40) | Yes | Unique request UUID |
| 3 | serviceCode | String(50) | Yes | API service code |
| 4 | timestamp | long | Yes | Timestamp of request |
| 5 | msgDigest | String(128) | Conditional | Digital signature (required for signature-based authentication) |
| 6 | accessToken | String | Conditional | Access token (required for OAuth2 authentication) |
| 7 | msgData | String | Yes | Business JSON data payload |

#### Additional Requirements

- Communication protocol: **HTTP**
- Request method: **POST**
- Headers must include: `"Content-type": "application/x-www-form-urlencoded"` Encoding: **UTF-8**
- All request parameters must be **URL-encoded**
- `msgData` must contain **JSON business data as a string**

---

## Request Parameter Examples

### cURL Request Example

```bash
curl --request POST \
  --url https://sfapi.sf-express.com/std/service \
  --header 'content-type: application/x-www-form-urlencoded' \
  --data partnerID=XXXX \
  --data requestID=fe4be6fc-065d-4914-bf78-da366639ec80 \
  --data serviceCode=EXP_RECE_CREATE_ORDER \
  --data timestamp=1708235379205 \
  --data 'msgData={"extraInfoList":[],"parcelQty":1,"totalWeight":6,"monthlyCard":"123455678","language":"zh-CN","cargoDetails":[{"volume":1,"amount":0,"unit":"件","count":1,"name":"Medicine","weight":0.1}],"contactInfoList":[{"address":"d1824f72d0acec0e9d187a826231d99e561497412b0e18c96de235bdc387d868968766b9fb6555047f99488ee1da870083057c47b96350d8f11307e07e5d49e1","province":"Shanxi","city":"Taiyuan","contact":"Mr. Zhang","county":"小店区"},{"address":"bd5bfbe73e8e94131128712653dc01743a18c4e5d30990c75c30fabcee235cc86b6415cf75a549cdb59724987b6acd46f7276423c46ac06775383aaa39931a06","province":"Shanxi","city":"Yangquan","contact":"Mrs. Han","county":"盂县","mobile":"55a3917e85e06cd84bf408d1063f1e93","company":"","contactType":2}]}' \
  --data 'msgDigest=JzWVEE1cW/cZHfoM9+olLw=='
```

---

## Signature Sign

The `msgDigest` is a digital signature used for request authentication, ensuring data integrity and verifying the identity of the caller.

### Digital Signature Example

1. Use the `msgData` field to represent the JSON content to be sent when making a request.
2. Use the `msgDigest` field for signature verification when sending a POST request. The signature uses the `MD5` method to sign the content of msgData. The `msgDigest` value is produced by concatenating `msgData`, the `timestamp`, and the `secret`, URL-encoding the result, computing its MD5 hash, and then encoding the output in Base64.

#### Example

Assuming:

- JSON content is: `{"language": "zh-CN", "orderId": "QIAO-20200618-004"}`
- Timestampe is: `12312334453453`
- Sandbox Secret is: `pp3eOwGR2jMZTl313aSNCybEEycG5ORNP`

The content (UTF-8) to be signed is: `{"language": "zh-CN", "orderId": "QIAO-20200618-004"}12312334453453pp3eOwGR2jMZTl313aSNCybEEycG5ORNP`, after applying MD5 and then Base64 encoding, the result is `IIKJtuLVzoFTu4kHI8M8vA==`.

The final data to be sent is:
- msgData = {"language": "zh-CN", "orderId": "QIAO-20200618-004"}
- msgDigest = IIKJtuLVzoFTu4kHI8M8vA==


#### Java Example Code:

```text
// Use SFEXPRESS_SECRET_SANDBOX or SFEXPRESS_SECRET_PRODUCTION
String checkWord = "fjcg5PGKaNpPSHFAZ4QsCOkV71R3zVci";

// Timestamp
String timestamp = "12312334453453";

// Payload
String msgData = "{\"language\":\"zh-CN\",\"orderId\":\"QIAO-20200618-004\"}";

// Combine the business message + timestamp + checkWord into the string to be encrypted (note the order)
String toVerifyText = msgData+timestamp+checkWord;

// Since the business message may contain special characters such as plus signs or spaces, URL encoding is required
toVerifyText = URLEncoder.encode(toVerifyText,"UTF-8");	

// MD5 Encryption		
MessageDigest  md5 = MessageDigest.getInstance("MD5");
md5.update(toVerifyText.getBytes("UTF-8"));
byte[] md = md5.digest();

// Generate the digital signature using BASE64
String msgDigest = new String(new BASE64Encoder().encode(md));
```

---

## Response

| Attribute | Type | Required | Meaning |
|-----------|------|----------|---------|
| apiResultCode | String(10) | Y | API platform result code |
| apiErrorMsg | String(200) | N | API platform error message |
| apiResponseID | String(40) | Y | Unique API response ID (UUID) |
| apiResultData | String | N | Detailed business processing result |

### Response Example

```json
{
  "apiErrorMsg": "",
  "apiResponseID": "00016B0D59BA503FDF3C3333355F863F",
  "apiResultCode": "A1000",
  "apiResultData": "{\"success\":false,\"errorCode\":\"8016\",\"errorMsg\":\"重复下单\",\"msgData\":null}"
}
```

### Global Response Code

# API Platform Common Return Code List

| Code  | Description | Solution |
|-------|-------------|-----------|
| **A1000** | Unified access platform validation succeeded, and backend service invocation succeeded. **Note:** This does **not** represent success of backend business processing. Actual business result must be checked in `apiResultData`. | Indicates the API call is normal. |
| **A1001** | Required parameters cannot be empty. | Please check the following: <br>1. Required fields are not filled. <br>2. Request header missing `Content-type: application/x-www-form-urlencoded`. <br>3. Parameter keys contain spaces. <br>4. HTTP request parameters must be URL-encoded. <br>5. Business payload (`msgData`) must be valid JSON format. <br>6. Entire request must use *form data* format. |
| **A1002** | Request has expired. | Occurs when using OAuth2 authentication. <br>Check whether the `accessToken` has exceeded the 2-hour validity period. Retrieve a new token via the OAuth2 authentication interface. |
| **A1003** | Invalid IP. | The customer code (`partnerID`) is configured to validate IP. Remove the IP restriction or call the API from the bound IP. |
| **A1004** | No permission for the requested service. | Possible reasons: <br>1. `partnerID` has not been associated with the corresponding API in **Developer Integration → API List**. <br>2. API environment mismatch: <br> a. “Testing” status → use sandbox environment. <br> b. “Online” status → use production environment. <br>3. Backend config not yet effective; wait 2 minutes and retry. If still failing, contact support. |
| **A1005** | Rate limit control. | Fengqiao (integration environment) has global rate limiting. For each customer code: <br>1. Max **30 calls/second** per interface. <br>2. Max **3000 calls/day** per interface. <br>Please avoid stress testing; only perform functional integration tests. |
| **A1006** | Invalid digital signature. | Please check the following: <br>1. Ensure the `checkword` is configured correctly. <br>2. Ensure `verifyCode` and `msgDigest` are correctly encrypted/signed. <br>3. Check for special characters (e.g., `&`). <br>4. Entire request must be form-data format. <br>5. For non-Java languages, pay attention to special characters; currently supported: `"*"`, `" "`, `"-"`. <br>6. If digital signature is inconvenient, switch to OAuth2 authentication (token-based). Refer to “Authentication Specification”. |
| **A1007** | Duplicate request. | Not used at API platform layer; used mainly at business layer (e.g., order creation). Ensure `orderId` in `msgData` is unique. Modify and retry. |
| **A1008** | Data decryption failed. | Used in special scenarios. If it occurs, contact support. |
| **A1009** | Target service exception or unreachable. | Downstream service error. Contact support if this occurs. |
| **A1010** | Sandbox-test status. | Occurs with older customers; not expected for new customers. Contact support if encountered. |
| **A1099** | System exception. | General API service error. Contact support. |

---

## Global API Error Codes

### Detailed Business Error Codes

| Error Code | Chinese Description | English Description | Handling Recommendation |
|-----------|----------------------|----------------------|-------------------------|
| **1010** | 寄件地址不能为空 | Shipper’s address is required. | `address` cannot be empty. |
| **1011** | 寄件联系人不能为空 | Shipper’s contact name is required. | `contact` cannot be empty. |
| **1012** | 寄件电话不能为空 | Shipper’s telephone number is required. | `mobile` and `tel` cannot both be empty. |
| **1014** | 到件地址不能为空 | Receiver’s address is required. | `address` cannot be empty. |
| **1015** | 到件联系人不能为空 | Receiver’s contact name is required. | `contact` cannot be empty. |
| **1016** | 到件电话不能为空 | Receiver’s telephone number is required. | `mobile` and `tel` cannot both be empty. |
| **1020** | 出口件邮编不能为空 | Postal code is required for international shipments. | `postCode` cannot be empty. |
| **1023** | 拖寄物品名不能为空 | Commodity name is required. | `cargoDetails.name` cannot be empty. |
| **1028** | 出口件时，拖寄物数量不能为空 | Commodity quantity is required for international shipments. | `cargoDetails.count` cannot be empty. |
| **1038** | 出口件声明价值不能为空 | The declared value is required for international shipments. | `cargoDeclaredValue` cannot be empty. |
| **6126** | 月结卡号不合法 | Invalid credit account number. | `monthlyCard` must be a 10-digit number. |
| **6127** | 增值服务名不能为空 | AVS name is required. | `serviceList.name` is empty. |
| **6128** | 增值服务名不合法 | Invalid AVS name. | Incorrect value for `serviceList.name`. |
| **6130** | 体积参数不合法 | Invalid volume parameters. | Incorrect `volume` value. |
| **6138** | 代收货款金额传入错误 | COD amount data error. | For COD, `serviceList.value` must be a number. |
| **6139** | 代收货款金额小于0错误 | COD amount is less than 0. | COD value must be **greater than 0**. |
| **6150** | 找不到该订单 | This order cannot be found. | Check whether `orderId` is correct. |
| **6200** | 国际件寄方邮编不能为空 | Shipper postal code is required for international shipments. | `postCode` cannot be empty. |
| **6201** | 国际件到方邮编不能为空 | Receiver postal code is required for international shipments. | `postCode` cannot be empty. |
| **6202** | 国际件货物数量不能为空 | Cargo quantity is required. | `cargoDetails.count` cannot be empty. |
| **6203** | 国际件货物单位不能为空 | Cargo unit is required. | `cargoDetails.unit` cannot be empty. |
| **6204** | 国际件货物单位重量不能为空 | Cargo unit weight is required. | `cargoDetails.weight` cannot be empty. |
| **6205** | 国际件货物单价不能为空 | Cargo unit price is required. | `cargoDetails.amount` cannot be empty. |
| **6206** | 国际件货物币种不能为空 | Cargo currency is required. | `cargoDetails.currency` cannot be empty. |
| **6207** | 国际件原产地不能为空 | Origin code is required. | `cargoDetails.sourceArea` cannot be empty. |
| **8003** | 查询单号超过最大限制 | The query AWB number exceeds the limit. | Maximum 10 tracking numbers per request. |
| **8013** | 未传入查询单号 | AWB number for query is not received. | Ensure `orderId` or `trackingNumber` is provided. |
| **8016** | 重复下单 | Duplicated order ID. | `orderId` must be unique. |
| **8017** | 订单号与运单号不匹配 | Order number does not match AWB number. | Verify that `orderId` matches the waybill number. |
| **8018** | 未获取到订单信息 | Order information not received. | Check whether `orderId` is correct. |
| **8024** | 未下单 | Order is not yet placed. | Call the order creation API first. |
| **8252** | 订单已确认 | Order already confirmed. | Order has already been confirmed; cannot confirm again. |
| **8037** | 订单已消单 | Order already cancelled. | Order is already cancelled; cannot cancel again. |
| **8027** | 不存在的业务模板 | Business template does not exist. | `bizTemplateCode` is invalid or empty. |
| **8067** | 超过最大能申请子单号数量 | Exceeds maximum number of sub-waybills. | Max 307 sub-waybills per order. |
| **8096** | 您的预约超出今日营业时间… | — | `sendStartTm` must be within business hours or set `isDocall = 0`. |
| **8114** | 传入了不可发货的月结卡号 | — | Contact sales manager to enable the monthly card. |
| **8117** | 下单包裹不能大于307个 | — | Max 307 packages per order. |
| **8119** | 月结卡号不存在或已失效 | — | `monthlyCard` does not exist or is invalid. |
| **8168** | 订单已生成路由不能申请子单 | — | Order has already been picked up. |
| **8191** | 运单号格式不正确 | — | `waybillType` cannot both be 1. |
| **8194** | 跨境件必须包含申明价值和币别 | — | Must provide `consValue` and `consValueCurrencyCode`. |
| **8196** | 信息异常 | — | Phone number information is abnormal. |
| **8247** | 运单号不合法 | — | Verify the waybill belongs to SF (prod vs sandbox cannot mix). |
| **8053** | 目的地不在定时派送服务范围内 | — | Destination does not support timed delivery; remove service `IN26`. |
| **8052** | 原寄地不在定时派送服务范围内 | — | Origin does not support timed delivery; remove `IN26`. |
| **8051** | 定时派送不在时效范围内 | — | Provided time is not valid; use returned valid time range. |
| **8179** | 卡号下未查到关联相应协议 | — | Contact sales to bind the proper product agreement. |
| **8177** | 正值运力高峰期… | — | Peak capacity control. |
| **20012** | 定时派送不支持重量超过300KG | — | `totalWeight` cannot exceed 300kg. |
| **20011** | 产品与定时派送服务时间段不匹配 | — | Adjust `TDELIVERY` AVS value1. |
| **8256** | 不支持到付/寄付现结 | — | Set `payMethod` to 1 or 3 and provide `monthlyCard`. |
| **20035** | 托寄物违禁品不可收寄 | — | Change `cargoDetails.name`. |
| **20036** | 适用产品不满足 | — | Change `expressTypeId` and reorder; if still failing, contact SF sales. |
| **8057** | 快件类型为空或未配置 | — | `expressTypeId` is invalid; refer to *Product Category Table*. |

