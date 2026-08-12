-- Extension citext: email case-insensitive (TDD §2.2), agar `A@x.com` = `a@x.com`
-- ditegakkan UNIQUE constraint dan bukan normalisasi di aplikasi saja.
CREATE EXTENSION IF NOT EXISTS "citext";--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('draft', 'published', 'finished');--> statement-breakpoint
CREATE TYPE "public"."issue_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."progress_status" AS ENUM('in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."response_type" AS ENUM('answer', 'comment', 'issue');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('participant', 'admin');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" varchar(120) NOT NULL,
	"email" "citext" NOT NULL,
	"phone" varchar(20) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'participant' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"total_points" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_total_points_non_negative" CHECK ("users"."total_points" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"token_hash" char(64) NOT NULL,
	"user_id" bigint NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"title" varchar(200) NOT NULL,
	"description" text,
	"cover_url" text,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"quota" integer,
	"status" "event_status" DEFAULT 'draft' NOT NULL,
	"enrolled_count" integer DEFAULT 0 NOT NULL,
	"material_count" integer DEFAULT 0 NOT NULL,
	"total_points" integer DEFAULT 0 NOT NULL,
	"created_by" bigint NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_schedule_valid" CHECK ("events"."end_at" > "events"."start_at"),
	CONSTRAINT "events_quota_positive" CHECK ("events"."quota" IS NULL OR "events"."quota" > 0),
	CONSTRAINT "events_enrolled_count_non_negative" CHECK ("events"."enrolled_count" >= 0),
	CONSTRAINT "events_material_count_non_negative" CHECK ("events"."material_count" >= 0),
	CONSTRAINT "events_total_points_non_negative" CHECK ("events"."total_points" >= 0)
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "materials_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"event_id" bigint NOT NULL,
	"parent_id" bigint,
	"depth" smallint DEFAULT 0 NOT NULL,
	"title" varchar(200) NOT NULL,
	"content_json" jsonb,
	"content_html" text,
	"points" integer DEFAULT 0 NOT NULL,
	"order_index" integer NOT NULL,
	"sequence_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "materials_points_non_negative" CHECK ("materials"."points" >= 0),
	CONSTRAINT "materials_depth_max_two_levels" CHECK ("materials"."depth" IN (0, 1)),
	CONSTRAINT "materials_order_index_non_negative" CHECK ("materials"."order_index" >= 0)
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "enrollments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"event_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"status" "enrollment_status" DEFAULT 'in_progress' NOT NULL,
	"current_material_id" bigint,
	"max_sequence_reached" integer DEFAULT 0 NOT NULL,
	"completed_material_count" integer DEFAULT 0 NOT NULL,
	"total_points" integer DEFAULT 0 NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "enrollments_total_points_non_negative" CHECK ("enrollments"."total_points" >= 0),
	CONSTRAINT "enrollments_max_sequence_non_negative" CHECK ("enrollments"."max_sequence_reached" >= 0),
	CONSTRAINT "enrollments_completed_count_non_negative" CHECK ("enrollments"."completed_material_count" >= 0),
	CONSTRAINT "enrollments_completed_at_consistency" CHECK (("enrollments"."status" = 'completed') = ("enrollments"."completed_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "material_progress" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "material_progress_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"enrollment_id" bigint NOT NULL,
	"material_id" bigint NOT NULL,
	"status" "progress_status" DEFAULT 'completed' NOT NULL,
	"points_earned" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_progress_points_non_negative" CHECK ("material_progress"."points_earned" >= 0)
);
--> statement-breakpoint
CREATE TABLE "responses" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "responses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"enrollment_id" bigint NOT NULL,
	"material_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"type" "response_type" NOT NULL,
	"content" text NOT NULL,
	"issue_status" "issue_status",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "responses_content_length" CHECK (length(btrim("responses"."content")) BETWEEN 1 AND 5000),
	CONSTRAINT "responses_issue_status_consistency" CHECK (("responses"."type" = 'issue') = ("responses"."issue_status" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"scope" varchar(40) NOT NULL,
	"identifier" varchar(160) NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_pkey" PRIMARY KEY("scope","identifier"),
	CONSTRAINT "rate_limits_count_non_negative" CHECK ("rate_limits"."count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_parent_id_materials_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_current_material_id_materials_id_fk" FOREIGN KEY ("current_material_id") REFERENCES "public"."materials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_progress" ADD CONSTRAINT "material_progress_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_progress" ADD CONSTRAINT "material_progress_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_role_status_idx" ON "users" USING btree ("role","status");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "events_status_start_end_idx" ON "events" USING btree ("status","start_at","end_at");--> statement-breakpoint
CREATE INDEX "materials_event_parent_order_idx" ON "materials" USING btree ("event_id","parent_id","order_index");--> statement-breakpoint
CREATE UNIQUE INDEX "materials_event_sequence_key" ON "materials" USING btree ("event_id","sequence_index");--> statement-breakpoint
CREATE UNIQUE INDEX "enrollments_event_user_key" ON "enrollments" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE INDEX "enrollments_user_joined_idx" ON "enrollments" USING btree ("user_id","joined_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "enrollments_event_status_idx" ON "enrollments" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "enrollments_event_current_material_idx" ON "enrollments" USING btree ("event_id","current_material_id");--> statement-breakpoint
CREATE UNIQUE INDEX "material_progress_enrollment_material_key" ON "material_progress" USING btree ("enrollment_id","material_id");--> statement-breakpoint
CREATE INDEX "material_progress_material_idx" ON "material_progress" USING btree ("material_id");--> statement-breakpoint
CREATE INDEX "responses_material_type_created_idx" ON "responses" USING btree ("material_id","type","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "responses_enrollment_created_idx" ON "responses" USING btree ("enrollment_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "responses_enrollment_material_type_idx" ON "responses" USING btree ("enrollment_id","material_id","type");--> statement-breakpoint
CREATE INDEX "responses_open_issue_idx" ON "responses" USING btree ("created_at" DESC NULLS LAST) WHERE type = 'issue' AND issue_status = 'open';--> statement-breakpoint
-- =============================================================================
-- Trigger konsistensi `materials.depth` — TDD §2.4
--
-- Mengisi depth = 0 bila parent_id IS NULL, dan parent.depth + 1 bila terisi.
-- Kombinasi trigger + CHECK (depth IN (0,1)) membuat sub-materi yang bercabang
-- GAGAL DI DATABASE, bukan sekadar ditolak guard aplikasi.
-- Sekaligus menjamin parent berada di event yang sama.
-- =============================================================================
CREATE OR REPLACE FUNCTION materials_set_depth() RETURNS trigger AS $$
DECLARE
  parent_depth    smallint;
  parent_event_id bigint;
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.depth := 0;
  ELSE
    SELECT m.depth, m.event_id INTO parent_depth, parent_event_id
      FROM materials m WHERE m.id = NEW.parent_id;

    IF parent_depth IS NULL THEN
      RAISE EXCEPTION 'Materi induk % tidak ditemukan', NEW.parent_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF parent_event_id <> NEW.event_id THEN
      RAISE EXCEPTION 'Sub-materi harus berada di event yang sama dengan induknya'
        USING ERRCODE = 'check_violation';
    END IF;

    NEW.depth := parent_depth + 1;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER materials_set_depth_trg
  BEFORE INSERT OR UPDATE OF parent_id, event_id ON materials
  FOR EACH ROW EXECUTE FUNCTION materials_set_depth();