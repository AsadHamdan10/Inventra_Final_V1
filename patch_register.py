
import re

with open("frontend/src/pages/auth/RegisterPage.tsx", "r") as f:
    data = f.read()

# Helpers
data = data.replace(
    """<label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Username <span className="text-red-500">*</span></label>""",
    """<label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Username <span className="text-red-500">*</span></label>\n                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-1">Choose carefully \u2014 your username cannot be changed later.</p>"""
)

data = data.replace(
    """<label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email Address <span className="text-red-500">*</span></label>""",
    """<label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email Address <span className="text-red-500">*</span></label>\n                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-1">Used for activation and account security notifications.</p>"""
)

data = data.replace(
    """<label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Company Name <span className="text-red-500">*</span></label>""",
    """<label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Company Name <span className="text-red-500">*</span></label>\n                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-1">Enter your official business name carefully \u2014 this becomes your primary company identity after application submission.</p>"""
)

data = data.replace(
    """<label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Business Type <span className="text-red-500">*</span></label>""",
    """<label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Business Type <span className="text-red-500">*</span></label>\n                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-1">Choose carefully \u2014 this determines the ERP modules available to your company.</p>"""
)

# Business Type explanations
business_type_explanation = """
                  <div className="mt-2 text-xs text-brand-600 dark:text-brand-400 font-medium bg-brand-50 dark:bg-brand-900/20 p-2 rounded">
                    {form.businessType === "TRADING" && "Sales, Procurement, Inventory & Finance"}
                    {form.businessType === "MANUFACTURING" && "Manufacturing, BOM, Production, Inventory & Finance"}
                    {form.businessType === "BOTH" && "Trading + Manufacturing"}
                  </div>
"""

data = data.replace(
    """</select>\n                </div>""",
    """</select>\n""" + business_type_explanation + """                </div>"""
)

# Plan explanation
data = data.replace(
    """<h3 className="text-lg font-medium text-gray-900 dark:text-white">Subscription Plan</h3>""",
    """<h3 className="text-lg font-medium text-gray-900 dark:text-white">Subscription Plan</h3>\n                <p className="text-xs text-gray-500 dark:text-gray-400">Plan and billing terms can be changed later according to your subscription.</p>"""
)

with open("frontend/src/pages/auth/RegisterPage.tsx", "w") as f:
    f.write(data)

