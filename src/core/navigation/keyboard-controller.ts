import { ReaderState } from '../state/reader-state';

export class KeyboardController {
  private state: ReaderState;

  constructor(state: ReaderState) {
    this.state = state;
  }

  public handleKey(key: string): boolean {
    switch (key) {
      case 'ArrowRight':
      case 'ArrowDown':
      case 'Enter':
      case ' ':
        this.state.next();
        return true;
      case 'ArrowLeft':
      case 'ArrowUp':
      case 'Backspace':
        this.state.prev();
        return true;
      default:
        return false;
    }
  }
}
