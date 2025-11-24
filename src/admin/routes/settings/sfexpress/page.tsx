import { defineRouteConfig } from "@medusajs/admin-sdk"
import { TruckFast } from "@medusajs/icons"
import { Button, Container, Heading, Checkbox, Select, Text, toast, Toaster } from "@medusajs/ui"
import { FormEvent, useEffect, useState } from "react"

type RegionCountry = {
  id: string
  iso_2: string
  iso_3?: string
  num_code?: number
  name?: string
  display_name?: string
}

const SettingsPage = () => {
  const [transportMode, setTransportMode] = useState<string>("3")
  const [autoLoad, setAutoLoad] = useState<boolean>(false)
  const [language, setLanguage] = useState<string>("en")
  const [languageAutoLoad, setLanguageAutoLoad] = useState<boolean>(false)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [sourceCountryCode, setSourceCountryCode] = useState<string>("")
  const [countryOptions, setCountryOptions] = useState<{ code: string; name?: string }[]>([])
  const [sourceCountryAutoLoad, setSourceCountryAutoLoad] = useState<boolean>(false)

  useEffect(() => {
    loadTransportMode()
    loadLanguage()
    loadCountries()
    loadSourceCountry()
  }, [])

  const loadTransportMode = async () => {
    try {
      const response = await fetch(`/admin/sfexpress/settings?name=transport_mode`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      })
      if (response.ok) {
        const data = await response.json()
        if (data?.value) {
          setTransportMode(String(data.value))
        }
        if (typeof data?.auto_load === "boolean") {
          setAutoLoad(data.auto_load)
        }
      }
    } catch {}
  }

  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSettingsSaving(true)
    try {
      const resp = await fetch(`/admin/sfexpress/settings`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [
            { name: "transport_mode", value: transportMode, auto_load: autoLoad },
            { name: "language", value: language, auto_load: languageAutoLoad },
            { name: "source_country_code", value: sourceCountryCode, auto_load: sourceCountryAutoLoad },
          ],
        }),
      })
      if (!resp.ok) {
        const details = await resp.text()
        throw new Error(`Failed to save settings (${resp.status}): ${details}`)
      }

      toast("Settings saved")
    } catch (err) {
      toast(
        `Save failed: ${((err as Error).message ?? "Failed to save settings.")}`
      )
    } finally {
      setSettingsSaving(false)
    }
  }

  const loadLanguage = async () => {
    try {
      const response = await fetch(`/admin/sfexpress/settings?name=language`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      })
      if (response.ok) {
        const data = await response.json()
        if (typeof data?.value === "string") {
          setLanguage(data.value)
        }
        if (typeof data?.auto_load === "boolean") {
          setLanguageAutoLoad(data.auto_load)
        }
      }
    } catch {}
  }

  const loadSourceCountry = async () => {
    try {
      const response = await fetch(`/admin/sfexpress/settings?name=source_country_code`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      })
      if (response.ok) {
        const data = await response.json()
        if (typeof data?.value === "string") {
          setSourceCountryCode(data.value)
        }
        if (typeof data?.auto_load === "boolean") {
          setSourceCountryAutoLoad(data.auto_load)
        }
      }
    } catch {}
  }

  const loadCountries = async () => {
    try {
      const response = await fetch(`/admin/regions?limit=10`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      })
      if (!response.ok) return
      const payload = await response.json()
      const regions: { countries?: RegionCountry[] }[] = payload?.regions ?? []
      const map: Record<string, { code: string; name?: string }> = {}
      for (const region of regions) {
        for (const c of region.countries ?? []) {
          const code = c.iso_2?.toUpperCase()
          if (!code) continue
          if (!map[code]) {
            map[code] = { code, name: c.display_name || c.name }
          }
        }
      }
      const options = Object.values(map).sort((a, b) => {
        const an = (a.name || a.code).toLowerCase()
        const bn = (b.name || b.code).toLowerCase()
        return an < bn ? -1 : an > bn ? 1 : 0
      })
      setCountryOptions(options)
      if (!sourceCountryCode && options.length) {
        setSourceCountryCode(options[0].code)
      }
    } catch {}
  }

  return (
    <>
      <Toaster />
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="space-y-1">
            <Heading level="h2">SF Express Settings</Heading>
            <Text className="text-ui-fg-subtle">
              Manage defaults for the SF Express fulfillment provider.
            </Text>
          </div>
        </div>

        <form className="space-y-6 px-6 py-4" onSubmit={saveSettings} noValidate>
          <div className="flex flex-col gap-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col space-y-2">
                <Heading level="h3">Transport Mode</Heading>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Select value={transportMode} onValueChange={setTransportMode}>
                      <Select.Trigger className="w-full">
                        <Select.Value placeholder="Select mode" />
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Item value="1">All</Select.Item>
                        <Select.Item value="2">International Express Courier</Select.Item>
                        <Select.Item value="3">International Parcel</Select.Item>
                        <Select.Item value="4">Dedicated Line</Select.Item>
                        <Select.Item value="5">Unified Postal-Express Service</Select.Item>
                        <Select.Item value="6">Others</Select.Item>
                      </Select.Content>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={autoLoad} onCheckedChange={(v) => setAutoLoad(Boolean(v))} />
                    <Text>Auto Load</Text>
                  </div>
                </div>
              </div>
              <div className="flex flex-col space-y-2">
                <Heading level="h3">Language</Heading>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Select value={language} onValueChange={setLanguage}>
                      <Select.Trigger className="w-full">
                        <Select.Value placeholder="Select language" />
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Item value="cn">CN</Select.Item>
                        <Select.Item value="en">EN</Select.Item>
                      </Select.Content>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={languageAutoLoad}
                      onCheckedChange={(v) => setLanguageAutoLoad(Boolean(v))}
                    />
                    <Text>Auto Load</Text>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col space-y-2">
                <Heading level="h3">Source Country Code</Heading>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Select value={sourceCountryCode} onValueChange={setSourceCountryCode}>
                      <Select.Trigger className="w-full">
                        <Select.Value placeholder="Select country" />
                      </Select.Trigger>
                      <Select.Content>
                        {countryOptions.map((opt) => (
                          <Select.Item key={opt.code} value={opt.code}>
                            {opt.code}
                            {opt.name ? ` — ${opt.name}` : ""}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={sourceCountryAutoLoad}
                      onCheckedChange={(v) => setSourceCountryAutoLoad(Boolean(v))}
                    />
                    <Text>Auto Load</Text>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant="primary" disabled={settingsSaving} isLoading={settingsSaving}>
              Save
            </Button>
          </div>
        </form>
      </Container>
    </>
  )
}

export const config = defineRouteConfig({
  label: "SF Express Settings",
  icon: TruckFast,
})

export default SettingsPage

export const handle = {
  breadcrumb: () => "SF Express Settings",
}
