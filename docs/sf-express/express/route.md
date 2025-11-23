# EXP_RECE_SEARCH_ROUTES

## Function Description

Use this API to query SF Express waybill routes. SF Express returns all route node information in the JSON response.

Notes:
1. You can query waybill routes within the last 3 months. An empty route response indicates no query permission / no route / exceeded 3 months.
2. The response message is MOCK and not affected by full-process testing tools.

This route query interface supports three query methods:

1. Query by SF Express waybill number (monthly-account payment only)
   - The monthly-account card number used by the waybill must match the partnerID (customer code). If the binding relationship is valid, route information is returned; otherwise, the routes field is empty.
2. Query by customer order number
   - The system verifies if all order numbers belong to the partnerID. Valid order numbers will map to the corresponding waybill numbers, and their route information will be returned.

3. Query by waybill number + last 4 digits of sender/recipient phone number
   - Provide checkPhoneNo (comma-separated last 4 digits for bulk queries). If the system validates the phone digits, it returns the corresponding route information.

###

This routing query API supports three types of queries:

1) **Query by SF Waybill Number (limited to monthly-account payments)**  
   The waybill number being queried must be paid using a monthly account that is bound to the `partnerID` (customer code) used when calling the API.  
   If the binding relationship is valid, the system returns the route information of the waybill; otherwise, the `routes` field in the response will be empty.

2) **Query by Customer Order Number**  
   The request must include the `partnerID` (customer code) and the order number(s).  
   The system verifies whether the provided `partnerID` matches the ownership of each order number.  
   For each order number that matches correctly, the system locates the associated waybill number and returns the routing information for those waybills.  
   This method is applicable to customers who place orders under the specified `partnerID`.

3) **Query by Waybill Number + Last 4 Digits of Sender/Receiver Phone Number**  
   Provide the waybill number and the last four digits of either the sender’s or receiver’s phone number in the `checkPhoneNo` parameter.  
   If the information matches, the system returns the corresponding routing information.  
   For batch queries, multiple phone-number suffixes can be provided, separated by commas in a single string.

| Name                     | Value                                        |
|--------------------------|----------------------------------------------|
| API Service Code         | EXP_RECE_SEARCH_ROUTES                       |
| Production Environment   | https://bspgw.sf-express.com/std/service     |
| Hong Kong Production Env | https://sfapi-hk.sf-express.com/std/service  |
| Sandbox Environment      | https://sfapi-sbox.sf-express.com/std/service|
| Batch Transaction        | Up to 10 tracking_number values              |
| Interface Type           | Access                                       |
| Message Format           | JSON                                         |

1. **HTTP is used as the communication protocol** between both parties.
2. **POST** must be used for requests, and the request header must include  
   `"Content-type": "application/x-www-form-urlencoded"`.  
   Character encoding must be **UTF-8**.
3. **Parameters must be transmitted using HTTP URL encoding.**
4. **Business data must be placed in the `msgData` field as a string.**

### Request Parameters

| No. | Parameter      | Type        | Required | Description |
|-----|----------------|-------------|----------|-------------|
| 1   | partnerID      | String(64)  | Yes      | Partner code / Customer code (see acquisition guide) |
| 2   | requestID      | String(40)  | Yes      | Unique request ID (UUID) |
| 3   | serviceCode    | String(50)  | Yes      | API service code (`EXP_RECE_SEARCH_ROUTES`) |
| 4   | timestamp      | long        | Yes      | API call timestamp |
| 5   | msgDigest      | String(128) | Conditional | Digital signature. Required when using signature-based authentication. Cannot be used together with `accessToken`. See **Digital Signature Authentication Instructions**. |
| 6   | accessToken    | String      | Conditional | Access token. Required when using OAuth2 authentication. Cannot be used together with `msgDigest`. See **OAuth2 Authentication Instructions**. |
| 7   | msgData        | String      | Yes      | Business data message |

#### Request Parameter: `<msgData>`

`<msgData>` represents the business data payload.

| # | Field Name      | Type (Constraint) | Required | Default | Description |
|---|-----------------|-------------------|----------|----------|-------------|
| 1 | language        | String(10)        | No       | —        | Response language. Default is `zh-CN`. Supported values: `zh-CN` (Simplified Chinese), `zh-TW` / `zh-HK` / `zh-MO` (Traditional Chinese), `en` (English). |
| 2 | trackingType    | Number(2)         | Yes      | 1        | Type of tracking number:<br>**1**: Query by SF waybill number; `trackingNumber` treated as waybill number.<br>**2**: Query by customer order number; `trackingNumber` treated as order number. |
| 3 | trackingNumber  | List\<String>     | Yes      | —        | Tracking number(s):<br>If `trackingType = 1`, this is the SF waybill number.<br>If `trackingType = 2`, this is the customer order number. |
| 4 | methodType      | Number(1)         | No       | 1        | Route query type:<br>**1**: Standard route query<br>**2**: Customized route query |
| 5 | referenceNumber | String(4000)      | No       | —        | Reference code (currently for Amazon customers; provided by the customer). |
| 6 | checkPhoneNo    | String(30)        | No       | —        | Phone number verification (last 4 digits of sender/receiver phone number). |

##### Example

```json
{
	"language": "zh-CN",
	"trackingType": "1",
	"trackingNumber": ["444003077898", "441003077850"],
	"methodType": "1"
}
```

---

### Response

#### Global Response Parameters

| # | Field Name | Type   | Required | Default | Description |
|---|------------|---------|----------|----------|-------------|
| 1 | success    | String  | Yes      | —        | `true` = request succeeded, `false` = request failed |
| 2 | errorCode  | String  | Yes      | —        | Error code; `S0000` means success |
| 3 | errorMsg   | String  | Yes      | —        | Error description |
| 4 | msgData    | String  | Yes      | —        | Detailed returned data |

#### `<msgData>` Response Parameters

`<msgData>` contains the detailed business data returned by the API.

| # | Field Name  | Type | Required | Description |
|---|-------------|------|----------|-------------|
| 1 | routeResps  | List | Yes      | List of routing details corresponding to each SF waybill number |

#### Element `<Response>` — `QuerySFRouteResponse/msgData/routeResps`

`routeResps` represents the list of routing response elements returned by the API.

| # | Field Name | Type   | Required | Description |
|---|------------|--------|----------|-------------|
| 1 | mailNo     | String | Yes      | SF waybill number |
| 2 | routes     | List   | Yes      | List of routing information |

#### Element `<Response>` — `QuerySFRouteResponse/msgData/routeResps/routes`

`routes` represents the list of routing records for a specific SF waybill number.

| # | Field Name            | Type          | Required | Description |
|---|-----------------------|---------------|----------|-------------|
| 1 | acceptTime            | Date          | Yes      | Time when the routing event occurred. Format: `YYYY-MM-DD HH24:MM:SS` (e.g., `2012-07-30 09:30:00`). |
| 2 | acceptAddress         | String(100)   | No       | Location where the routing event occurred. |
| 3 | remark                | String(150)   | Yes       | Detailed description of the routing event. |
| 4 | opCode                | String(20)    | Yes      | Operation code for the routing event. |
| 5 | firstStatusCode       | String(20)    | No       | Primary status code. |
| 6 | firstStatusName       | String(20)    | No       | Primary status name. |
| 7 | secondaryStatusCode   | String(20)    | Yes      | Secondary status code. |
| 8 | secondaryStatusName   | String(20)    | Yes      | Secondary status name. |

##### Success Response Example

```json
{
    "apiResponseID": "000173271968963FA47C03E68000103F",
    "apiErrorMsg": "",
    "apiResultCode": "A1000",
    "apiResultData": "{\"success\":true,\"errorCode\":\"S0000\",\"errorMsg\":null,\"msgData\":{\"routeResps\":[{\"mailNo\":\"SF1011603494291\",\"routes\":[{\"acceptAddress\":\"深圳市\",\"acceptTime\":\"2024-09-02 23:51:27\",\"remark\":\"顺丰合作点【名居广场驿站店】已代收\",\"secondaryStatusCode\":\"701\",\"firstStatusName\":\"待揽收\",\"firstStatusCode\":\"7\",\"secondaryStatusName\":\"待揽收\",\"opCode\":\"655\"},{\"acceptAddress\":\"深圳市\",\"acceptTime\":\"2024-09-03 07:59:07\",\"remark\":\"顺丰速运 已收取快件\",\"secondaryStatusCode\":\"101\",\"firstStatusName\":\"已揽收\",\"firstStatusCode\":\"1\",\"secondaryStatusName\":\"已揽收\",\"opCode\":\"54\"}]}]}}"
}
```

##### Failed Response Example

```json
{
    "succ": "fail"
}
```

---

## Error Codes

### Generic API Error Codes

| Code  | Description | Solution |
|-------|-------------|----------|
| **A1000** | Unified access platform verification successful; backend service called successfully.<br>Note:<br>This does *not* indicate that backend business processing succeeded. The actual business result must be checked in the `apiResultData` details in the response. | Indicates the API call was successful. |
| **A1001** | Required parameters cannot be empty. | Please check the following:<br>1. Required fields in the parameter list are missing.<br>2. Request header does not include `Content-type: application/x-www-form-urlencoded`.<br>3. Parameter keys contain extra spaces.<br>4. All parameters must be URL-encoded in the HTTP request.<br>5. `msgData` must be in JSON format.<br>6. The entire request must be submitted as a form (form-data / x-www-form-urlencoded). |
| **A1011** | OAuth2 authentication failed. | Shown when OAuth2 authentication is used.<br>Please check if the `accessToken` is older than 2 hours (tokens expire every 2 hours). Retrieve a new token using the OAuth2 authentication API. |
| **A1003** | Invalid IP. | The customer code (`partnerID`) is configured to validate IP. Remove the IP restriction or call the API from a bound IP. |
| **A1004** | No permission for the requested service. | Possible reasons:<br>1. The customer code (`partnerID`) has not been associated with this API in **Developer Integration → API List**.<br>2. API request environment mismatch — check the API status:<br>   a. **Testing** → use sandbox environment<br>   b. **Online** → use production environment<br>3. Backend configuration not yet active — wait 2 minutes and try again; if still failing, contact support. |
| **A1005** | Traffic controlled / rate limited. | Fengqiao is an API function debugging environment. All APIs are rate-limited. For each customer code and API:<br>1. Max 30 calls per second<br>2. Max 3000 calls per day<br>Please use it only for functional debugging; do not perform stress testing. |
| **A1006** | Invalid digital signature. | Please check:<br>1. `checkword` is configured correctly.<br>2. `verifyCode` and `msgDigest` are encrypted/signed correctly.<br>3. No special characters in parameters (e.g., `&`).<br>4. Overall request format is form-data.<br>5. For non-Java languages, special characters must be handled carefully; supported special characters include `"*"`, `" "` (space), `"-"`.<br>6. If digital signature is inconvenient, switch to OAuth2 token authentication. |
| **A1007** | Duplicate request. | Not used at access layer; mainly used for order-creation APIs. Do not reuse `orderId` in `msgData`. Modify it before calling again. |
| **A1008** | Data decryption failed. | Used in special scenarios. If encountered, contact support. |
| **A1009** | Target service exception or unreachable. | Downstream service failure. If encountered, contact support. |
| **A1010** | Sandbox test status. | This issue appears mainly for older customers. If encountered, contact support. |
| **A1099** | System exception. | Internal service error. If encountered, contact support. |

#### Business Error Codes

| # | errorCode | Description                     | Recommended Action |
|---|-----------|---------------------------------|--------------------|
| 9 | 6133      | Invalid route query type        | `method_type` must be 1 or 2 |
| 10 | 8013     | No tracking number provided     | `tracking_number` was not passed |
| 11 | 8003     | Number of tracking numbers exceeded limit | Maximum of 10 tracking numbers per request |