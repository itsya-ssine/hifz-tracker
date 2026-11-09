import { useTranslation } from 'react-i18next'
import { CopyButton } from './CopyButton'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogFooter } from './ui/dialog'

interface CredentialsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  login: string
  /** Shown once, with a copy button. Omit when the admin chose the password themselves. */
  password?: string | null
}

export function CredentialsDialog({ open, onOpenChange, title, description, login, password }: CredentialsDialogProps) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description={description}>
        <dl className="space-y-3 rounded-xl border border-border bg-muted/40 p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{t('studentForm.login')}</dt>
            <dd dir="ltr" className="font-mono">
              {login}
            </dd>
          </div>
          {password && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{t('studentForm.temporaryPassword')}</dt>
              <dd className="flex items-center gap-2">
                <code dir="ltr" className="select-all rounded bg-card px-2 py-1 font-mono">
                  {password}
                </code>
                <CopyButton value={password} />
              </dd>
            </div>
          )}
        </dl>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>{t('common.close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
