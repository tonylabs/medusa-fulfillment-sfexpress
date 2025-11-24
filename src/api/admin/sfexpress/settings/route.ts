import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

type SettingsItemPayload = {
  name: string
  value: string | number
}

type SettingsPayload = {
  items?: SettingsItemPayload[]
  name?: string
  transport_mode?: string | number
  value?: string | number
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const name = (req.query?.name as string) || "transport_mode"
  const sfexpress = req.scope.resolve("sfexpress") as any
  const settings = await sfexpress.listSettings({ name: [name] })
  const setting = settings?.[0]

  if (!setting) {
    return res.status(404).json({ name, value: null })
  }

  return res.status(200).json(setting)
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const sfexpress = req.scope.resolve("sfexpress") as any
  const body = (req.body ?? {}) as SettingsPayload

  if (Array.isArray(body.items) && body.items.length) {
    const results: any[] = []
    for (const item of body.items) {
      const name = item.name
      const value = String(item.value)
      const updated = await sfexpress.updateSettings({
        selector: { name },
        data: { value },
      })

      if (!updated?.length) {
        const created = await sfexpress.createSettings([{ name, value }])
        results.push(created?.[0] ?? null)
      } else {
        results.push(updated[0])
      }
    }
    return res.status(200).json(results)
  }

  const raw = body.transport_mode ?? body.value
  if (raw === undefined || raw === null || raw === "") {
    return res.status(400).json({ message: "transport_mode is required" })
  }

  const name = typeof body.name === "string" && body.name ? body.name : "transport_mode"
  const value = String(raw)
  const updated = await sfexpress.updateSettings({
    selector: { name },
    data: { value },
  })

  if (!updated?.length) {
    const created = await sfexpress.createSettings([{ name, value }])
    return res.status(201).json(created?.[0] ?? null)
  }

  return res.status(200).json(updated[0])
}