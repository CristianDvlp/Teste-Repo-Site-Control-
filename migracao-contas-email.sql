BEGIN;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS nome text;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email_confirmado boolean NOT NULL DEFAULT false;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS versao_sessao integer NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_unico ON usuarios (lower(email)) WHERE email IS NOT NULL;
CREATE TABLE IF NOT EXISTS conta_tokens (
 usuario_id integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
 finalidade text NOT NULL CHECK (finalidade IN ('cadastro','vincular','senha')),
 token_hash text NOT NULL UNIQUE, email text NOT NULL, versao_sessao integer NOT NULL,
 expira_em timestamptz NOT NULL, usado_em timestamptz,
 PRIMARY KEY(usuario_id,finalidade)
);
CREATE TABLE IF NOT EXISTS conta_limites (chave text PRIMARY KEY, inicio timestamptz NOT NULL DEFAULT now(), quantidade integer NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS conta_notificacoes (
 id bigserial PRIMARY KEY, usuario_id integer NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
 criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS conta_notificacoes_lidas (
 notificacao_id bigint NOT NULL REFERENCES conta_notificacoes(id) ON DELETE CASCADE,
 admin_id integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE, lida_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(notificacao_id,admin_id)
);
COMMIT;
