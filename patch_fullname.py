
import re

# Backend Controller
with open("backend/src/controllers/authController.ts", "r") as f:
    data = f.read()

data = data.replace(
    "companyName: z.string()",
    "fullName: z.string().optional(),\n    companyName: z.string()"
)

data = data.replace(
    "companyName:     d.companyName,",
    "fullName:        d.fullName,\n          companyName:     d.companyName,"
)

with open("backend/src/controllers/authController.ts", "w") as f:
    f.write(data)

# Frontend Register Page
with open("frontend/src/pages/auth/RegisterPage.tsx", "r") as f:
    data = f.read()

data = data.replace(
    "username: \"\", email: \"\",",
    "fullName: \"\", username: \"\", email: \"\","
)

fullname_html = """<div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name <span className="text-red-500">*</span></label>
                  <input type="text" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white p-3 text-lg" />
                </div>"""

data = data.replace(
    """<h3 className="text-lg font-medium text-gray-900 dark:text-white">Your Information</h3>""",
    """<h3 className="text-lg font-medium text-gray-900 dark:text-white">Your Information</h3>\n                """ + fullname_html
)

data = data.replace(
    """<span className="block text-xs text-gray-500 uppercase">Applicant</span><span className="font-medium">{form.username} ({form.email})</span>""",
    """<span className="block text-xs text-gray-500 uppercase">Applicant</span><span className="font-medium">{form.fullName} - {form.username} ({form.email})</span>"""
)

with open("frontend/src/pages/auth/RegisterPage.tsx", "w") as f:
    f.write(data)

