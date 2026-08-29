import re

with open("frontend/src/pages/auth/LoginPage.tsx", "r") as f:
    data = f.read()

if "/forgot-password" not in data:
    data = data.replace('</form>', '  <div className="mt-4 text-center text-sm"><Link to="/forgot-password" className="text-brand-600 hover:text-brand-500 font-medium">Forgot your password?</Link></div>\n            </form>')
    with open("frontend/src/pages/auth/LoginPage.tsx", "w") as f:
        f.write(data)
