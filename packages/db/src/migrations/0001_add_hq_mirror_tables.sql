CREATE TABLE "hq_additional_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"external_charge_id" text NOT NULL,
	"name" text,
	"description" text,
	"charge_type" text,
	"amount" numeric(10, 2),
	"taxable" boolean,
	"active" boolean,
	"raw" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hq_additional_charges_account_external_id" UNIQUE("integration_account_id","external_charge_id")
);
--> statement-breakpoint
CREATE TABLE "hq_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"external_adjustment_id" text NOT NULL,
	"reservation_external_id" text,
	"adjustment_type" text,
	"description" text,
	"amount" numeric(10, 2),
	"created_at_hq" timestamp with time zone,
	"raw" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hq_adjustments_account_external_id" UNIQUE("integration_account_id","external_adjustment_id")
);
--> statement-breakpoint
CREATE TABLE "hq_blocked_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"external_blocked_id" text NOT NULL,
	"vehicle_external_id" text,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"reason" text,
	"raw" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hq_blocked_periods_account_external_id" UNIQUE("integration_account_id","external_blocked_id")
);
--> statement-breakpoint
CREATE TABLE "hq_branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"external_branch_id" text NOT NULL,
	"name" text,
	"description" text,
	"active" boolean,
	"raw" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hq_branches_account_external_id" UNIQUE("integration_account_id","external_branch_id")
);
--> statement-breakpoint
CREATE TABLE "hq_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"external_comment_id" text NOT NULL,
	"item_type" text,
	"item_external_id" text,
	"body" text,
	"author_name" text,
	"created_at_hq" timestamp with time zone,
	"raw" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hq_comments_account_external_id" UNIQUE("integration_account_id","external_comment_id")
);
--> statement-breakpoint
CREATE TABLE "hq_custom_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"external_field_id" text NOT NULL,
	"name" text,
	"field_type" text,
	"item_type" text,
	"required" boolean,
	"options" jsonb,
	"raw" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hq_custom_fields_account_external_id" UNIQUE("integration_account_id","external_field_id")
);
--> statement-breakpoint
CREATE TABLE "hq_damages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"external_damage_id" text NOT NULL,
	"vehicle_external_id" text,
	"reservation_external_id" text,
	"damage_type" text,
	"description" text,
	"location_on_vehicle" text,
	"severity" text,
	"repair_cost" numeric(10, 2),
	"reported_at" timestamp with time zone,
	"repaired_at" timestamp with time zone,
	"raw" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hq_damages_account_external_id" UNIQUE("integration_account_id","external_damage_id")
);
--> statement-breakpoint
CREATE TABLE "hq_email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"external_template_id" text NOT NULL,
	"name" text,
	"subject" text,
	"body_html" text,
	"trigger_event" text,
	"active" boolean,
	"raw" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hq_email_templates_account_external_id" UNIQUE("integration_account_id","external_template_id")
);
--> statement-breakpoint
CREATE TABLE "hq_extensions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"external_extension_id" text NOT NULL,
	"reservation_external_id" text,
	"original_return_date" timestamp with time zone,
	"new_return_date" timestamp with time zone,
	"additional_charges" numeric(10, 2),
	"created_at_hq" timestamp with time zone,
	"raw" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hq_extensions_account_external_id" UNIQUE("integration_account_id","external_extension_id")
);
--> statement-breakpoint
CREATE TABLE "hq_external_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"external_charge_id" text NOT NULL,
	"reservation_external_id" text,
	"charge_type" text,
	"description" text,
	"amount" numeric(10, 2),
	"occurred_at" timestamp with time zone,
	"raw" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hq_external_charges_account_external_id" UNIQUE("integration_account_id","external_charge_id")
);
--> statement-breakpoint
CREATE TABLE "hq_fines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"external_fine_id" text NOT NULL,
	"vehicle_external_id" text,
	"reservation_external_id" text,
	"customer_external_id" text,
	"fine_type" text,
	"amount" numeric(10, 2),
	"description" text,
	"violation_date" timestamp with time zone,
	"due_date" timestamp with time zone,
	"status" text,
	"raw" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hq_fines_account_external_id" UNIQUE("integration_account_id","external_fine_id")
);
--> statement-breakpoint
CREATE TABLE "hq_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"external_location_id" text NOT NULL,
	"name" text,
	"address" text,
	"city" text,
	"state" text,
	"zip" text,
	"phone" text,
	"email" text,
	"latitude" numeric(10, 8),
	"longitude" numeric(11, 8),
	"active" boolean,
	"raw" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hq_locations_account_external_id" UNIQUE("integration_account_id","external_location_id")
);
--> statement-breakpoint
CREATE TABLE "hq_payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"external_method_id" text NOT NULL,
	"name" text,
	"method_type" text,
	"active" boolean,
	"raw" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hq_payment_methods_account_external_id" UNIQUE("integration_account_id","external_method_id")
);
--> statement-breakpoint
CREATE TABLE "hq_rate_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"external_rate_type_id" text NOT NULL,
	"name" text,
	"description" text,
	"raw" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hq_rate_types_account_external_id" UNIQUE("integration_account_id","external_rate_type_id")
);
--> statement-breakpoint
CREATE TABLE "hq_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"external_rate_id" text NOT NULL,
	"name" text,
	"vehicle_class_id" text,
	"rate_type_id" text,
	"daily_rate" numeric(10, 2),
	"weekly_rate" numeric(10, 2),
	"monthly_rate" numeric(10, 2),
	"mileage_limit" integer,
	"extra_mileage_rate" numeric(10, 2),
	"active" boolean,
	"raw" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hq_rates_account_external_id" UNIQUE("integration_account_id","external_rate_id")
);
--> statement-breakpoint
CREATE TABLE "hq_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"external_refund_id" text NOT NULL,
	"reservation_external_id" text,
	"payment_external_id" text,
	"amount" numeric(10, 2),
	"reason" text,
	"status" text,
	"occurred_at" timestamp with time zone,
	"raw" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hq_refunds_account_external_id" UNIQUE("integration_account_id","external_refund_id")
);
--> statement-breakpoint
CREATE TABLE "hq_repair_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"external_repair_id" text NOT NULL,
	"vehicle_external_id" text,
	"status" text,
	"description" text,
	"cost" numeric(10, 2),
	"vendor" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"raw" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hq_repair_orders_account_external_id" UNIQUE("integration_account_id","external_repair_id")
);
--> statement-breakpoint
CREATE TABLE "hq_security_deposits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"external_deposit_id" text NOT NULL,
	"reservation_external_id" text,
	"amount" numeric(10, 2),
	"status" text,
	"held_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"raw" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hq_security_deposits_account_external_id" UNIQUE("integration_account_id","external_deposit_id")
);
--> statement-breakpoint
CREATE TABLE "hq_vehicle_classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"external_class_id" text NOT NULL,
	"name" text,
	"description" text,
	"sort_order" integer,
	"image_url" text,
	"raw" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hq_vehicle_classes_account_external_id" UNIQUE("integration_account_id","external_class_id")
);
--> statement-breakpoint
CREATE TABLE "hq_vehicle_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"external_model_id" text NOT NULL,
	"make" text,
	"model" text,
	"year" integer,
	"vehicle_class_id" text,
	"raw" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hq_vehicle_models_account_external_id" UNIQUE("integration_account_id","external_model_id")
);
--> statement-breakpoint
CREATE TABLE "hq_vehicle_replacements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"external_replacement_id" text NOT NULL,
	"reservation_external_id" text,
	"original_vehicle_external_id" text,
	"replacement_vehicle_external_id" text,
	"reason" text,
	"replaced_at" timestamp with time zone,
	"raw" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hq_vehicle_replacements_account_external_id" UNIQUE("integration_account_id","external_replacement_id")
);
--> statement-breakpoint
ALTER TABLE "hq_additional_charges" ADD CONSTRAINT "hq_additional_charges_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_adjustments" ADD CONSTRAINT "hq_adjustments_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_blocked_periods" ADD CONSTRAINT "hq_blocked_periods_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_branches" ADD CONSTRAINT "hq_branches_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_comments" ADD CONSTRAINT "hq_comments_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_custom_fields" ADD CONSTRAINT "hq_custom_fields_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_damages" ADD CONSTRAINT "hq_damages_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_email_templates" ADD CONSTRAINT "hq_email_templates_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_extensions" ADD CONSTRAINT "hq_extensions_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_external_charges" ADD CONSTRAINT "hq_external_charges_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_fines" ADD CONSTRAINT "hq_fines_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_locations" ADD CONSTRAINT "hq_locations_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_payment_methods" ADD CONSTRAINT "hq_payment_methods_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_rate_types" ADD CONSTRAINT "hq_rate_types_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_rates" ADD CONSTRAINT "hq_rates_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_refunds" ADD CONSTRAINT "hq_refunds_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_repair_orders" ADD CONSTRAINT "hq_repair_orders_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_security_deposits" ADD CONSTRAINT "hq_security_deposits_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_vehicle_classes" ADD CONSTRAINT "hq_vehicle_classes_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_vehicle_models" ADD CONSTRAINT "hq_vehicle_models_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_vehicle_replacements" ADD CONSTRAINT "hq_vehicle_replacements_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hq_additional_charges_integration_account_id_idx" ON "hq_additional_charges" USING btree ("integration_account_id");--> statement-breakpoint
CREATE INDEX "hq_adjustments_integration_account_id_idx" ON "hq_adjustments" USING btree ("integration_account_id");--> statement-breakpoint
CREATE INDEX "hq_adjustments_reservation_external_id_idx" ON "hq_adjustments" USING btree ("reservation_external_id");--> statement-breakpoint
CREATE INDEX "hq_blocked_periods_integration_account_id_idx" ON "hq_blocked_periods" USING btree ("integration_account_id");--> statement-breakpoint
CREATE INDEX "hq_blocked_periods_vehicle_external_id_idx" ON "hq_blocked_periods" USING btree ("vehicle_external_id");--> statement-breakpoint
CREATE INDEX "hq_branches_integration_account_id_idx" ON "hq_branches" USING btree ("integration_account_id");--> statement-breakpoint
CREATE INDEX "hq_comments_integration_account_id_idx" ON "hq_comments" USING btree ("integration_account_id");--> statement-breakpoint
CREATE INDEX "hq_comments_item_type_external_id_idx" ON "hq_comments" USING btree ("item_type","item_external_id");--> statement-breakpoint
CREATE INDEX "hq_custom_fields_integration_account_id_idx" ON "hq_custom_fields" USING btree ("integration_account_id");--> statement-breakpoint
CREATE INDEX "hq_damages_integration_account_id_idx" ON "hq_damages" USING btree ("integration_account_id");--> statement-breakpoint
CREATE INDEX "hq_damages_vehicle_external_id_idx" ON "hq_damages" USING btree ("vehicle_external_id");--> statement-breakpoint
CREATE INDEX "hq_email_templates_integration_account_id_idx" ON "hq_email_templates" USING btree ("integration_account_id");--> statement-breakpoint
CREATE INDEX "hq_extensions_integration_account_id_idx" ON "hq_extensions" USING btree ("integration_account_id");--> statement-breakpoint
CREATE INDEX "hq_extensions_reservation_external_id_idx" ON "hq_extensions" USING btree ("reservation_external_id");--> statement-breakpoint
CREATE INDEX "hq_external_charges_integration_account_id_idx" ON "hq_external_charges" USING btree ("integration_account_id");--> statement-breakpoint
CREATE INDEX "hq_external_charges_reservation_external_id_idx" ON "hq_external_charges" USING btree ("reservation_external_id");--> statement-breakpoint
CREATE INDEX "hq_fines_integration_account_id_idx" ON "hq_fines" USING btree ("integration_account_id");--> statement-breakpoint
CREATE INDEX "hq_fines_vehicle_external_id_idx" ON "hq_fines" USING btree ("vehicle_external_id");--> statement-breakpoint
CREATE INDEX "hq_locations_integration_account_id_idx" ON "hq_locations" USING btree ("integration_account_id");--> statement-breakpoint
CREATE INDEX "hq_payment_methods_integration_account_id_idx" ON "hq_payment_methods" USING btree ("integration_account_id");--> statement-breakpoint
CREATE INDEX "hq_rate_types_integration_account_id_idx" ON "hq_rate_types" USING btree ("integration_account_id");--> statement-breakpoint
CREATE INDEX "hq_rates_integration_account_id_idx" ON "hq_rates" USING btree ("integration_account_id");--> statement-breakpoint
CREATE INDEX "hq_rates_vehicle_class_id_idx" ON "hq_rates" USING btree ("vehicle_class_id");--> statement-breakpoint
CREATE INDEX "hq_refunds_integration_account_id_idx" ON "hq_refunds" USING btree ("integration_account_id");--> statement-breakpoint
CREATE INDEX "hq_refunds_reservation_external_id_idx" ON "hq_refunds" USING btree ("reservation_external_id");--> statement-breakpoint
CREATE INDEX "hq_repair_orders_integration_account_id_idx" ON "hq_repair_orders" USING btree ("integration_account_id");--> statement-breakpoint
CREATE INDEX "hq_repair_orders_vehicle_external_id_idx" ON "hq_repair_orders" USING btree ("vehicle_external_id");--> statement-breakpoint
CREATE INDEX "hq_security_deposits_integration_account_id_idx" ON "hq_security_deposits" USING btree ("integration_account_id");--> statement-breakpoint
CREATE INDEX "hq_security_deposits_reservation_external_id_idx" ON "hq_security_deposits" USING btree ("reservation_external_id");--> statement-breakpoint
CREATE INDEX "hq_vehicle_classes_integration_account_id_idx" ON "hq_vehicle_classes" USING btree ("integration_account_id");--> statement-breakpoint
CREATE INDEX "hq_vehicle_models_integration_account_id_idx" ON "hq_vehicle_models" USING btree ("integration_account_id");--> statement-breakpoint
CREATE INDEX "hq_vehicle_replacements_integration_account_id_idx" ON "hq_vehicle_replacements" USING btree ("integration_account_id");--> statement-breakpoint
CREATE INDEX "hq_vehicle_replacements_reservation_external_id_idx" ON "hq_vehicle_replacements" USING btree ("reservation_external_id");