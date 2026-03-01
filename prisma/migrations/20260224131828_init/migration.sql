-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "numeroCliente" TEXT NOT NULL,
    "mesReferencia" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "energiaEletricaKwh" DOUBLE PRECISION NOT NULL,
    "energiaEletricaValor" DOUBLE PRECISION NOT NULL,
    "energiaSceeeKwh" DOUBLE PRECISION NOT NULL,
    "energiaSceeeValor" DOUBLE PRECISION NOT NULL,
    "energiaCompensadaKwh" DOUBLE PRECISION NOT NULL,
    "energiaCompensadaValor" DOUBLE PRECISION NOT NULL,
    "contribuicaoIlumPublica" DOUBLE PRECISION NOT NULL,
    "consumoEnergiaKwh" DOUBLE PRECISION NOT NULL,
    "energiaCompensadaFinalKwh" DOUBLE PRECISION NOT NULL,
    "valorTotalSemGD" DOUBLE PRECISION NOT NULL,
    "economiaGD" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);
