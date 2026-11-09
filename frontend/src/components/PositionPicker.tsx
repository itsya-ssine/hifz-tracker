import { useTranslation } from 'react-i18next'
import type { Position } from '../api/student'
import { Field } from './ui/field'
import { Select } from './ui/select'

const HIZB_NUMBERS = Array.from({ length: 60 }, (_, i) => i + 1)
const PART_NUMBERS = Array.from({ length: 8 }, (_, i) => i + 1)

interface PositionPickerProps {
  idPrefix: string
  value: Position
  onChange: (value: Position) => void
  disabled?: boolean
}

/** Hizb (1-60) + part (1-8) selectors. */
export function PositionPicker({ idPrefix, value, onChange, disabled }: PositionPickerProps) {
  const { t } = useTranslation()
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field id={`${idPrefix}-hizb`} label={t('quran.hizb')}>
        <Select
          id={`${idPrefix}-hizb`}
          value={value.hizb}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, hizb: Number(e.target.value) })}
        >
          {HIZB_NUMBERS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
      </Field>
      <Field id={`${idPrefix}-part`} label={t('quran.part')}>
        <Select
          id={`${idPrefix}-part`}
          value={value.part}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, part: Number(e.target.value) })}
        >
          {PART_NUMBERS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  )
}
