import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const runQueries = async () => {
  const insertJournal = await prisma.$executeRaw`
    INSERT INTO Journal(nature, accountNumber)
      SELECT 'Tickets de marché', '1'
        UNION ALL
      SELECT 'Vignette pousse', '21'
        UNION ALL
      SELECT 'Vignette bicyclette', '22'
        UNION ALL
      SELECT 'Vignette charrette', '23'
        UNION ALL
      SELECT 'Velomoteur', '24'
        UNION ALL
      SELECT 'Abattage Bovin', '81'
        UNION ALL
      SELECT 'Abattage Porcin', '82'
        UNION ALL
      SELECT 'Droit de Stationnement', '83'
        UNION ALL
      SELECT 'Cyclo-pousse', '84'
        UNION ALL
      SELECT 'Passeport de bovidés', '851'
        UNION ALL
      SELECT 'Complément de passeport', '852'
        UNION ALL
      SELECT 'Acte de vente de bovidés', '853'
        UNION ALL
      SELECT 'FIB', '86'
    WHERE NOT EXISTS (SELECT 1 FROM Journal)
  `;

  console.log(insertJournal);
}

try {
  await runQueries();
  
  await prisma.$disconnect();
} catch (error) {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
}