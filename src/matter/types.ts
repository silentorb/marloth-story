import { Token } from "marked"

export interface Section {
  name: string
  tokens: Token[]
}

export interface ParentSection {
  name: string
  tokens: Section[]
}
