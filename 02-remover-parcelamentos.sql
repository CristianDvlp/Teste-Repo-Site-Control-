-- REMOÇÃO COMPLETA DO RECURSO DE PARCELAMENTOS
-- Afeta TODAS AS CONTAS deste banco, inclusive parcelas já pagas e futuras.
-- Não remove lançamentos avulsos nem contas fixas mensais comuns.
-- Execute o arquivo 01 (migracao-dados-navegador.sql) primeiro e publique os
-- arquivos novos ANTES deste script. Feche as abas antigas durante a atualização.
-- Os registros removidos ficam copiados em backup_remocao_20260915.
-- Não execute o antigo migracao-parcelamento-lancamentos.sql depois disto.

BEGIN;
LOCK TABLE public.lancamentos, public.gastos_fixos, public.gastos_fixos_pagamentos IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE IF NOT EXISTS public.backup_remocao_20260915 (
  tabela text NOT NULL,
  registro_id bigint NOT NULL,
  dados jsonb NOT NULL,
  salvo_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tabela, registro_id)
);

-- to_jsonb permite repetir o script mesmo após remover as colunas antigas.
CREATE TEMP TABLE remover_contas ON COMMIT DROP AS
SELECT id FROM public.gastos_fixos g
WHERE to_jsonb(g)->>'tipo_controle' = 'parcelado'
   OR COALESCE((to_jsonb(g)->>'total_parcelas')::integer, 0) > 1;

CREATE TEMP TABLE remover_lancamentos ON COMMIT DROP AS
SELECT id FROM public.lancamentos l
WHERE COALESCE((to_jsonb(l)->>'parcelado')::boolean, false)
   OR NULLIF(to_jsonb(l)->>'grupo_parcelamento','') IS NOT NULL
   OR COALESCE((to_jsonb(l)->>'total_parcelas')::integer, 0) > 1
   OR id IN (
     SELECT lancamento_id FROM public.gastos_fixos_pagamentos
     WHERE gasto_fixo_id IN (SELECT id FROM remover_contas)
   );

CREATE TEMP TABLE remover_pagamentos ON COMMIT DROP AS
SELECT id FROM public.gastos_fixos_pagamentos
WHERE gasto_fixo_id IN (SELECT id FROM remover_contas)
   OR lancamento_id IN (SELECT id FROM remover_lancamentos);

INSERT INTO public.backup_remocao_20260915(tabela,registro_id,dados)
SELECT 'lancamentos',id,to_jsonb(l) FROM public.lancamentos l WHERE id IN (SELECT id FROM remover_lancamentos)
ON CONFLICT DO NOTHING;
INSERT INTO public.backup_remocao_20260915(tabela,registro_id,dados)
SELECT 'gastos_fixos',id,to_jsonb(g) FROM public.gastos_fixos g WHERE id IN (SELECT id FROM remover_contas)
ON CONFLICT DO NOTHING;
INSERT INTO public.backup_remocao_20260915(tabela,registro_id,dados)
SELECT 'gastos_fixos_pagamentos',id,to_jsonb(p) FROM public.gastos_fixos_pagamentos p WHERE id IN (SELECT id FROM remover_pagamentos)
ON CONFLICT DO NOTHING;

DELETE FROM public.gastos_fixos_pagamentos WHERE id IN (SELECT id FROM remover_pagamentos);
DELETE FROM public.lancamentos WHERE id IN (SELECT id FROM remover_lancamentos);
DELETE FROM public.gastos_fixos WHERE id IN (SELECT id FROM remover_contas);

ALTER TABLE public.lancamentos
 DROP COLUMN IF EXISTS parcelado,
 DROP COLUMN IF EXISTS parcela_atual,
 DROP COLUMN IF EXISTS total_parcelas,
 DROP COLUMN IF EXISTS grupo_parcelamento,
 DROP COLUMN IF EXISTS valor_total_compra,
 DROP COLUMN IF EXISTS parcela_paga,
 DROP COLUMN IF EXISTS data_pagamento;
ALTER TABLE public.gastos_fixos
 DROP COLUMN IF EXISTS total_parcelas,
 DROP COLUMN IF EXISTS parcela_inicial;

-- Remove somente os atalhos de indicadores extintos. Preserva os demais.
DO $limpar_preferencias$
BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='usuarios' AND column_name='dashboard_preferencias') THEN
  UPDATE public.usuarios u
  SET dashboard_preferencias = u.dashboard_preferencias ||
   jsonb_build_object(
    'dashboard', COALESCE((SELECT jsonb_agg(v ORDER BY ordem) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(u.dashboard_preferencias->'dashboard')='array' THEN u.dashboard_preferencias->'dashboard' ELSE '[]'::jsonb END) WITH ORDINALITY AS x(v,ordem) WHERE v #>> '{}' NOT IN ('parcelas_pagas','parcelas_pendentes','parcelamento')), '[]'::jsonb),
    'comparativo', COALESCE((SELECT jsonb_agg(v ORDER BY ordem) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(u.dashboard_preferencias->'comparativo')='array' THEN u.dashboard_preferencias->'comparativo' ELSE '[]'::jsonb END) WITH ORDINALITY AS x(v,ordem) WHERE v #>> '{}' NOT IN ('parcelas_pagas','parcelas_pendentes','parcelamento')), '[]'::jsonb)
   )
  WHERE jsonb_typeof(u.dashboard_preferencias)='object';
 END IF;
END $limpar_preferencias$;
UPDATE public.usuarios u
SET preferencias_app = jsonb_set(preferencias_app, '{perfilIndicadores}',
 COALESCE((SELECT jsonb_agg(v ORDER BY ordem) FROM jsonb_array_elements(preferencias_app->'perfilIndicadores') WITH ORDINALITY AS x(v,ordem) WHERE v #>> '{}' NOT IN ('pagar','receber','futuras')), '[]'::jsonb))
WHERE jsonb_typeof(preferencias_app->'perfilIndicadores')='array';

SELECT (SELECT count(*) FROM remover_lancamentos) AS lancamentos_excluidos,
       (SELECT count(*) FROM remover_contas) AS contas_parceladas_excluidas,
       (SELECT count(*) FROM remover_pagamentos) AS pagamentos_excluidos;
COMMIT;
