import re

with open("frontend/src/components/layout/AppLayout.tsx", "r", encoding="utf-8") as f:
    app_layout = f.read()

# Replace multiple possible import variations
app_layout = app_layout.replace(
    "import { LayoutDashboard, CreditCard, FileText, Activity, Shield, Users, Building2, ",
    "import { LayoutDashboard, CreditCard, FileText, Activity, Shield, Users, Building2, "
)

# It seems I need to find the exact lucide-react import and just append it safely.
import_pattern = re.compile(r"import \{([^}]+)\} from 'lucide-react';")
match = import_pattern.search(app_layout)
if match:
    current_imports = match.group(1)
    if "CreditCard" not in current_imports:
        current_imports += ", CreditCard, Activity, FileText"
    app_layout = import_pattern.sub(f"import {{{current_imports}}} from 'lucide-react';", app_layout)

with open("frontend/src/components/layout/AppLayout.tsx", "w", encoding="utf-8") as f:
    f.write(app_layout)
