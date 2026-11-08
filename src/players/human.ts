import type { Action, Player, PlayerView } from '../engine/types'

export interface HumanRequest {
  view: PlayerView
  actions: Action[]
  respond(action: Action): void
}

/** Parks each decision as a request until the UI answers it. */
export class HumanPlayer implements Player {
  private listener: ((req: HumanRequest | null) => void) | null = null

  /** The UI registers here; it receives each request and `null` once answered. */
  connect(listener: (req: HumanRequest | null) => void) {
    this.listener = listener
  }

  decide(view: PlayerView, actions: Action[]): Promise<Action> {
    return new Promise((resolve) => {
      this.listener?.({
        view,
        actions,
        respond: (action) => {
          this.listener?.(null)
          resolve(action)
        },
      })
    })
  }
}
