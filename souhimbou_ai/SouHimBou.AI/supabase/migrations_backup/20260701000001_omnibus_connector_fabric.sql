-- ============================================================
-- KHEPRA Omnibus Connector — DB Foundation
-- Migration: 20260701000001_omnibus_connector_fabric.sql
-- Author: SecRed Knowledge Inc. / NouchiX
-- Purpose: connector_profiles, connector_events, connector_schemas
-- ============================================================

-- ── connector_profiles ────────────────────────────────────────
-- One row per registered integration endpoint per org.
-- Credentials are NEVER stored here — only vault_secret_id refs.
-- schema_map and ea_genome evolve over time via EA Kernel.

create table if not exists connector_profiles (
  id                uuid        primary key default gen_random_uuid(),
  org_id            uuid        not null references organizations(id) on delete cascade,
  name              text        not null,
  connector_type    text        not null,
  -- ^ canonical slug: 'splunk'|'elastic'|'crowdstrike'|'sentinel'|'qradar'|
  --   'sentinelone'|'defender'|'okta'|'pagerduty'|'servicenow'|'misp'|
  --   'opencti'|'abuseipdb'|'virustotal'|'otx'|'prisma_cloud'|
  --   'aws_security_hub'|'azure_defender'|'gcp_scc'|'cyberark'|
  --   'beyondtrust'|'xsoar'|'jira'|'webhook_push'|'rest_pull'|'syslog'
  category          text        not null default 'custom',
  -- ^ 'siem'|'edr'|'cloud'|'iam'|'soar'|'threat_intel'|'custom'
  base_url          text        not null,
  auth_method       text        not null default 'bearer',
  -- ^ 'bearer'|'basic'|'api_key'|'oauth2_client_creds'|'mtls'|'hmac'|'none'
  vault_secret_id   text,
  -- ^ Supabase Vault secret ID containing credentials JSON
  --   Structure varies by auth_method:
  --     bearer:             {"token": "..."}
  --     basic:              {"username": "...", "password": "..."}
  --     api_key:            {"key": "...", "header": "X-API-Key"}
  --     oauth2_client_creds:{"client_id":"...","client_secret":"...","token_url":"..."}
  --     hmac:               {"secret": "...", "algorithm": "sha256"}
  --     mtls:               {"cert_pem": "...", "key_pem": "..."}

  pull_config       jsonb       not null default '{}',
  -- ^ { "endpoint": "/api/v1/alerts", "method": "GET",
  --     "params": {"limit": 100, "status": "open"},
  --     "poll_interval_seconds": 300,
  --     "pagination": {"type": "cursor|offset|link", "cursor_field": "nextCursor"},
  --     "filter_field": "updated_at", "lookback_seconds": 3600 }

  push_config       jsonb       not null default '{}',
  -- ^ { "endpoint": "/services/collector/event", "method": "POST",
  --     "content_type": "application/json",
  --     "retry_max": 3, "retry_backoff_ms": 1000,
  --     "envelope": "hec|raw|cef|leef|stix|custom",
  --     "batch_size": 50 }

  schema_map        jsonb       not null default '{}',
  -- ^ {"their_field": "our_field", ...}
  -- Learned and mutated by EA Kernel over time.
  -- Seeded from connector_schemas.field_alias for this connector_type.
  -- Example for Splunk: {"_time": "timestamp", "host": "asset_hostname",
  --   "source": "log_source", "sourcetype": "log_type", "event": "raw_event"}

  ea_genome         jsonb       not null default '{}',
  -- ^ EA Kernel genome state for this specific connector instance
  -- Structure mirrors pkg/agi.AdinkraGenome serialized to JSON

  fitness_score     float       not null default 0.0,
  -- ^ 0.0–1.0: schema_coverage × success_rate × (1 – latency_penalty)

  success_rate      float       not null default 1.0,
  -- ^ Rolling 30-day pull/push success rate

  last_pull_at      timestamptz,
  last_push_at      timestamptz,
  last_health_check timestamptz,
  health_status     text        not null default 'pending',
  -- ^ 'pending'|'healthy'|'degraded'|'disconnected'|'auth_error'

  pqc_signature     text,
  -- ^ ML-DSA-65 signature over SHA-256(connector_type || base_url || schema_map)
  pqc_signed_at     timestamptz,
  dag_node_id       text,
  -- ^ DAG node ID attesting the connector registration

  status            text        not null default 'pending',
  -- ^ 'pending'|'active'|'paused'|'deleted'
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint connector_profiles_org_name_unique unique (org_id, name),
  constraint connector_profiles_type_check check (
    connector_type in (
      'splunk','elastic','qradar','microsoft_sentinel','arcsight',
      'crowdstrike','sentinelone','microsoft_defender','carbon_black',
      'aws_security_hub','azure_defender','gcp_scc','prisma_cloud',
      'okta','azure_ad','cyberark','beyondtrust',
      'pagerduty','servicenow','jira','xsoar',
      'misp','opencti','abuseipdb','virustotal','otx','shodan',
      'webhook_push','rest_pull','syslog','custom'
    )
  ),
  constraint connector_profiles_auth_check check (
    auth_method in (
      'bearer','basic','api_key','oauth2_client_creds','mtls','hmac','none'
    )
  )
);

create index if not exists connector_profiles_org_id_idx
  on connector_profiles (org_id);
create index if not exists connector_profiles_type_status_idx
  on connector_profiles (connector_type, status);
create index if not exists connector_profiles_health_idx
  on connector_profiles (health_status, last_health_check);

-- RLS: org members can only see their own connectors
alter table connector_profiles enable row level security;
create policy "connector_profiles_org_isolation" on connector_profiles
  using (org_id = (
    select org_id from user_profiles where id = auth.uid()
  ));

-- ── connector_events ──────────────────────────────────────────
-- Immutable event log of every pull/push attempt.
-- Each row is a training signal for the EA fitness function.

create table if not exists connector_events (
  id                uuid        primary key default gen_random_uuid(),
  connector_id      uuid        not null references connector_profiles(id) on delete cascade,
  org_id            uuid        not null,
  direction         text        not null,        -- 'pull' | 'push'
  status            text        not null,        -- 'success' | 'error' | 'timeout' | 'auth_error'
  http_status       int,
  latency_ms        int,
  records_returned  int         default 0,       -- items pulled or events pushed
  request_hash      text,                        -- SHA-256 of request body (no secrets)
  response_hash     text,                        -- SHA-256 of response body
  schema_coverage   float,
  -- ^ fraction of expected fields that arrived correctly (0.0–1.0)
  -- This is the primary EA fitness input
  unmapped_fields   jsonb       default '[]',
  -- ^ array of field names that arrived but had no schema_map entry
  -- e.g. ["alert.severity", "metadata.region"]
  mapped_fields     jsonb       default '[]',
  -- ^ array of field names successfully mapped
  error_message     text,
  dag_node_id       text,                        -- DAG attestation for this event
  pqc_signed        bool        not null default false,
  executed_at       timestamptz not null default now()
);

create index if not exists connector_events_connector_id_idx
  on connector_events (connector_id, executed_at desc);
create index if not exists connector_events_org_status_idx
  on connector_events (org_id, status, executed_at desc);
create index if not exists connector_events_coverage_idx
  on connector_events (connector_id, schema_coverage)
  where schema_coverage is not null;

alter table connector_events enable row level security;
create policy "connector_events_org_isolation" on connector_events
  using (org_id = (
    select org_id from user_profiles where id = auth.uid()
  ));

-- ── connector_schemas ─────────────────────────────────────────
-- EA-learned field alias maps, shared across orgs per connector_type.
-- When enough orgs observe the same field mapping, it becomes authoritative.
-- New connector registrations are seeded from is_authoritative=true rows.

create table if not exists connector_schemas (
  id                  uuid        primary key default gen_random_uuid(),
  connector_type      text        not null,
  field_alias         jsonb       not null,
  -- ^ {"their_field": "our_field", ...}
  fitness_score       float       not null default 0.0,
  observation_count   int         not null default 1,
  -- ^ incremented every time this alias is confirmed by a real pull event
  contributing_orgs   int         not null default 1,
  -- ^ number of distinct orgs that observed this mapping (privacy-preserving count)
  first_seen_at       timestamptz not null default now(),
  last_confirmed_at   timestamptz not null default now(),
  pqc_signature       text,
  -- ^ ML-DSA-65 signature applied by EA Kernel when fitness_score > 0.85
  pqc_signed_at       timestamptz,
  is_authoritative    bool        not null default false,
  -- ^ true when observation_count >= 10 AND fitness_score >= 0.90
  -- Triggers promotion by EA Kernel
  ea_generation       int         not null default 0,
  -- ^ EA generation that produced this genome
  genome_hash         text,
  -- ^ SHA-256 of the field_alias JSON (for dedup)
  created_at          timestamptz not null default now(),

  constraint connector_schemas_type_genome_unique unique (connector_type, genome_hash)
);

create index if not exists connector_schemas_type_auth_idx
  on connector_schemas (connector_type, is_authoritative, fitness_score desc);
create index if not exists connector_schemas_fitness_idx
  on connector_schemas (fitness_score desc, observation_count desc);

-- ── Trigger: auto-update updated_at on connector_profiles ─────
create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger connector_profiles_updated_at
  before update on connector_profiles
  for each row execute function update_updated_at_column();

-- ── Trigger: auto-promote authoritative schemas ───────────────
-- When a connector_schema reaches observation_count >= 10 AND
-- fitness_score >= 0.90, promote it to is_authoritative.
create or replace function promote_authoritative_schema()
returns trigger language plpgsql as $$
begin
  if new.observation_count >= 10 and new.fitness_score >= 0.90 then
    -- Demote any existing authoritative schema for this type
    update connector_schemas
      set is_authoritative = false
      where connector_type = new.connector_type
        and is_authoritative = true
        and id != new.id;
    new.is_authoritative = true;
  end if;
  return new;
end;
$$;

create trigger connector_schemas_promote_authoritative
  before update on connector_schemas
  for each row execute function promote_authoritative_schema();

-- ── Seed: canonical schema maps for known connector types ─────
-- These are ground-truth field mappings that seed new connectors.
-- EA Kernel will refine these over time from real observations.

insert into connector_schemas (connector_type, field_alias, fitness_score, observation_count, is_authoritative, genome_hash) values

('splunk', '{
  "_time": "timestamp",
  "host": "asset_hostname",
  "source": "log_source",
  "sourcetype": "log_type",
  "index": "log_index",
  "event": "raw_event",
  "_raw": "raw_event",
  "severity": "severity",
  "category": "event_category",
  "dest": "destination_ip",
  "src": "source_ip",
  "user": "actor_username",
  "action": "event_action",
  "status": "event_status",
  "bytes": "bytes_transferred",
  "duration": "duration_ms"
}', 0.95, 50, true, encode(sha256('splunk-v1-canonical'), 'hex')),

('elastic', '{
  "@timestamp": "timestamp",
  "host.name": "asset_hostname",
  "host.ip": "asset_ip",
  "event.severity": "severity",
  "event.category": "event_category",
  "event.action": "event_action",
  "event.outcome": "event_status",
  "source.ip": "source_ip",
  "destination.ip": "destination_ip",
  "user.name": "actor_username",
  "process.name": "process_name",
  "network.bytes": "bytes_transferred",
  "vulnerability.id": "cve_id",
  "vulnerability.score.base": "cvss_score",
  "signal.rule.name": "rule_name",
  "kibana.alert.severity": "severity"
}', 0.95, 50, true, encode(sha256('elastic-v1-canonical'), 'hex')),

('crowdstrike', '{
  "created_timestamp": "timestamp",
  "device.hostname": "asset_hostname",
  "device.local_ip": "asset_ip",
  "device.platform_name": "platform",
  "severity": "severity",
  "severity_name": "severity_name",
  "tactic": "mitre_tactic",
  "technique": "mitre_technique",
  "description": "description",
  "status": "event_status",
  "user_name": "actor_username",
  "assigned_to_uid": "assigned_to",
  "cid": "org_cid",
  "detection_id": "external_id"
}', 0.95, 50, true, encode(sha256('crowdstrike-v1-canonical'), 'hex')),

('microsoft_sentinel', '{
  "TimeGenerated": "timestamp",
  "AlertName": "rule_name",
  "AlertSeverity": "severity",
  "CompromisedEntity": "asset_hostname",
  "Description": "description",
  "Status": "event_status",
  "Tactics": "mitre_tactic",
  "Techniques": "mitre_technique",
  "RemediationSteps": "remediation",
  "ExtendedProperties": "metadata",
  "SystemAlertId": "external_id"
}', 0.93, 30, true, encode(sha256('sentinel-v1-canonical'), 'hex')),

('qradar', '{
  "start_time": "timestamp",
  "offense_type_str": "event_category",
  "severity": "severity",
  "magnitude": "risk_score",
  "description": "description",
  "offense_source": "source_ip",
  "destination_networks": "destination_network",
  "username_count": "actor_count",
  "status": "event_status",
  "rules": "rule_names",
  "id": "external_id"
}', 0.91, 25, true, encode(sha256('qradar-v1-canonical'), 'hex')),

('pagerduty', '{
  "created_at": "timestamp",
  "summary": "description",
  "severity": "severity",
  "status": "event_status",
  "service.summary": "service_name",
  "assignments[0].assignee.summary": "assigned_to",
  "priority.summary": "priority",
  "incident_key": "external_id",
  "html_url": "external_url"
}', 0.92, 20, true, encode(sha256('pagerduty-v1-canonical'), 'hex')),

('misp', '{
  "timestamp": "timestamp",
  "info": "description",
  "threat_level_id": "severity",
  "Attribute[0].value": "indicator_value",
  "Attribute[0].type": "indicator_type",
  "Attribute[0].comment": "notes",
  "uuid": "external_id",
  "org_id": "source_org",
  "distribution": "distribution"
}', 0.90, 15, true, encode(sha256('misp-v1-canonical'), 'hex')),

('okta', '{
  "published": "timestamp",
  "displayMessage": "description",
  "severity": "severity",
  "eventType": "event_category",
  "outcome.result": "event_status",
  "actor.displayName": "actor_username",
  "actor.type": "actor_type",
  "client.ipAddress": "source_ip",
  "target[0].displayName": "target_resource",
  "uuid": "external_id"
}', 0.90, 15, true, encode(sha256('okta-v1-canonical'), 'hex'))

on conflict (connector_type, genome_hash) do nothing;
