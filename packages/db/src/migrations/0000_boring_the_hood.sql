CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"details" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text,
	"ip_address" text,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"name" text NOT NULL,
	"role" text DEFAULT 'staff' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_tenant_email" UNIQUE("tenant_id","email")
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source" text NOT NULL,
	"source_id" text,
	"source_entity_type" text,
	"source_entity_id" text,
	"original_filename" text NOT NULL,
	"mime_type" text,
	"size_bytes" bigint,
	"s3_bucket" text NOT NULL,
	"s3_key" text NOT NULL,
	"checksum" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"credentials" jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_sync_status" text,
	"last_sync_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_cursors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"cursor_value" text NOT NULL,
	"cursor_type" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"sync_type" text NOT NULL,
	"entity_type" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"records_processed" integer DEFAULT 0,
	"records_created" integer DEFAULT 0,
	"records_updated" integer DEFAULT 0,
	"records_deleted" integer DEFAULT 0,
	"records_errored" integer DEFAULT 0,
	"error_message" text,
	"error_details" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monday_activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"board_id" uuid,
	"item_id" uuid,
	"external_id" text NOT NULL,
	"external_board_id" text,
	"external_item_id" text,
	"event" text NOT NULL,
	"data" jsonb,
	"user_id" text,
	"created_at_external" timestamp with time zone,
	"raw" jsonb NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "monday_activity_logs_account_external_id" UNIQUE("integration_account_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "monday_boards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"workspace_id" uuid,
	"external_id" text NOT NULL,
	"external_workspace_id" text,
	"name" text NOT NULL,
	"description" text,
	"board_kind" text,
	"state" text,
	"items_count" integer DEFAULT 0,
	"in_scope" boolean DEFAULT false NOT NULL,
	"raw" jsonb NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_hash" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "monday_boards_account_external_id" UNIQUE("integration_account_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "monday_columns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"board_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"external_board_id" text NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"settings" jsonb,
	"width" integer,
	"position" integer,
	"raw" jsonb NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_hash" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "monday_columns_board_external_id" UNIQUE("board_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "monday_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"item_id" uuid,
	"update_id" uuid,
	"external_id" text NOT NULL,
	"external_item_id" text,
	"external_update_id" text,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"url_expires_at" timestamp with time zone,
	"file_extension" text,
	"file_size" bigint,
	"is_image" boolean DEFAULT false,
	"s3_downloaded" boolean DEFAULT false,
	"s3_bucket" text,
	"s3_key" text,
	"downloaded_at" timestamp with time zone,
	"raw" jsonb NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_hash" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "monday_files_account_external_id" UNIQUE("integration_account_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "monday_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"board_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"external_board_id" text NOT NULL,
	"title" text NOT NULL,
	"color" text,
	"position" integer,
	"is_archived" boolean DEFAULT false,
	"is_deleted" boolean DEFAULT false,
	"raw" jsonb NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_hash" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "monday_groups_board_external_id" UNIQUE("board_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "monday_item_column_value_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"column_id" uuid NOT NULL,
	"external_item_id" text NOT NULL,
	"external_column_id" text NOT NULL,
	"value_json" jsonb,
	"text_value" text,
	"value_hash" text NOT NULL,
	"changed_at" timestamp with time zone NOT NULL,
	"detected_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monday_item_column_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"column_id" uuid NOT NULL,
	"external_item_id" text NOT NULL,
	"external_column_id" text NOT NULL,
	"value_json" jsonb,
	"text_value" text,
	"date_value" timestamp with time zone,
	"number_value" bigint,
	"value_hash" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "monday_item_column_values_item_column" UNIQUE("item_id","column_id")
);
--> statement-breakpoint
CREATE TABLE "monday_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"board_id" uuid NOT NULL,
	"group_id" uuid,
	"external_id" text NOT NULL,
	"external_board_id" text NOT NULL,
	"external_group_id" text,
	"name" text NOT NULL,
	"state" text,
	"created_at_external" timestamp with time zone,
	"updated_at_external" timestamp with time zone,
	"creator_id" text,
	"raw" jsonb NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_hash" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "monday_items_account_external_id" UNIQUE("integration_account_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "monday_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"update_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"external_update_id" text NOT NULL,
	"body" text,
	"text_body" text,
	"creator_id" text,
	"creator_name" text,
	"created_at_external" timestamp with time zone,
	"raw" jsonb NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_hash" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "monday_replies_account_external_id" UNIQUE("integration_account_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "monday_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"external_item_id" text NOT NULL,
	"body" text,
	"text_body" text,
	"creator_id" text,
	"creator_name" text,
	"created_at_external" timestamp with time zone,
	"updated_at_external" timestamp with time zone,
	"raw" jsonb NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_hash" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "monday_updates_account_external_id" UNIQUE("integration_account_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "monday_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"title" text,
	"birthday" text,
	"country_code" text,
	"location" text,
	"time_zone_identifier" text,
	"is_admin" boolean DEFAULT false,
	"is_guest" boolean DEFAULT false,
	"is_view_only" boolean DEFAULT false,
	"photo_url" text,
	"raw" jsonb NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_hash" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "monday_users_account_external_id" UNIQUE("integration_account_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "monday_workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" text,
	"description" text,
	"raw" jsonb NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_hash" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "monday_workspaces_account_external_id" UNIQUE("integration_account_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "hq_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"customer_id" uuid,
	"contract_id" uuid,
	"external_id" text NOT NULL,
	"external_customer_id" text,
	"external_contract_id" text,
	"amount" numeric(10, 2) NOT NULL,
	"charge_type" text,
	"description" text,
	"charge_date" timestamp with time zone,
	"status" text,
	"notes" text,
	"raw" jsonb NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_hash" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "hq_charges_account_external_id" UNIQUE("integration_account_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "hq_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"customer_id" uuid,
	"vehicle_id" uuid,
	"reservation_id" uuid,
	"external_id" text NOT NULL,
	"external_customer_id" text,
	"external_vehicle_id" text,
	"external_reservation_id" text,
	"contract_number" text,
	"status" text,
	"pickup_date" timestamp with time zone,
	"expected_return_date" timestamp with time zone,
	"actual_return_date" timestamp with time zone,
	"mileage_out" integer,
	"mileage_in" integer,
	"mileage_allowed" integer,
	"fuel_out" text,
	"fuel_in" text,
	"daily_rate" numeric(10, 2),
	"total_charges" numeric(10, 2),
	"total_payments" numeric(10, 2),
	"balance" numeric(10, 2),
	"notes" text,
	"raw" jsonb NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_hash" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "hq_contracts_account_external_id" UNIQUE("integration_account_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "hq_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"full_name" text,
	"email" text,
	"phone" text,
	"phone_normalized" text,
	"address" text,
	"city" text,
	"state" text,
	"zip_code" text,
	"country" text,
	"license_number" text,
	"license_state" text,
	"license_expiry" timestamp with time zone,
	"date_of_birth" timestamp with time zone,
	"company_name" text,
	"status" text,
	"customer_type" text,
	"notes" text,
	"raw" jsonb NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_hash" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "hq_customers_account_external_id" UNIQUE("integration_account_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "hq_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"customer_id" uuid,
	"contract_id" uuid,
	"vehicle_id" uuid,
	"external_id" text NOT NULL,
	"external_customer_id" text,
	"external_contract_id" text,
	"external_vehicle_id" text,
	"document_type" text,
	"filename" text,
	"mime_type" text,
	"url" text,
	"s3_downloaded" boolean DEFAULT false,
	"s3_bucket" text,
	"s3_key" text,
	"downloaded_at" timestamp with time zone,
	"ocr_text" text,
	"ocr_processed_at" timestamp with time zone,
	"raw" jsonb NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_hash" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "hq_documents_account_external_id" UNIQUE("integration_account_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "hq_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"customer_id" uuid,
	"contract_id" uuid,
	"external_id" text NOT NULL,
	"external_customer_id" text,
	"external_contract_id" text,
	"amount" numeric(10, 2) NOT NULL,
	"payment_type" text,
	"payment_date" timestamp with time zone,
	"reference_number" text,
	"card_last_4" text,
	"status" text,
	"notes" text,
	"raw" jsonb NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_hash" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "hq_payments_account_external_id" UNIQUE("integration_account_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "hq_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"customer_id" uuid,
	"vehicle_id" uuid,
	"external_id" text NOT NULL,
	"external_customer_id" text,
	"external_vehicle_id" text,
	"reservation_number" text,
	"status" text,
	"pickup_date" timestamp with time zone,
	"return_date" timestamp with time zone,
	"actual_pickup_date" timestamp with time zone,
	"actual_return_date" timestamp with time zone,
	"pickup_location" text,
	"return_location" text,
	"daily_rate" numeric(10, 2),
	"total_estimate" numeric(10, 2),
	"additional_driver" boolean DEFAULT false,
	"insurance_type" text,
	"notes" text,
	"raw" jsonb NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_hash" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "hq_reservations_account_external_id" UNIQUE("integration_account_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "hq_vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"vin" text,
	"license_plate" text,
	"unit_number" text,
	"year" integer,
	"make" text,
	"model" text,
	"trim" text,
	"color" text,
	"vehicle_type" text,
	"status" text,
	"availability" text,
	"current_mileage" integer,
	"fuel_level" text,
	"current_location" text,
	"daily_rate" numeric(10, 2),
	"weekly_rate" numeric(10, 2),
	"monthly_rate" numeric(10, 2),
	"notes" text,
	"raw" jsonb NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_hash" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "hq_vehicles_account_external_id" UNIQUE("integration_account_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "gmail_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"email_address" text NOT NULL,
	"display_name" text,
	"history_id" text,
	"last_full_sync_at" timestamp with time zone,
	"needs_full_resync" boolean DEFAULT false,
	"messages_total" integer DEFAULT 0,
	"threads_total" integer DEFAULT 0,
	"raw" jsonb NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gmail_accounts_integration_email" UNIQUE("integration_account_id","email_address")
);
--> statement-breakpoint
CREATE TABLE "gmail_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"gmail_account_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"external_message_id" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text,
	"size" bigint,
	"content_id" text,
	"is_inline" boolean DEFAULT false,
	"s3_downloaded" boolean DEFAULT false,
	"s3_bucket" text,
	"s3_key" text,
	"downloaded_at" timestamp with time zone,
	"raw" jsonb,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gmail_attachments_message_external_id" UNIQUE("message_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "gmail_labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"gmail_account_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text,
	"messages_total" integer DEFAULT 0,
	"messages_unread" integer DEFAULT 0,
	"threads_total" integer DEFAULT 0,
	"threads_unread" integer DEFAULT 0,
	"color" jsonb,
	"raw" jsonb NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_hash" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "gmail_labels_account_external_id" UNIQUE("gmail_account_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "gmail_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"gmail_account_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"external_thread_id" text NOT NULL,
	"history_id" text,
	"subject" text,
	"from_email" text,
	"from_name" text,
	"to_emails" jsonb DEFAULT '[]'::jsonb,
	"cc_emails" jsonb DEFAULT '[]'::jsonb,
	"bcc_emails" jsonb DEFAULT '[]'::jsonb,
	"reply_to" text,
	"message_id_header" text,
	"in_reply_to" text,
	"references" text,
	"snippet" text,
	"body_plain" text,
	"body_html" text,
	"internal_date" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"label_ids" jsonb DEFAULT '[]'::jsonb,
	"is_unread" boolean DEFAULT true,
	"is_starred" boolean DEFAULT false,
	"is_important" boolean DEFAULT false,
	"is_draft" boolean DEFAULT false,
	"is_sent" boolean DEFAULT false,
	"is_inbox" boolean DEFAULT false,
	"is_trash" boolean DEFAULT false,
	"is_spam" boolean DEFAULT false,
	"size_estimate" integer,
	"raw" jsonb NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_hash" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "gmail_messages_account_external_id" UNIQUE("gmail_account_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "gmail_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"gmail_account_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"history_id" text,
	"snippet" text,
	"subject" text,
	"participant_emails" jsonb DEFAULT '[]'::jsonb,
	"message_count" integer DEFAULT 0,
	"first_message_at" timestamp with time zone,
	"last_message_at" timestamp with time zone,
	"label_ids" jsonb DEFAULT '[]'::jsonb,
	"raw" jsonb NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_hash" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "gmail_threads_account_external_id" UNIQUE("gmail_account_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "spireon_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"name" text,
	"serial_number" text,
	"imei" text,
	"device_type" text,
	"vehicle_name" text,
	"vehicle_vin" text,
	"vehicle_license_plate" text,
	"vehicle_year" integer,
	"vehicle_make" text,
	"vehicle_model" text,
	"status" text,
	"is_online" boolean DEFAULT false,
	"last_communication" timestamp with time zone,
	"current_lat" double precision,
	"current_lng" double precision,
	"current_speed" numeric(6, 2),
	"current_heading" integer,
	"current_address" text,
	"current_location_at" timestamp with time zone,
	"current_odometer" integer,
	"current_battery_voltage" numeric(5, 2),
	"current_fuel_level" integer,
	"ignition_on" boolean DEFAULT false,
	"raw" jsonb NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_hash" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "spireon_devices_account_external_id" UNIQUE("integration_account_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "spireon_diagnostics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"external_id" text,
	"odometer" integer,
	"battery_voltage" numeric(5, 2),
	"fuel_level" integer,
	"engine_rpm" integer,
	"coolant_temp" integer,
	"dtc_codes" jsonb DEFAULT '[]'::jsonb,
	"check_engine_light" boolean DEFAULT false,
	"recorded_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now(),
	"raw" jsonb,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spireon_geofence_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"geofence_id" uuid,
	"external_id" text,
	"event_type" text NOT NULL,
	"geofence_name" text,
	"lat" double precision,
	"lng" double precision,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now(),
	"raw" jsonb,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spireon_geofences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"external_id" text,
	"name" text NOT NULL,
	"description" text,
	"geofence_type" text,
	"center_lat" double precision,
	"center_lng" double precision,
	"radius_meters" numeric(10, 2),
	"polygon" jsonb,
	"is_active" boolean DEFAULT true,
	"raw" jsonb,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_hash" text,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "spireon_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"external_id" text,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"altitude" numeric(8, 2),
	"accuracy" numeric(8, 2),
	"speed" numeric(6, 2),
	"heading" integer,
	"address" text,
	"city" text,
	"state" text,
	"zip_code" text,
	"event_type" text,
	"recorded_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now(),
	"raw" jsonb,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"phone_number" text NOT NULL,
	"phone_number_id" text,
	"display_name" text,
	"is_active" boolean DEFAULT true,
	"last_webhook_at" timestamp with time zone,
	"raw" jsonb,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_accounts_integration_phone" UNIQUE("integration_account_id","phone_number")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"whatsapp_account_id" uuid NOT NULL,
	"wa_id" text NOT NULL,
	"phone_number" text,
	"phone_number_normalized" text,
	"profile_name" text,
	"display_name" text,
	"notes" text,
	"message_count" bigint DEFAULT 0,
	"last_message_at" timestamp with time zone,
	"raw" jsonb,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_contacts_account_wa_id" UNIQUE("whatsapp_account_id","wa_id")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"media_type" text NOT NULL,
	"mime_type" text,
	"filename" text,
	"file_size" bigint,
	"sha256" text,
	"url" text,
	"url_expires_at" timestamp with time zone,
	"s3_downloaded" boolean DEFAULT false,
	"s3_bucket" text,
	"s3_key" text,
	"downloaded_at" timestamp with time zone,
	"raw" jsonb,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_media_message_external_id" UNIQUE("message_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"whatsapp_account_id" uuid NOT NULL,
	"contact_id" uuid,
	"external_id" text NOT NULL,
	"direction" text NOT NULL,
	"from_number" text,
	"to_number" text,
	"message_type" text NOT NULL,
	"text_body" text,
	"caption" text,
	"location_lat" text,
	"location_lng" text,
	"location_name" text,
	"location_address" text,
	"contact_vcard" text,
	"template_name" text,
	"template_language" text,
	"template_parameters" jsonb,
	"status" text,
	"status_updated_at" timestamp with time zone,
	"error_code" text,
	"error_message" text,
	"context_message_id" text,
	"is_forwarded" boolean DEFAULT false,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"raw" jsonb NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_hash" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_messages_account_external_id" UNIQUE("whatsapp_account_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"alert_type" text NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"title" text NOT NULL,
	"message" text,
	"data" jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"acknowledged_by" uuid,
	"acknowledged_at" timestamp with time zone,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "core_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"primary_email" text,
	"primary_phone" text,
	"first_name" text,
	"last_name" text,
	"full_name" text,
	"display_name" text,
	"company_name" text,
	"status" text DEFAULT 'active',
	"is_vip" boolean DEFAULT false,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"total_rentals" integer DEFAULT 0,
	"total_spent" numeric(12, 2) DEFAULT '0',
	"last_rental_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core_vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"vin" text,
	"license_plate" text,
	"unit_number" text,
	"year" integer,
	"make" text,
	"model" text,
	"trim" text,
	"color" text,
	"vehicle_type" text,
	"status" text DEFAULT 'available',
	"availability" text,
	"current_lat" numeric(10, 7),
	"current_lng" numeric(10, 7),
	"current_location_at" timestamp with time zone,
	"is_at_shop" boolean DEFAULT true,
	"current_mileage" integer,
	"mileage_updated_at" timestamp with time zone,
	"daily_rate" numeric(10, 2),
	"weekly_rate" numeric(10, 2),
	"monthly_rate" numeric(10, 2),
	"tags" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"primary_image_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "core_vehicles_tenant_vin" UNIQUE("tenant_id","vin")
);
--> statement-breakpoint
CREATE TABLE "external_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"source" text NOT NULL,
	"source_entity_type" text NOT NULL,
	"source_entity_id" uuid NOT NULL,
	"external_id" text,
	"confidence" text DEFAULT 'auto' NOT NULL,
	"confidence_score" integer,
	"matched_on" jsonb DEFAULT '[]'::jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "external_links_source_entity" UNIQUE("source","source_entity_type","source_entity_id")
);
--> statement-breakpoint
CREATE TABLE "identity_merges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"survivor_id" uuid NOT NULL,
	"merged_id" uuid NOT NULL,
	"merged_by" uuid,
	"merge_reason" text,
	"merged_snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timeline_event_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timeline_event_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"link_type" text DEFAULT 'related',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timeline_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"source" text NOT NULL,
	"source_entity_type" text,
	"source_entity_id" uuid,
	"external_id" text,
	"title" text,
	"summary" text,
	"content" text,
	"content_html" text,
	"metadata" jsonb,
	"actor_type" text,
	"actor_id" text,
	"actor_name" text,
	"actor_email" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"collapse_group_key" text,
	"is_collapsed" boolean DEFAULT false,
	"is_internal" boolean DEFAULT false,
	"is_pinned" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timeline_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"filters" jsonb NOT NULL,
	"display_options" jsonb,
	"is_shared" boolean DEFAULT false,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid,
	"title" text,
	"context" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"sources" jsonb,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"model" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"task_type" text NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"reasoning" text,
	"related_customer_id" uuid,
	"related_vehicle_id" uuid,
	"related_sources" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"acknowledged_by" uuid,
	"acknowledged_at" timestamp,
	"completed_at" timestamp,
	"dismissed_at" timestamp,
	"dismiss_reason" text,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "embedding_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "embedding_queue_source" UNIQUE("source_type","source_id")
);
--> statement-breakpoint
CREATE TABLE "embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid NOT NULL,
	"content" text NOT NULL,
	"content_hash" text NOT NULL,
	"embedding" text NOT NULL,
	"embedding_model" text NOT NULL,
	"embedding_dimensions" integer NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "embeddings_source" UNIQUE("source_type","source_id")
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_accounts" ADD CONSTRAINT "integration_accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_cursors" ADD CONSTRAINT "sync_cursors_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monday_activity_logs" ADD CONSTRAINT "monday_activity_logs_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monday_activity_logs" ADD CONSTRAINT "monday_activity_logs_board_id_monday_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."monday_boards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monday_activity_logs" ADD CONSTRAINT "monday_activity_logs_item_id_monday_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."monday_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monday_boards" ADD CONSTRAINT "monday_boards_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monday_boards" ADD CONSTRAINT "monday_boards_workspace_id_monday_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."monday_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monday_columns" ADD CONSTRAINT "monday_columns_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monday_columns" ADD CONSTRAINT "monday_columns_board_id_monday_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."monday_boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monday_files" ADD CONSTRAINT "monday_files_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monday_files" ADD CONSTRAINT "monday_files_item_id_monday_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."monday_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monday_files" ADD CONSTRAINT "monday_files_update_id_monday_updates_id_fk" FOREIGN KEY ("update_id") REFERENCES "public"."monday_updates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monday_groups" ADD CONSTRAINT "monday_groups_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monday_groups" ADD CONSTRAINT "monday_groups_board_id_monday_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."monday_boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monday_item_column_value_versions" ADD CONSTRAINT "monday_item_column_value_versions_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monday_item_column_value_versions" ADD CONSTRAINT "monday_item_column_value_versions_item_id_monday_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."monday_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monday_item_column_value_versions" ADD CONSTRAINT "monday_item_column_value_versions_column_id_monday_columns_id_fk" FOREIGN KEY ("column_id") REFERENCES "public"."monday_columns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monday_item_column_values" ADD CONSTRAINT "monday_item_column_values_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monday_item_column_values" ADD CONSTRAINT "monday_item_column_values_item_id_monday_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."monday_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monday_item_column_values" ADD CONSTRAINT "monday_item_column_values_column_id_monday_columns_id_fk" FOREIGN KEY ("column_id") REFERENCES "public"."monday_columns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monday_items" ADD CONSTRAINT "monday_items_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monday_items" ADD CONSTRAINT "monday_items_board_id_monday_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."monday_boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monday_items" ADD CONSTRAINT "monday_items_group_id_monday_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."monday_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monday_replies" ADD CONSTRAINT "monday_replies_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monday_replies" ADD CONSTRAINT "monday_replies_update_id_monday_updates_id_fk" FOREIGN KEY ("update_id") REFERENCES "public"."monday_updates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monday_updates" ADD CONSTRAINT "monday_updates_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monday_updates" ADD CONSTRAINT "monday_updates_item_id_monday_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."monday_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monday_users" ADD CONSTRAINT "monday_users_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monday_workspaces" ADD CONSTRAINT "monday_workspaces_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_charges" ADD CONSTRAINT "hq_charges_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_charges" ADD CONSTRAINT "hq_charges_customer_id_hq_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."hq_customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_charges" ADD CONSTRAINT "hq_charges_contract_id_hq_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."hq_contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_contracts" ADD CONSTRAINT "hq_contracts_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_contracts" ADD CONSTRAINT "hq_contracts_customer_id_hq_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."hq_customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_contracts" ADD CONSTRAINT "hq_contracts_vehicle_id_hq_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."hq_vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_contracts" ADD CONSTRAINT "hq_contracts_reservation_id_hq_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."hq_reservations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_customers" ADD CONSTRAINT "hq_customers_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_documents" ADD CONSTRAINT "hq_documents_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_documents" ADD CONSTRAINT "hq_documents_customer_id_hq_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."hq_customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_documents" ADD CONSTRAINT "hq_documents_contract_id_hq_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."hq_contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_documents" ADD CONSTRAINT "hq_documents_vehicle_id_hq_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."hq_vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_payments" ADD CONSTRAINT "hq_payments_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_payments" ADD CONSTRAINT "hq_payments_customer_id_hq_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."hq_customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_payments" ADD CONSTRAINT "hq_payments_contract_id_hq_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."hq_contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_reservations" ADD CONSTRAINT "hq_reservations_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_reservations" ADD CONSTRAINT "hq_reservations_customer_id_hq_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."hq_customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_reservations" ADD CONSTRAINT "hq_reservations_vehicle_id_hq_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."hq_vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_vehicles" ADD CONSTRAINT "hq_vehicles_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gmail_accounts" ADD CONSTRAINT "gmail_accounts_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gmail_attachments" ADD CONSTRAINT "gmail_attachments_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gmail_attachments" ADD CONSTRAINT "gmail_attachments_gmail_account_id_gmail_accounts_id_fk" FOREIGN KEY ("gmail_account_id") REFERENCES "public"."gmail_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gmail_attachments" ADD CONSTRAINT "gmail_attachments_message_id_gmail_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."gmail_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gmail_labels" ADD CONSTRAINT "gmail_labels_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gmail_labels" ADD CONSTRAINT "gmail_labels_gmail_account_id_gmail_accounts_id_fk" FOREIGN KEY ("gmail_account_id") REFERENCES "public"."gmail_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gmail_messages" ADD CONSTRAINT "gmail_messages_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gmail_messages" ADD CONSTRAINT "gmail_messages_gmail_account_id_gmail_accounts_id_fk" FOREIGN KEY ("gmail_account_id") REFERENCES "public"."gmail_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gmail_messages" ADD CONSTRAINT "gmail_messages_thread_id_gmail_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."gmail_threads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gmail_threads" ADD CONSTRAINT "gmail_threads_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gmail_threads" ADD CONSTRAINT "gmail_threads_gmail_account_id_gmail_accounts_id_fk" FOREIGN KEY ("gmail_account_id") REFERENCES "public"."gmail_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spireon_devices" ADD CONSTRAINT "spireon_devices_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spireon_diagnostics" ADD CONSTRAINT "spireon_diagnostics_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spireon_diagnostics" ADD CONSTRAINT "spireon_diagnostics_device_id_spireon_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."spireon_devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spireon_geofence_events" ADD CONSTRAINT "spireon_geofence_events_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spireon_geofence_events" ADD CONSTRAINT "spireon_geofence_events_device_id_spireon_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."spireon_devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spireon_geofence_events" ADD CONSTRAINT "spireon_geofence_events_geofence_id_spireon_geofences_id_fk" FOREIGN KEY ("geofence_id") REFERENCES "public"."spireon_geofences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spireon_geofences" ADD CONSTRAINT "spireon_geofences_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spireon_locations" ADD CONSTRAINT "spireon_locations_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spireon_locations" ADD CONSTRAINT "spireon_locations_device_id_spireon_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."spireon_devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_accounts" ADD CONSTRAINT "whatsapp_accounts_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_contacts" ADD CONSTRAINT "whatsapp_contacts_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_contacts" ADD CONSTRAINT "whatsapp_contacts_whatsapp_account_id_whatsapp_accounts_id_fk" FOREIGN KEY ("whatsapp_account_id") REFERENCES "public"."whatsapp_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_media" ADD CONSTRAINT "whatsapp_media_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_media" ADD CONSTRAINT "whatsapp_media_message_id_whatsapp_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."whatsapp_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_whatsapp_account_id_whatsapp_accounts_id_fk" FOREIGN KEY ("whatsapp_account_id") REFERENCES "public"."whatsapp_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_contact_id_whatsapp_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."whatsapp_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_customers" ADD CONSTRAINT "core_customers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_vehicles" ADD CONSTRAINT "core_vehicles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_links" ADD CONSTRAINT "external_links_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_merges" ADD CONSTRAINT "identity_merges_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_event_links" ADD CONSTRAINT "timeline_event_links_timeline_event_id_timeline_events_id_fk" FOREIGN KEY ("timeline_event_id") REFERENCES "public"."timeline_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_views" ADD CONSTRAINT "timeline_views_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_tasks" ADD CONSTRAINT "ai_tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "embedding_queue" ADD CONSTRAINT "embedding_queue_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_keys_tenant_id_idx" ON "api_keys" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "audit_logs_tenant_id_idx" ON "audit_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "users_tenant_id_idx" ON "users" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "files_tenant_id_idx" ON "files" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "files_source_idx" ON "files" USING btree ("source","source_id");--> statement-breakpoint
CREATE INDEX "files_s3_key_idx" ON "files" USING btree ("s3_key");--> statement-breakpoint
CREATE INDEX "integration_accounts_tenant_id_idx" ON "integration_accounts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "integration_accounts_type_idx" ON "integration_accounts" USING btree ("type");--> statement-breakpoint
CREATE INDEX "sync_cursors_account_entity_idx" ON "sync_cursors" USING btree ("integration_account_id","entity_type");--> statement-breakpoint
CREATE INDEX "sync_runs_integration_account_id_idx" ON "sync_runs" USING btree ("integration_account_id");--> statement-breakpoint
CREATE INDEX "sync_runs_status_idx" ON "sync_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sync_runs_created_at_idx" ON "sync_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "monday_activity_logs_board_id_idx" ON "monday_activity_logs" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX "monday_activity_logs_item_id_idx" ON "monday_activity_logs" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "monday_activity_logs_event_idx" ON "monday_activity_logs" USING btree ("event");--> statement-breakpoint
CREATE INDEX "monday_activity_logs_created_at_external_idx" ON "monday_activity_logs" USING btree ("created_at_external");--> statement-breakpoint
CREATE INDEX "monday_boards_integration_account_id_idx" ON "monday_boards" USING btree ("integration_account_id");--> statement-breakpoint
CREATE INDEX "monday_boards_workspace_id_idx" ON "monday_boards" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "monday_boards_in_scope_idx" ON "monday_boards" USING btree ("in_scope");--> statement-breakpoint
CREATE INDEX "monday_columns_board_id_idx" ON "monday_columns" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX "monday_files_item_id_idx" ON "monday_files" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "monday_files_update_id_idx" ON "monday_files" USING btree ("update_id");--> statement-breakpoint
CREATE INDEX "monday_groups_board_id_idx" ON "monday_groups" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX "monday_item_column_value_versions_item_id_idx" ON "monday_item_column_value_versions" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "monday_item_column_value_versions_changed_at_idx" ON "monday_item_column_value_versions" USING btree ("changed_at");--> statement-breakpoint
CREATE INDEX "monday_item_column_values_item_id_idx" ON "monday_item_column_values" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "monday_item_column_values_column_id_idx" ON "monday_item_column_values" USING btree ("column_id");--> statement-breakpoint
CREATE INDEX "monday_item_column_values_text_value_idx" ON "monday_item_column_values" USING btree ("text_value");--> statement-breakpoint
CREATE INDEX "monday_items_board_id_idx" ON "monday_items" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX "monday_items_group_id_idx" ON "monday_items" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "monday_items_name_idx" ON "monday_items" USING btree ("name");--> statement-breakpoint
CREATE INDEX "monday_replies_update_id_idx" ON "monday_replies" USING btree ("update_id");--> statement-breakpoint
CREATE INDEX "monday_updates_item_id_idx" ON "monday_updates" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "monday_updates_created_at_external_idx" ON "monday_updates" USING btree ("created_at_external");--> statement-breakpoint
CREATE INDEX "monday_users_email_idx" ON "monday_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "monday_workspaces_integration_account_id_idx" ON "monday_workspaces" USING btree ("integration_account_id");--> statement-breakpoint
CREATE INDEX "hq_charges_integration_account_id_idx" ON "hq_charges" USING btree ("integration_account_id");--> statement-breakpoint
CREATE INDEX "hq_charges_customer_id_idx" ON "hq_charges" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "hq_charges_contract_id_idx" ON "hq_charges" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "hq_contracts_integration_account_id_idx" ON "hq_contracts" USING btree ("integration_account_id");--> statement-breakpoint
CREATE INDEX "hq_contracts_customer_id_idx" ON "hq_contracts" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "hq_contracts_vehicle_id_idx" ON "hq_contracts" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "hq_contracts_status_idx" ON "hq_contracts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "hq_customers_integration_account_id_idx" ON "hq_customers" USING btree ("integration_account_id");--> statement-breakpoint
CREATE INDEX "hq_customers_email_idx" ON "hq_customers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "hq_customers_phone_normalized_idx" ON "hq_customers" USING btree ("phone_normalized");--> statement-breakpoint
CREATE INDEX "hq_customers_full_name_idx" ON "hq_customers" USING btree ("full_name");--> statement-breakpoint
CREATE INDEX "hq_documents_integration_account_id_idx" ON "hq_documents" USING btree ("integration_account_id");--> statement-breakpoint
CREATE INDEX "hq_documents_customer_id_idx" ON "hq_documents" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "hq_documents_contract_id_idx" ON "hq_documents" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "hq_documents_vehicle_id_idx" ON "hq_documents" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "hq_payments_integration_account_id_idx" ON "hq_payments" USING btree ("integration_account_id");--> statement-breakpoint
CREATE INDEX "hq_payments_customer_id_idx" ON "hq_payments" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "hq_payments_contract_id_idx" ON "hq_payments" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "hq_payments_payment_date_idx" ON "hq_payments" USING btree ("payment_date");--> statement-breakpoint
CREATE INDEX "hq_reservations_integration_account_id_idx" ON "hq_reservations" USING btree ("integration_account_id");--> statement-breakpoint
CREATE INDEX "hq_reservations_customer_id_idx" ON "hq_reservations" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "hq_reservations_vehicle_id_idx" ON "hq_reservations" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "hq_reservations_status_idx" ON "hq_reservations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "hq_reservations_pickup_date_idx" ON "hq_reservations" USING btree ("pickup_date");--> statement-breakpoint
CREATE INDEX "hq_vehicles_integration_account_id_idx" ON "hq_vehicles" USING btree ("integration_account_id");--> statement-breakpoint
CREATE INDEX "hq_vehicles_vin_idx" ON "hq_vehicles" USING btree ("vin");--> statement-breakpoint
CREATE INDEX "hq_vehicles_license_plate_idx" ON "hq_vehicles" USING btree ("license_plate");--> statement-breakpoint
CREATE INDEX "hq_vehicles_unit_number_idx" ON "hq_vehicles" USING btree ("unit_number");--> statement-breakpoint
CREATE INDEX "hq_vehicles_status_idx" ON "hq_vehicles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "gmail_accounts_email_address_idx" ON "gmail_accounts" USING btree ("email_address");--> statement-breakpoint
CREATE INDEX "gmail_attachments_message_id_idx" ON "gmail_attachments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "gmail_labels_gmail_account_id_idx" ON "gmail_labels" USING btree ("gmail_account_id");--> statement-breakpoint
CREATE INDEX "gmail_messages_gmail_account_id_idx" ON "gmail_messages" USING btree ("gmail_account_id");--> statement-breakpoint
CREATE INDEX "gmail_messages_thread_id_idx" ON "gmail_messages" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "gmail_messages_from_email_idx" ON "gmail_messages" USING btree ("from_email");--> statement-breakpoint
CREATE INDEX "gmail_messages_internal_date_idx" ON "gmail_messages" USING btree ("internal_date");--> statement-breakpoint
CREATE INDEX "gmail_messages_is_unread_idx" ON "gmail_messages" USING btree ("is_unread");--> statement-breakpoint
CREATE INDEX "gmail_threads_gmail_account_id_idx" ON "gmail_threads" USING btree ("gmail_account_id");--> statement-breakpoint
CREATE INDEX "gmail_threads_last_message_at_idx" ON "gmail_threads" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "gmail_threads_subject_idx" ON "gmail_threads" USING btree ("subject");--> statement-breakpoint
CREATE INDEX "spireon_devices_integration_account_id_idx" ON "spireon_devices" USING btree ("integration_account_id");--> statement-breakpoint
CREATE INDEX "spireon_devices_vehicle_vin_idx" ON "spireon_devices" USING btree ("vehicle_vin");--> statement-breakpoint
CREATE INDEX "spireon_devices_serial_number_idx" ON "spireon_devices" USING btree ("serial_number");--> statement-breakpoint
CREATE INDEX "spireon_diagnostics_device_id_idx" ON "spireon_diagnostics" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "spireon_diagnostics_recorded_at_idx" ON "spireon_diagnostics" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "spireon_geofence_events_device_id_idx" ON "spireon_geofence_events" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "spireon_geofence_events_geofence_id_idx" ON "spireon_geofence_events" USING btree ("geofence_id");--> statement-breakpoint
CREATE INDEX "spireon_geofence_events_occurred_at_idx" ON "spireon_geofence_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "spireon_geofences_integration_account_id_idx" ON "spireon_geofences" USING btree ("integration_account_id");--> statement-breakpoint
CREATE INDEX "spireon_geofences_name_idx" ON "spireon_geofences" USING btree ("name");--> statement-breakpoint
CREATE INDEX "spireon_locations_device_id_idx" ON "spireon_locations" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "spireon_locations_recorded_at_idx" ON "spireon_locations" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "spireon_locations_lat_lng_idx" ON "spireon_locations" USING btree ("lat","lng");--> statement-breakpoint
CREATE INDEX "whatsapp_accounts_phone_number_idx" ON "whatsapp_accounts" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "whatsapp_contacts_wa_id_idx" ON "whatsapp_contacts" USING btree ("wa_id");--> statement-breakpoint
CREATE INDEX "whatsapp_contacts_phone_number_normalized_idx" ON "whatsapp_contacts" USING btree ("phone_number_normalized");--> statement-breakpoint
CREATE INDEX "whatsapp_media_message_id_idx" ON "whatsapp_media" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_whatsapp_account_id_idx" ON "whatsapp_messages" USING btree ("whatsapp_account_id");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_contact_id_idx" ON "whatsapp_messages" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_sent_at_idx" ON "whatsapp_messages" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_direction_idx" ON "whatsapp_messages" USING btree ("direction");--> statement-breakpoint
CREATE INDEX "alerts_tenant_id_idx" ON "alerts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "alerts_entity_idx" ON "alerts" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "alerts_status_idx" ON "alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "alerts_severity_idx" ON "alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "alerts_created_at_idx" ON "alerts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "core_customers_tenant_id_idx" ON "core_customers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "core_customers_primary_email_idx" ON "core_customers" USING btree ("primary_email");--> statement-breakpoint
CREATE INDEX "core_customers_primary_phone_idx" ON "core_customers" USING btree ("primary_phone");--> statement-breakpoint
CREATE INDEX "core_customers_full_name_idx" ON "core_customers" USING btree ("full_name");--> statement-breakpoint
CREATE INDEX "core_vehicles_tenant_id_idx" ON "core_vehicles" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "core_vehicles_license_plate_idx" ON "core_vehicles" USING btree ("license_plate");--> statement-breakpoint
CREATE INDEX "core_vehicles_unit_number_idx" ON "core_vehicles" USING btree ("unit_number");--> statement-breakpoint
CREATE INDEX "core_vehicles_status_idx" ON "core_vehicles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "external_links_tenant_id_idx" ON "external_links" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "external_links_entity_idx" ON "external_links" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "external_links_source_idx" ON "external_links" USING btree ("source","source_entity_type");--> statement-breakpoint
CREATE INDEX "external_links_status_idx" ON "external_links" USING btree ("status");--> statement-breakpoint
CREATE INDEX "external_links_confidence_idx" ON "external_links" USING btree ("confidence");--> statement-breakpoint
CREATE INDEX "identity_merges_tenant_id_idx" ON "identity_merges" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "identity_merges_survivor_id_idx" ON "identity_merges" USING btree ("survivor_id");--> statement-breakpoint
CREATE INDEX "identity_merges_merged_id_idx" ON "identity_merges" USING btree ("merged_id");--> statement-breakpoint
CREATE INDEX "timeline_event_links_event_id_idx" ON "timeline_event_links" USING btree ("timeline_event_id");--> statement-breakpoint
CREATE INDEX "timeline_event_links_entity_idx" ON "timeline_event_links" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "timeline_events_tenant_id_idx" ON "timeline_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "timeline_events_event_type_idx" ON "timeline_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "timeline_events_source_idx" ON "timeline_events" USING btree ("source");--> statement-breakpoint
CREATE INDEX "timeline_events_source_entity_idx" ON "timeline_events" USING btree ("source_entity_type","source_entity_id");--> statement-breakpoint
CREATE INDEX "timeline_events_occurred_at_idx" ON "timeline_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "timeline_events_collapse_group_key_idx" ON "timeline_events" USING btree ("collapse_group_key");--> statement-breakpoint
CREATE INDEX "timeline_events_actor_idx" ON "timeline_events" USING btree ("actor_type","actor_id");--> statement-breakpoint
CREATE INDEX "timeline_views_tenant_id_idx" ON "timeline_views" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "ai_conversations_tenant_id_idx" ON "ai_conversations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "ai_conversations_user_id_idx" ON "ai_conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_messages_conversation_id_idx" ON "ai_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "ai_messages_created_at_idx" ON "ai_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_tasks_tenant_id_idx" ON "ai_tasks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "ai_tasks_status_idx" ON "ai_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_tasks_priority_idx" ON "ai_tasks" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "ai_tasks_task_type_idx" ON "ai_tasks" USING btree ("task_type");--> statement-breakpoint
CREATE INDEX "ai_tasks_customer_id_idx" ON "ai_tasks" USING btree ("related_customer_id");--> statement-breakpoint
CREATE INDEX "ai_tasks_vehicle_id_idx" ON "ai_tasks" USING btree ("related_vehicle_id");--> statement-breakpoint
CREATE INDEX "embedding_queue_status_idx" ON "embedding_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "embedding_queue_created_at_idx" ON "embedding_queue" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "embeddings_tenant_id_idx" ON "embeddings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "embeddings_source_type_idx" ON "embeddings" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "embeddings_content_hash_idx" ON "embeddings" USING btree ("content_hash");