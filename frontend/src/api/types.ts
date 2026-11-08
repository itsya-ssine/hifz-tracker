export type Role = 'STUDENT' | 'ADMIN'
export type Language = 'en' | 'ar'

export interface User {
  id: number
  login: string
  full_name: string
  email: string | null
  role: Role
  preferred_lang: Language
  is_active: boolean
  must_change_password: boolean
}
