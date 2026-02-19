export type IndustryType =
  | 'education'
  | 'finance'
  | 'ecommerce'
  | 'realestate'
  | 'auto'
  | 'medical'
  | 'insurance'
  | 'internet'

export type StepType = 'greeting' | 'question' | 'answer' | 'ending'

export type KeywordCategory =
  | 'retain'
  | 'userQuestion'
  | 'userBusy'
  | 'userRefuse'
  | 'activeEnd'
  | 'noSpeech'
  | 'cannotAnswer'

export interface FlowStep {
  id: string
  order: number
  content: string
  type: StepType
  audio?: string
  keywords: string[]
  transferAgent: boolean
}

export interface KeywordRule {
  id: string
  keywords: string[]
  action: string
}

export interface AiFlow {
  id: number
  name: string
  industry: IndustryType
  enabled: boolean
  steps: FlowStep[]
  keywords: Record<KeywordCategory, KeywordRule[]>
}
