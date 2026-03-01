/*
  Warnings:

  - A unique constraint covering the columns `[numeroCliente,mesReferencia]` on the table `Invoice` will be added. If there are existing duplicate values, this will fail.

*/

-- RemoveDuplicates: mantém apenas o registro mais recente por (numeroCliente, mesReferencia)
DELETE FROM "Invoice"
WHERE id NOT IN (
  SELECT DISTINCT ON ("numeroCliente", "mesReferencia") id
  FROM "Invoice"
  ORDER BY "numeroCliente", "mesReferencia", "createdAt" DESC
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_numeroCliente_idx" ON "Invoice"("numeroCliente");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_createdAt_idx" ON "Invoice"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_numeroCliente_createdAt_idx" ON "Invoice"("numeroCliente", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_numeroCliente_mesReferencia_key" ON "Invoice"("numeroCliente", "mesReferencia");
