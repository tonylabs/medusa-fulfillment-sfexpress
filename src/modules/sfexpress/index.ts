import SFExpressModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const SFEXPRESS_MODULE = "sfexpress"

export default Module(SFEXPRESS_MODULE, {
  service: SFExpressModuleService,
})