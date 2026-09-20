// Demo personas: bundled JSON in the engine's input shape (PortfolioInput + Settings).
// RAW inputs only: trades with their per-trade charges, a holdings snapshot with prices, instruments.
// Charges follow a ₹20/order tariff (STT, stamp, exchange, SEBI, DP ₹18.50 per delivery sell, 18% GST);
// they are illustrative, not an exact broker tariff (see PRODUCT.md §10).
import type { PortfolioInput, Settings } from '../engine/types'
import priya from './personas/priya.json'
import arjun from './personas/arjun.json'
import meera from './personas/meera.json'
import rohit from './personas/rohit.json'
import kabir from './personas/kabir.json'
import neha from './personas/neha.json'

export interface Persona {
  id: 'priya' | 'arjun' | 'meera' | 'rohit' | 'kabir' | 'neha'
  name: string
  tagline: string
  story: string
  /** A strategy panel to open when this persona is picked (§10.1: Rohit → charges) */
  openPanel?: 'charges'
  settings: Settings
  portfolio: PortfolioInput
}

export const PERSONAS = [priya, arjun, meera, rohit, kabir, neha] as unknown as Persona[]
export const DEFAULT_PERSONA_ID: Persona['id'] = 'priya'

export const personaById = (id: string): Persona => PERSONAS.find((p) => p.id === id) ?? PERSONAS[0]
