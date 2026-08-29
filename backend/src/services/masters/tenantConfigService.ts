import prisma from '../../utils/prisma';
import { BusinessType } from '@prisma/client';

export const getTenantConfiguration = async (userId: number) => {
    let config = await prisma.tenantConfiguration.findUnique({
        where: { userId }
    });

    if (!config) {
        config = await prisma.tenantConfiguration.create({
            data: {
                userId,
                businessType: 'TRADING',
                enabledModules: JSON.stringify(['TRADING', 'INVENTORY', 'ACCOUNTING'])
            }
        });
    }

    return config;
};

export const updateTenantConfiguration = async (userId: number, businessType: BusinessType, enabledModules: string[]) => {
    return prisma.tenantConfiguration.upsert({
        where: { userId },
        create: {
            userId,
            businessType,
            enabledModules: JSON.stringify(enabledModules)
        },
        update: {
            businessType,
            enabledModules: JSON.stringify(enabledModules)
        }
    });
};
