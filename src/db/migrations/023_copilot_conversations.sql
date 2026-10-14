CREATE TABLE IF NOT EXISTS copilot_conversations (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thread_id VARCHAR(128) NOT NULL,
  title TEXT NOT NULL DEFAULT 'Percakapan baru',
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, thread_id),
  CONSTRAINT copilot_conversations_messages_array CHECK (jsonb_typeof(messages) = 'array')
);
CREATE INDEX IF NOT EXISTS idx_copilot_conversations_user_updated
  ON copilot_conversations(user_id, updated_at DESC);
