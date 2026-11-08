import type { TFunction } from 'i18next'
import { ApiError } from '../api/client'

/** Turn any thrown value into a translated, user-facing message. */
export function errorMessage(t: TFunction, error: unknown): string {
  if (error instanceof ApiError) return t([`errors.${error.code}`, 'errors.generic'])
  if (error instanceof TypeError) return t('errors.network') // fetch could not reach the server
  return t('errors.generic')
}
