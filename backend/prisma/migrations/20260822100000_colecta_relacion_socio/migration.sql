-- AddForeignKey
ALTER TABLE "colecta" ADD CONSTRAINT "colecta_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "socios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

