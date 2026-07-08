import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20241013120000 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      `create table if not exists "sfexpress_settings" ("id" text not null, "name" text not null, "value" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "sfexpress_settings_pkey" primary key ("id"));`
    )
    this.addSql(
      `create index if not exists "idx_name" on "sfexpress_settings" ("name") where name is not null;`
    )
    this.addSql(
      `create index if not exists "idx_deleted_at" on "sfexpress_settings" ("deleted_at") where deleted_at is not null;`
    )
    this.addSql(
      `create unique index if not exists "idx_name_unique" on "sfexpress_settings" (name) where deleted_at is null;`
    )
  }

  async down(): Promise<void> {
    this.addSql(`drop table if exists "sfexpress_settings" cascade;`)
  }
}
