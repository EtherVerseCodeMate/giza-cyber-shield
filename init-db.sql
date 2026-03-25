-- PostgreSQL initialization script for Phantom Network Stack
--
-- Tables:
--   - phantom_nodes: Known phantom nodes
--   - phantom_messages: Encrypted messages
--   - phantom_keys: Spectral fingerprint keys

-- Create additional databases if they don't exist
SELECT 'CREATE DATABASE n8n' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'n8n')\gexec
SELECT 'CREATE DATABASE nouchix' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'nouchix')\gexec

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════════════════════════
-- Phantom Nodes Table
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS phantom_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(50) NOT NULL,           -- Adinkra symbol (Eban, Fawohodie, etc.)
    kyber_public_key BYTEA NOT NULL,       -- Kyber-1024 public key
    current_address INET,                  -- Current phantom address (IPv6)
    last_seen TIMESTAMP DEFAULT NOW(),
    trust_score INTEGER DEFAULT 50,        -- 0-100
    created_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT valid_trust_score CHECK (trust_score >= 0 AND trust_score <= 100)
);

CREATE INDEX idx_phantom_nodes_symbol ON phantom_nodes(symbol);
CREATE INDEX idx_phantom_nodes_last_seen ON phantom_nodes(last_seen);

-- ═══════════════════════════════════════════════════════════════════
-- Phantom Messages Table
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS phantom_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_symbol VARCHAR(50) NOT NULL,
    to_symbol VARCHAR(50) NOT NULL,
    encrypted_payload BYTEA NOT NULL,      -- Merkaba + Kyber encrypted
    carrier VARCHAR(20) NOT NULL,          -- JPEG, HTTP, DNS, etc.
    sent_at TIMESTAMP DEFAULT NOW(),
    received_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending',  -- pending, sent, received, failed

    CONSTRAINT valid_carrier CHECK (carrier IN ('JPEG', 'HTTP', 'DNS', 'WebRTC', 'VIDEO', 'BITCOIN'))
);

CREATE INDEX idx_phantom_messages_from ON phantom_messages(from_symbol);
CREATE INDEX idx_phantom_messages_to ON phantom_messages(to_symbol);
CREATE INDEX idx_phantom_messages_sent_at ON phantom_messages(sent_at);

-- ═══════════════════════════════════════════════════════════════════
-- Phantom Keys Table
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS phantom_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(50) NOT NULL UNIQUE,
    kyber_public_key BYTEA NOT NULL,
    kyber_private_key BYTEA NOT NULL,     -- Encrypted at rest
    dilithium_public_key BYTEA NOT NULL,
    dilithium_private_key BYTEA NOT NULL, -- Encrypted at rest
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,                 -- Key rotation (90 days)
    version INTEGER DEFAULT 1             -- Key version for rotation
);

CREATE INDEX idx_phantom_keys_symbol ON phantom_keys(symbol);
CREATE INDEX idx_phantom_keys_expires_at ON phantom_keys(expires_at);

-- ═══════════════════════════════════════════════════════════════════
-- Audit Trail Table (Encrypted)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS phantom_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(50) NOT NULL,      -- NODE_JOIN, MESSAGE_SENT, KEY_ROTATION, etc.
    symbol VARCHAR(50),
    encrypted_details BYTEA NOT NULL,     -- PQC encrypted event details
    timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_phantom_audit_timestamp ON phantom_audit(timestamp);
CREATE INDEX idx_phantom_audit_event_type ON phantom_audit(event_type);

-- ═══════════════════════════════════════════════════════════════════
-- Sample Data (Development Only)
-- ═══════════════════════════════════════════════════════════════════

-- Insert sample phantom node (Eban symbol)
-- In production, this is created by phantom-node on startup
INSERT INTO phantom_nodes (symbol, kyber_public_key, current_address, trust_score)
VALUES (
    'Eban',
    decode('0000000000000000000000000000000000000000000000000000000000000000', 'hex'),  -- Placeholder
    'fc00::a41f:4ab8:3c2d:9f1e',
    95
) ON CONFLICT DO NOTHING;

-- Grant permissions to phantom user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO phantom;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO phantom;
