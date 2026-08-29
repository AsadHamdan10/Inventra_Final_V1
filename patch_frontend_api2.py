import re

with open("frontend/src/services/apiServices.ts", "r") as f:
    data = f.read()

# Make sure authApi has everything
new_auth_api = """export const authApi = {
  login: (data: { username: string; password: string }) =>
    api.post('/auth/login', data).then((r) => r.data),
  register: (data: any) =>
    api.post('/auth/register', data).then((r) => r.data),
  logout: () =>
    api.post('/auth/logout').then((r) => r.data),
  me: () =>
    api.get('/auth/me').then((r) => r.data),
  updateProfile: (data: any) =>
    api.put('/auth/profile', data).then((r) => r.data),
  changePassword: (data: any) =>
    api.put('/auth/change-password', data).then((r) => r.data),
  refresh: () =>
    api.post('/auth/refresh').then((r) => r.data),
  activate: (data: any) => 
    api.post('/auth/activate', data).then((r) => r.data),
  forgotPassword: (data: any) => 
    api.post('/auth/forgot-password', data).then((r) => r.data),
  resetPassword: (data: any) => 
    api.post('/auth/reset-password', data).then((r) => r.data),
  revokeAllSessions: () => 
    api.post('/auth/revoke-all-sessions').then((r) => r.data),
};"""

data = re.sub(r'export const authApi = \{.*?\n\};', new_auth_api, data, flags=re.DOTALL)

with open("frontend/src/services/apiServices.ts", "w") as f:
    f.write(data)
