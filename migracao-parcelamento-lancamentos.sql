-- ============================================================
-- CONTROLE DE COMPRAS PARCELADAS
-- Execute UMA ÚNICA VEZ no SQL Editor do Neon antes do deploy.
-- É seguro executar novamente porque usa IF NOT EXISTS.
-- ============================================================

ALTER TABLE public.lancamentos
  ADD COLUMN IF NOT EXISTS parcelado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parcela_atual integer,
  ADD COLUMN IF NOT EXISTS total_parcelas integer,
  ADD COLUMN IF NOT EXISTS grupo_parcelamento text,
  ADD COLUMN IF NOT EXISTS valor_total_compra numeric(12,2),
  ADD COLUMN IF NOT EXISTS parcela_paga boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS data_pagamento date;

-- Mantém os lançamentos antigos como realizados/pagos.
UPDATE public.lancamentos
SET parcela_paga = true
WHERE parcela_paga IS NULL;

ALTER TABLE public.lancamentos
  DROP CONSTRAINT IF EXISTS lancamentos_parcelas_validas_check;

ALTER TABLE public.lancamentos
  ADD CONSTRAINT lancamentos_parcelas_validas_check CHECK (
    (parcelado = false AND parcela_atual IS NULL AND total_parcelas IS NULL)
    OR
    (parcelado = true
      AND parcela_atual IS NOT NULL
      AND total_parcelas IS NOT NULL
      AND parcela_atual >= 1
      AND total_parcelas >= 2
      AND parcela_atual <= total_parcelas)
  );

CREATE INDEX IF NOT EXISTS idx_lancamentos_usuario_grupo_parcelamento
  ON public.lancamentos (usuario_id, grupo_parcelamento)
  WHERE grupo_parcelamento IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lancamentos_usuario_parcela_paga
  ON public.lancamentos (usuario_id, parcela_paga)
  WHERE parcelado = true;
