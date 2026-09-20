// The §10 sample persona (Priya). The data lives in personas/priya.json; see personas.ts.
import { personaById } from './personas'

const priya = personaById('priya')

export const sampleSettings = priya.settings
export const samplePortfolio = priya.portfolio
