import re

with open("backend/src/controllers/authController.ts", "r", encoding="utf-8") as f:
    data = f.read()

old_user_create = """    const user = await prisma.user.create({
      data: {
        fullName:        d.fullName,
        companyName:     d.companyName,
        username:        d.username,
        email:           d.email,
        mobile:          encryptIfPresent(d.mobile),
        mobileHash:      blindIndex(d.mobile),
        role:            "admin",
        status:          "pending",
        applicationRef,
        plan:            d.plan,
      }
    });"""

new_user_create = """    const user = await prisma.user.create({
      data: {
        fullName:        d.fullName,
        companyName:     d.companyName,
        username:        d.username,
        email:           d.email,
        mobile:          encryptIfPresent(d.mobile),
        mobileHash:      blindIndex(d.mobile),
        role:            "admin",
        status:          "pending",
        applicationRef,
        plan:            d.plan,
        applicationSnapshot: {
          create: {
            applicationRef,
            fullName: d.fullName,
            companyName: d.companyName,
            username: d.username,
            email: d.email,
            mobile: encryptIfPresent(d.mobile),
            businessType: d.businessType || null,
            industry: d.industry || null,
            plan: d.plan || "V1_BASIC",
            billingCycle: d.billingCycle || "YEARLY",
            originalStatus: "pending"
          }
        }
      }
    });"""
data = data.replace(old_user_create, new_user_create)

old_profile_schema = """const profileSchema = z.object({
  fullName:  z.string().optional(),
  companyName:  z.string().min(3).max(200),
  gstin:        z.string().regex(gstinRegex, 'Invalid GSTIN format.'),
  addressLine1: z.string().min(5),
  addressLine2: z.string().optional(),
  city:         z.string().min(2),
  district:     z.string().optional(),
  state:        z.string().min(2),
  pincode:      z.string().regex(/^[1-9][0-9]{5}$/, 'Invalid Indian Pincode.'),
  country:      z.string().optional(),
  panNumber:    z.string().regex(panRegex, 'Invalid PAN format.').optional().or(z.literal('')),
  email:        z.string().email(),
  mobile:       z.string().regex(mobileRegex, 'Invalid Indian mobile number.')
});"""

new_profile_schema = """const profileSchema = z.object({
  fullName:     z.string().optional(),
  companyName:  z.string().min(3).max(200),
  tradingName:  z.string().optional(),
  legalName:    z.string().optional(),
  gstin:        z.string().regex(gstinRegex, 'Invalid GSTIN format.'),
  addressLine1: z.string().min(5),
  addressLine2: z.string().optional(),
  city:         z.string().min(2),
  district:     z.string().optional(),
  state:        z.string().min(2),
  pincode:      z.string().regex(/^[1-9][0-9]{5}$/, 'Invalid Indian Pincode.'),
  country:      z.string().optional(),
  panNumber:    z.string().regex(panRegex, 'Invalid PAN format.').optional().or(z.literal('')),
  email:        z.string().email(),
  mobile:       z.string().regex(mobileRegex, 'Invalid Indian mobile number.'),
  website:      z.string().optional(),
  description:  z.string().optional(),
  contactPerson:z.string().optional(),
  alternatePhone:z.string().optional(),
  currency:     z.string().optional(),
  timezone:     z.string().optional(),
  dateFormat:   z.string().optional(),
  numberFormat: z.string().optional()
});"""

data = data.replace(old_profile_schema, new_profile_schema)

old_update = """    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        fullName:        d.fullName,
        companyName:     d.companyName,
        email:           d.email,
        mobile:          encryptIfPresent(d.mobile),
        mobileHash:      blindIndex(d.mobile),
        gstin:           encryptIfPresent(d.gstin.toUpperCase()),
        gstinHash:       blindIndex(d.gstin.toUpperCase()),
        addressLine1:    encryptIfPresent(d.addressLine1),
        addressLine2:    encryptIfPresent(d.addressLine2),
        city:            encryptIfPresent(d.city),
        district:        encryptIfPresent(d.district),
        state:           encryptIfPresent(d.state),
        pincode:         encryptIfPresent(d.pincode),
        country:         d.country || 'India',
        panNumber:       d.panNumber ? encryptIfPresent(d.panNumber.toUpperCase()) : null,
        panNumberHash:   d.panNumber ? blindIndex(d.panNumber.toUpperCase()) : null,
        profileComplete: true,
      },
    });

    await auditLog(userId, 'PROFILE_UPDATED', 'User updated profile', req);"""

new_update = """    const currentUser = await prisma.user.findUnique({ where: { id: userId } });

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        fullName:        d.fullName,
        companyName:     d.companyName,
        tradingName:     d.tradingName,
        legalName:       d.legalName,
        email:           d.email,
        mobile:          encryptIfPresent(d.mobile),
        mobileHash:      blindIndex(d.mobile),
        gstin:           encryptIfPresent(d.gstin.toUpperCase()),
        gstinHash:       blindIndex(d.gstin.toUpperCase()),
        addressLine1:    encryptIfPresent(d.addressLine1),
        addressLine2:    encryptIfPresent(d.addressLine2),
        city:            encryptIfPresent(d.city),
        district:        encryptIfPresent(d.district),
        state:           encryptIfPresent(d.state),
        pincode:         encryptIfPresent(d.pincode),
        country:         d.country || 'India',
        panNumber:       d.panNumber ? encryptIfPresent(d.panNumber.toUpperCase()) : null,
        panNumberHash:   d.panNumber ? blindIndex(d.panNumber.toUpperCase()) : null,
        website:         d.website,
        description:     d.description,
        contactPerson:   d.contactPerson,
        alternatePhone:  d.alternatePhone,
        currency:        d.currency || 'INR',
        timezone:        d.timezone || 'Asia/Kolkata',
        dateFormat:      d.dateFormat || 'DD/MM/YYYY',
        numberFormat:    d.numberFormat || 'en-IN',
        profileComplete: true,
      },
    });

    await auditLog(userId, 'COMPANY_PROFILE_UPDATED', 'Company operational profile updated', req);
    if (currentUser?.companyName !== d.companyName) {
      await auditLog(userId, 'COMPANY_LEGAL_NAME_CHANGED', `Company name changed to ${d.companyName}`, req);
    }
    if (currentUser?.tradingName !== d.tradingName) {
      await auditLog(userId, 'COMPANY_TRADING_NAME_CHANGED', `Trading name changed`, req);
    }
    const currentGstin = currentUser?.gstin ? require('../utils/crypto').decryptData(currentUser.gstin) : null;
    if (currentGstin !== d.gstin.toUpperCase()) {
      await auditLog(userId, 'COMPANY_GSTIN_CHANGED', `GSTIN updated`, req);
    }"""
data = data.replace(old_update, new_update)

data = data.replace(
    "const user = await prisma.user.findUnique({ where: { id: userId } });",
    "const user = await prisma.user.findUnique({ where: { id: userId }, include: { applicationSnapshot: true } });"
)

with open("backend/src/controllers/authController.ts", "w", encoding="utf-8") as f:
    f.write(data)
