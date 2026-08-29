import prisma from './prisma';

export async function generateTenantId(prefix: string, userId: number): Promise<string> {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.tenantSequence.findUnique({
      where: { userId_prefix: { userId, prefix } },
    });
    const nextSeq = (existing?.seq ?? 0) + 1;
    await tx.tenantSequence.upsert({
      where: { userId_prefix: { userId, prefix } },
      create: { userId, prefix, seq: nextSeq, documentType: prefix, financialYear: 'LEGACY' },
      update: { seq: nextSeq },
    });
    return nextSeq;
  });
  return `${prefix}-USER${userId}-${String(result).padStart(4, '0')}`;
}

export function getFinancialYear(date: Date): string {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  if (month >= 4) return `${year}-${(year + 1).toString().slice(2)}`;
  return `${year - 1}-${year.toString().slice(2)}`;
}

export async function generateDocumentNumber(documentType: string, userId: number, date: Date | string, customTx?: any): Promise<string> {
  const d = new Date(date);
  const fy = getFinancialYear(d);
  const txClient = customTx || prisma;

  const prefix = documentType; 

  const existing = await txClient.tenantSequence.findUnique({
    where: { userId_prefix: { userId, prefix } }
  });

  const nextSeq = (existing?.seq ?? 0) + 1;

  await txClient.tenantSequence.upsert({
    where: { userId_prefix: { userId, prefix } },
    create: { userId, prefix, seq: nextSeq, documentType, financialYear: fy },
    update: { seq: nextSeq, documentType, financialYear: fy }
  });

  return `${documentType}/${fy}/${String(nextSeq).padStart(4, '0')}`;
}
