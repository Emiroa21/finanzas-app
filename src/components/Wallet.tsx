import { useEffect, useState, type ReactNode } from 'react'
import { BRAND_LABELS, cardBackground, cardLabel, detectBrand, formatCardNumber, formatExpiry, validExpiry } from '../cards'
import { ACCOUNT_TYPES, COLORS, db, newId, type Account, type AccountType, type CardBrand } from '../db'
import { formatMoney, parseToCents, todayISO } from '../format'
import type { AppData } from '../hooks'
import { cardStatus } from '../credit'
import { EyeIcon, PlusIcon } from './Icons'
import { Sheet } from './Sheet'

export function BrandMark({ brand, fallback }: { brand?: CardBrand; fallback: string }) {
  if (brand === 'mastercard')
    return (
      <span className="brand mc" aria-label="Mastercard">
        <i />
        <i />
      </span>
    )
  if (brand === 'visa') return <span className="brand visa">VISA</span>
  if (brand === 'amex') return <span className="brand amex">AMEX</span>
  return <span className="brand text">{brand ? BRAND_LABELS[brand] : fallback}</span>
}

interface FaceProps {
  name: string
  color: string
  brand?: CardBrand
  last4?: string
  expiry?: string
  label: string
  amount: string
  amountLabel: string
  extra?: string
  eye?: ReactNode
}

/** Cara frontal de una tarjeta: marca, terminación, saldo, nombre y vencimiento. */
export function CardFace({ name, color, brand, last4, expiry, label, amount, amountLabel, extra, eye }: FaceProps) {
  return (
    <div className="card-face" style={{ background: cardBackground(color) }}>
      <div className="cf-top">
        <BrandMark brand={brand} fallback={label} />
        <span className="cf-number">{last4 ? `•••• •••• ${last4}` : ''}</span>
      </div>
      <div className="cf-mid">
        <div>
          <span className="cf-small cf-label">
            {amountLabel}
            {eye}
          </span>
          <div className="cf-amount">{amount}</div>
          {extra && <span className="cf-small">{extra}</span>}
        </div>
        {expiry && (
          <div className="cf-exp">
            <span className="cf-small">Vence</span>
            <strong>{expiry}</strong>
          </div>
        )}
      </div>
      <div className="cf-bottom">
        <span className="cf-small">Nombre</span>
        <strong>{name || 'Mi tarjeta'}</strong>
      </div>
    </div>
  )
}

const STRIP = 46
const FACE = 196

interface WalletProps {
  data: AppData
  hidden: boolean
  onToggleHidden: () => void
  onOpen: (a: Account) => void
  onAdd: () => void
  front: string
  onFront: (id: string) => void
}

/** Tarjetas apiladas: la del frente muestra el detalle y al tocar otra pasa al frente. */
export function Wallet({ data, hidden, onToggleHidden, onOpen, onAdd, front, onFront: setFront }: WalletProps) {
  const accounts = data.accounts.filter((a) => !a.archived)
  const current = accounts.find((a) => a.id === front) ?? accounts[0]
  const order = current ? [...accounts.filter((a) => a.id !== current.id), current] : []
  const mask = (cents: number) => (hidden ? '•••••' : formatMoney(cents))
  const today = todayISO()

  return (
    <>
      <section className="wallet" style={{ height: Math.max(order.length - 1, 0) * STRIP + FACE + 8 }}>
        {order.map((a, i) => {
          const isFront = a.id === current?.id
          const balance = data.balances.get(a.id) ?? 0
          const credit = a.type === 'credit'
          const status = credit ? cardStatus(a, data.transactions, today) : null
          return (
            <div
              key={a.id}
              className={`wallet-card ${isFront ? 'front' : ''}`}
              style={{ top: i * STRIP, zIndex: i + 1 }}
              role="button"
              tabIndex={0}
              aria-label={isFront ? `Editar ${a.name}` : `Ver ${a.name}`}
              onClick={() => (isFront ? onOpen(a) : setFront(a.id))}
            >
              {isFront ? (
                <CardFace
                  name={a.name}
                  color={a.color}
                  brand={a.brand}
                  last4={a.last4}
                  expiry={a.expiry}
                  label={cardLabel(a)}
                  amountLabel={credit ? 'Deuda actual' : 'Saldo'}
                  amount={mask(credit ? Math.max(-balance, 0) : balance)}
                  extra={status?.available !== undefined ? `Disponible ${mask(status.available)}` : undefined}
                  eye={
                    <button
                      className="cf-eye"
                      aria-label={hidden ? 'Mostrar saldo' : 'Ocultar saldo'}
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleHidden()
                      }}
                    >
                      <EyeIcon off={hidden} />
                    </button>
                  }
                />
              ) : (
                <div className="card-face strip" style={{ background: cardBackground(a.color) }}>
                  <div className="cf-top">
                    {a.brand ? <BrandMark brand={a.brand} fallback="" /> : <span className="brand text">{a.name}</span>}
                    <span className="cf-number">{a.last4 ? `•••• ${a.last4}` : a.brand ? a.name : ACCOUNT_TYPES[a.type] === a.name ? '' : ACCOUNT_TYPES[a.type]}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        <button className="add-card-btn" onClick={onAdd}>
          <span className="add-card-plus">
            <PlusIcon />
          </span>
          Agregar tarjeta
        </button>
      </section>
    </>
  )
}

const KINDS: [AccountType, string][] = [
  ['credit', 'Crédito'],
  ['debit', 'Débito'],
  ['savings', 'Ahorro'],
]

/** Alta rápida de una tarjeta con vista previa en vivo. Solo se guardan los últimos 4 dígitos. */
export function AddCardSheet({ onClose, onAdded, count }: { onClose: () => void; onAdded: (id: string) => void; count: number }) {
  const [type, setType] = useState<AccountType>('credit')
  const [name, setName] = useState('')
  const [number, setNumber] = useState('')
  const [brand, setBrand] = useState<CardBrand | undefined>()
  const [brandTouched, setBrandTouched] = useState(false)
  const [expiry, setExpiry] = useState('')
  const [balance, setBalance] = useState('')
  const [limit, setLimit] = useState('')
  const [cutoffDay, setCutoffDay] = useState('')
  const [dueDay, setDueDay] = useState('')
  const [color, setColor] = useState(['#5b3df5', '#0f766e', '#b45309', '#9d174d', '#1d4ed8'][count % 5])
  const [phase, setPhase] = useState<'form' | 'saving' | 'done'>('form')

  const digits = number.replace(/\D/g, '')
  useEffect(() => {
    if (!brandTouched) setBrand(detectBrand(digits))
  }, [digits, brandTouched])

  const last4 = digits.length >= 4 ? digits.slice(-4) : ''
  const expiryOk = !expiry || validExpiry(expiry)
  const canSave = name.trim() !== '' && last4 !== '' && expiryOk
  const credit = type === 'credit'
  const day = (v: string) => {
    const n = Math.round(Number(v))
    return n >= 1 && n <= 31 ? n : undefined
  }

  const save = async () => {
    if (!canSave) return
    setPhase('saving')
    const id = newId()
    const cents = parseToCents(balance)
    await db.accounts.add({
      id,
      name: name.trim(),
      type,
      initialBalance: credit ? -cents : cents,
      color,
      archived: false,
      createdAt: Date.now(),
      last4,
      brand,
      expiry: expiry || undefined,
      ...(credit
        ? {
            cutoffDay: day(cutoffDay),
            dueDay: day(dueDay),
            creditLimit: parseToCents(limit) || undefined,
          }
        : {}),
    })
    // Pequeña pausa para que se vea la animación, como en una app bancaria.
    await new Promise((r) => setTimeout(r, 900))
    setPhase('done')
    onAdded(id)
    await new Promise((r) => setTimeout(r, 600))
    onClose()
  }

  if (phase !== 'form')
    return (
      <Sheet title="Agregar tarjeta" onClose={() => {}}>
        <div className="adding">
          {phase === 'saving' ? (
            <span className="dots">
              <i />
              <i />
              <i />
            </span>
          ) : (
            <span className="adding-ok">✓</span>
          )}
          <p>{phase === 'saving' ? 'Agregando tu tarjeta…' : '¡Tarjeta agregada!'}</p>
        </div>
      </Sheet>
    )

  return (
    <Sheet title="Agregar tarjeta" onClose={onClose}>
      <div className="add-preview">
        <CardFace
          name={name}
          color={color}
          brand={brand}
          last4={last4 || undefined}
          expiry={validExpiry(expiry) ? expiry : undefined}
          label={KINDS.find((k) => k[0] === type)![1]}
          amountLabel={credit ? 'Deuda actual' : 'Saldo'}
          amount={formatMoney(parseToCents(balance))}
        />
      </div>

      <div className="segmented">
        {KINDS.map(([k, label]) => (
          <button key={k} className={k === type ? 'on' : ''} onClick={() => setType(k)}>
            {label}
          </button>
        ))}
      </div>

      <label className="field">
        <span>Nombre</span>
        <input value={name} placeholder="Ej. BBVA Azul" onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        <span>Número de tarjeta</span>
        <span className="field-with-brand">
          <input inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000" value={number} onChange={(e) => setNumber(formatCardNumber(e.target.value))} />
          {brand && <BrandMark brand={brand} fallback="" />}
        </span>
      </label>
      <div className="field-pair">
        <label className="field">
          <span>Vencimiento</span>
          <input inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA" value={expiry} className={expiryOk ? '' : 'invalid'} onChange={(e) => setExpiry(formatExpiry(e.target.value, expiry))} />
        </label>
        <label className="field">
          <span>{credit ? 'Deuda actual' : 'Saldo actual'}</span>
          <input inputMode="decimal" placeholder="$0" value={balance} onChange={(e) => setBalance(e.target.value)} />
        </label>
      </div>
      {credit && (
        <div className="field-trio">
          <label className="field">
            <span>Límite</span>
            <input inputMode="decimal" placeholder="Opcional" value={limit} onChange={(e) => setLimit(e.target.value)} />
          </label>
          <label className="field">
            <span>Día de corte</span>
            <input inputMode="numeric" placeholder="Ej. 5" value={cutoffDay} onChange={(e) => setCutoffDay(e.target.value)} />
          </label>
          <label className="field">
            <span>Día de pago</span>
            <input inputMode="numeric" placeholder="Ej. 25" value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
          </label>
        </div>
      )}

      <p className="hint">Marca</p>
      <div className="chips">
        {(['visa', 'mastercard', 'amex', 'carnet', 'other'] as CardBrand[]).map((b) => (
          <button
            key={b}
            className={`chip ${b === brand ? 'on' : ''}`}
            onClick={() => {
              setBrandTouched(true)
              setBrand(b)
            }}
          >
            {BRAND_LABELS[b]}
          </button>
        ))}
      </div>
      <p className="hint">Color</p>
      <div className="colors">
        {[...new Set(['#5b3df5', '#0f766e', '#b45309', '#9d174d', '#1d4ed8', '#111827', ...COLORS])].map((c) => (
          <button key={c} aria-label={c} className={c === color ? 'on' : ''} style={{ background: c }} onClick={() => setColor(c)} />
        ))}
      </div>

      <p className="hint">🔒 Solo se guardan los últimos 4 dígitos para reconocer la tarjeta. La app nunca pide el CVV ni guarda el número completo.</p>
      <button className="dark-btn" disabled={!canSave} onClick={save}>
        Agregar tarjeta
      </button>
    </Sheet>
  )
}
