declare module '#auth-utils' {
  interface User {
    id: string
    email: string
    name: string
    isPlatformAdmin: boolean
  }
  interface UserSession {
    user?: User
  }
}
export {}
