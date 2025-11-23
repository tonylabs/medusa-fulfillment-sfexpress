# EXP_RECE_PSDS_PRODUCT_RECOMMEND

## API Description

This API provides product recommendation queries based on shipment information.

---

## API Definition

### Common Parameters

| Name                   | Value                                          |
|------------------------|------------------------------------------------|
| API Service Code       | `EXP_RECE_PSDS_PRODUCT_RECOMMEND`             |
| Production Environment | https://bspgw.sf-express.com/std/service      |
| Hong Kong Environment  | https://sfapi-hk.sf-express.com/std/service   |
| Sandbox Environment    | https://sfapi-sbox.sf-express.com/std/service |
| Batch Transaction      | Not supported                                  |
| Interface Type         | Access                                         |
| Message Format         | JSON                                           |

---

### Notes

1. **HTTP** is used as the communication protocol.
2. **POST** must be used, and the request header must include `"Content-type": "application/x-www-form-urlencoded"` with **UTF-8** encoding.
3. All parameters must be transmitted using **HTTP URL encoding**.
4. Business data must be placed inside the `msgData` field as a **string**.

---

## Request Parameters (`msgData`)

| # | Field Name              | Parameter Name              | Required | Type    | Notes |
|---|-------------------------|-----------------------------|----------|---------|-------|
| 1 | traceId                 | Trace ID                    | No       | String  | Used for data tracking; must be unique. Recommended: UUID or CX member ID. |
| 2 | waybillNo               | Order No. / Waybill No.     | No       | String  | Example: `SF955536546` |
| 3 | srcProvince             | Sender Province             | Yes      | String  | Example: Guangdong Province |
| 4 | srcCity                 | Sender City                 | Yes      | String  | Example: Shenzhen City |
| 5 | srcCounty               | Sender District             | No       | String  | Example: Nanshan District |
| 6 | destProvince            | Receiver Province           | Yes      | String  | Example: Guangdong Province |
| 7 | destCity                | Receiver City               | Yes      | String  | Example: Shenzhen City |
| 8 | destCounty              | Receiver District           | No       | String  | Example: Nanshan District |
| 9 | sendTime                | Shipping / Pickup Time      | Yes      | String  | Format: `yyyy-MM-dd HH:mm:ss` |
| 10 | orderTime              | Order Time                  | No       | String  | Format: `yyyy-MM-dd HH:mm:ss`; defaults to system time. |
| 11 | weight                 | Weight                      | Yes      | Double  | Example: `3.5` (unit: kg) |
| 12 | length                 | Length                      | No       | Double  | Example: `74` (unit: cm) |
| 13 | width                  | Width                       | No       | Double  | Example: `20.5` (unit: cm) |
| 14 | height                 | Height                      | No       | Double  | Example: `3.5` (unit: cm) |
| 15 | commodityNameList      | Commodity Name List         | No       | List    | Multiple values supported: e.g., `[Seafood, Fruits]` |
| 16 | paymentTerms           | Payment Method              | Yes      | String  | 1: Sender Pay; 2: Receiver Pay; 3: Sender Third-Party; 4: Receiver Third-Party |
| 17 | monthlyCard            | Monthly Account No.         | No       | String  | Example: `7551234567` |
| 18 | totalNum               | Total Package Count         | No       | Integer | Example: `200` |
| 19 | phoneNumber            | Phone Number                | No       | String  | For Sender Pay or Sender Third-Party: sender’s phone; for Receiver Pay: receiver’s phone. |
| 20 | srcAddress             | Sender Full Address         | Yes      | String  | Detailed pickup address. |
| 21 | destAddress            | Receiver Full Address       | Yes      | String  | Detailed delivery address. |
| 22 | importDeclarationMethod | Import Declaration Method  | No       | String  | International only. Codes: 1 Simple; 2 Formal; 3 Sea; 4 Personal; 5 Sale; 6 Sample; 7 Cross-border Direct; 8 Cross-border Bonded; 9 Luggage; 10 Self-Clearance |
| 23 | exportDeclarationMethod | Export Declaration Method  | No       | String  | Same code list as import declaration. |
| 24 | declaredValue          | Declared Value              | No       | Double  | Declared shipment value. |
| 25 | declaredCurrency       | Declared Currency           | No       | String  | Currency for declared value. |