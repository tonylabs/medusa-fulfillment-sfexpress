import { model } from "@medusajs/framework/utils"

const Settings = model.define(
  { name: "sfexpress_settings", tableName: "sfexpress_settings" },
  {
    id: model.id().primaryKey(),
    name: model.text(),
    value: model.text()
  }
)

export default Settings
